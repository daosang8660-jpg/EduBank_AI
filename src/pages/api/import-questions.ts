import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import formidable, {
  type File as FormidableFile,
} from "formidable";

import { promises as fs } from "fs";
import path from "path";
import * as mammoth from "mammoth";

export const config = {
  api: {
    bodyParser: false,
  },
};

/* =====================================================
   KIỂU DỮ LIỆU
===================================================== */

type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay";

type QuestionLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

interface ImportedQuestion {
  id: string;

  lessonCode: string;
  lessonTitle: string;

  type: QuestionType;
  level: QuestionLevel;

  question: string;
  options?: string[];

  correctAnswer: string;
  explanation: string;

  sourceKnowledgeIds: string[];

  status: "draft";
  sourceType: "teacher_upload";
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };

    finishReason?: string;
  }>;

  promptFeedback?: {
    blockReason?: string;
  };

  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface ApiResponse {
  success: boolean;
  message?: string;

  questions?: ImportedQuestion[];

  total?: number;
  model?: string;
  fileName?: string;
  fileInfo?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    processingMode:
      | "docx-text"
      | "pdf-vision";
  };
}

/* =====================================================
   CẤU HÌNH
===================================================== */

const MAX_FILE_SIZE =
  15 * 1024 * 1024;

const MAX_WORD_TEXT_LENGTH =
  150_000;

const MAX_IMPORTED_QUESTIONS = 200;

const GEMINI_API_ROOT =
  "https://generativelanguage.googleapis.com/v1beta";

const SUPPORTED_EXTENSIONS = [
  ".docx",
  ".pdf",
];

const VALID_TYPES: QuestionType[] = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
];

const VALID_LEVELS: QuestionLevel[] = [
  "recognition",
  "understanding",
  "application",
  "high_application",
];

/* =====================================================
   HÀM TIỆN ÍCH
===================================================== */

function getFirstField(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getFirstFile(
  value:
    | FormidableFile
    | FormidableFile[]
    | undefined
): FormidableFile | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeText(
  value: string
): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeMarkdownCodeFence(
  value: string
): string {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function createQuestionId(
  lessonCode: string,
  index: number
): string {
  return `${lessonCode}-upload-${Date.now()}-${index + 1}`;
}

function getConfiguredModel(): string {
  const configuredModel =
    process.env.GEMINI_MODEL?.trim();

  return (
    configuredModel ||
    "gemini-3.5-flash-lite"
  )
    .replace(/^models\//, "")
    .trim();
}

function getFileExtension(
  file: FormidableFile
): string {
  return path
    .extname(
      file.originalFilename ?? ""
    )
    .toLowerCase();
}

function validateUploadedFile(
  file: FormidableFile
): ".docx" | ".pdf" {
  if (!file.size || file.size <= 0) {
    throw new Error(
      "File câu hỏi đang trống."
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "File vượt quá giới hạn 15 MB."
    );
  }

  const extension =
    getFileExtension(file);

  if (
    !SUPPORTED_EXTENSIONS.includes(
      extension
    )
  ) {
    throw new Error(
      "Hiện chỉ hỗ trợ file Word DOCX và PDF."
    );
  }

  return extension as
    | ".docx"
    | ".pdf";
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function normalizeQuestionType(
  value: unknown
): QuestionType {
  if (
    typeof value === "string" &&
    VALID_TYPES.includes(
      value as QuestionType
    )
  ) {
    return value as QuestionType;
  }

  return "multiple_choice";
}

function normalizeQuestionLevel(
  value: unknown
): QuestionLevel {
  if (
    typeof value === "string" &&
    VALID_LEVELS.includes(
      value as QuestionLevel
    )
  ) {
    return value as QuestionLevel;
  }

  return "recognition";
}

/* =====================================================
   ĐỌC FILE WORD
===================================================== */

async function readDocxText(
  buffer: Buffer
): Promise<string> {
  const result =
    await mammoth.extractRawText({
      buffer,
    });

  const text =
    normalizeText(result.value ?? "");

  if (!text) {
    throw new Error(
      "Không đọc được nội dung trong file Word."
    );
  }

  if (
    text.length >
    MAX_WORD_TEXT_LENGTH
  ) {
    throw new Error(
      "Nội dung Word quá dài. Hãy chia thành nhiều file nhỏ hơn."
    );
  }

  return text;
}

/* =====================================================
   TẠO PROMPT
===================================================== */

function buildPrompt(input: {
  lessonCode: string;
  lessonTitle: string;
  subject: string;
  grade: number;
  chapterTitle: string;
  sourceType: "docx" | "pdf";
}): string {
  return `
Bạn là chuyên gia chuẩn hóa ngân hàng câu hỏi THCS theo Chương trình GDPT 2018.

Hãy đọc toàn bộ file câu hỏi do giáo viên cung cấp, tách tất cả câu hỏi và chuyển thành JSON dùng cho hệ thống EduBank AI.

THÔNG TIN BÀI HỌC:
- Mã bài: ${input.lessonCode}
- Tên bài: ${input.lessonTitle}
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Chương: ${input.chapterTitle}
- Nguồn file: ${input.sourceType}

QUY ƯỚC DẠNG CÂU HỎI:
- multiple_choice: Trắc nghiệm có 4 phương án và 1 đáp án đúng.
- true_false: Câu hỏi đúng hoặc sai.
- short_answer: Câu trả lời ngắn.
- essay: Câu tự luận.

QUY ƯỚC MỨC ĐỘ:
- recognition: Nhận biết.
- understanding: Thông hiểu.
- application: Vận dụng.
- high_application: Vận dụng cao.

YÊU CẦU:
1. Tách toàn bộ câu hỏi có trong file, tối đa ${MAX_IMPORTED_QUESTIONS} câu.
2. Giữ nguyên nội dung chuyên môn của giáo viên.
3. Chỉ sửa lỗi xuống dòng, lỗi đánh số hoặc lỗi nhận dạng chữ rõ ràng.
4. Không tự thêm câu hỏi không có trong file.
5. Không tự thay đổi đáp án của giáo viên.
6. Nếu file không ghi mức độ, hãy suy luận mức độ phù hợp.
7. Nếu file không ghi dạng câu hỏi, hãy xác định theo cấu trúc.
8. Câu trắc nghiệm phải có đúng 4 phương án.
9. Nếu đáp án ghi A, B, C hoặc D, correctAnswer phải là toàn bộ nội dung phương án tương ứng.
10. Với câu đúng–sai, options phải là ["Đúng", "Sai"].
11. Với trả lời ngắn hoặc tự luận, không cần options.
12. Nếu file không có giải thích, explanation để chuỗi rỗng.
13. sourceKnowledgeIds để mảng rỗng.
14. status luôn là "draft".
15. sourceType luôn là "teacher_upload".
16. Chỉ trả về JSON hợp lệ.
17. Không dùng Markdown.
18. Không viết nội dung ngoài JSON.

CẤU TRÚC JSON:

{
  "questions": [
    {
      "id": "question-1",
      "type": "multiple_choice",
      "level": "recognition",
      "question": "Nội dung câu hỏi",
      "options": [
        "Phương án A",
        "Phương án B",
        "Phương án C",
        "Phương án D"
      ],
      "correctAnswer": "Nội dung phương án đúng",
      "explanation": "",
      "sourceKnowledgeIds": [],
      "status": "draft",
      "sourceType": "teacher_upload"
    }
  ]
}
`;
}

/* =====================================================
   GỌI GEMINI
===================================================== */

async function callGemini(input: {
  apiKey: string;
  model: string;
  prompt: string;

  extension: ".docx" | ".pdf";

  fileBuffer: Buffer;
  docxText?: string;
}): Promise<unknown> {
  const endpoint =
    `${GEMINI_API_ROOT}/models/` +
    `${encodeURIComponent(input.model)}` +
    ":generateContent";

  const parts: Array<
    Record<string, unknown>
  > = [
    {
      text: input.prompt,
    },
  ];

  if (input.extension === ".docx") {
    if (!input.docxText) {
      throw new Error(
        "Không có nội dung Word để xử lý."
      );
    }

    parts.push({
      text:
        "NỘI DUNG FILE WORD:\n\n" +
        input.docxText,
    });
  } else {
    parts.push({
      inline_data: {
        mime_type:
          "application/pdf",

        data:
          input.fileBuffer.toString(
            "base64"
          ),
      },
    });
  }

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-goog-api-key":
          input.apiKey,
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],

        generationConfig: {
          temperature: 0.1,

          responseMimeType:
            "application/json",
        },
      }),
    });
  } catch (error) {
    console.error(
      "Lỗi kết nối Gemini:",
      error
    );

    throw new Error(
      "Không kết nối được Gemini API."
    );
  }

  let result: GeminiResponse;

  try {
    result =
      (await response.json()) as GeminiResponse;
  } catch {
    throw new Error(
      "Gemini trả về phản hồi không hợp lệ."
    );
  }

  if (!response.ok) {
    console.error(
      "Lỗi Gemini import câu hỏi:",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    throw new Error(
      result.error?.message ??
        "Gemini không thể đọc file câu hỏi."
    );
  }

  if (
    result.promptFeedback?.blockReason
  ) {
    throw new Error(
      `Gemini từ chối xử lý file: ${result.promptFeedback.blockReason}.`
    );
  }

  const rawText =
    result.candidates?.[0]?.content
      ?.parts?.[0]?.text;

  if (!rawText) {
    const finishReason =
      result.candidates?.[0]
        ?.finishReason;

    throw new Error(
      finishReason
        ? `Gemini không trả dữ liệu. Lý do: ${finishReason}.`
        : "Gemini không trả về danh sách câu hỏi."
    );
  }

  try {
    return JSON.parse(
      removeMarkdownCodeFence(
        rawText
      )
    );
  } catch {
    console.error(
      "JSON import câu hỏi không hợp lệ:",
      rawText
    );

    throw new Error(
      "Gemini trả về JSON câu hỏi không hợp lệ."
    );
  }
}

/* =====================================================
   CHUẨN HÓA KẾT QUẢ
===================================================== */

function normalizeImportedQuestions(
  value: unknown,
  lessonCode: string,
  lessonTitle: string
): ImportedQuestion[] {
  const rawQuestions =
    Array.isArray(value)
      ? value
      : typeof value === "object" &&
          value !== null &&
          Array.isArray(
            (
              value as {
                questions?: unknown[];
              }
            ).questions
          )
        ? (
            value as {
              questions: unknown[];
            }
          ).questions
        : [];

  return rawQuestions
    .slice(
      0,
      MAX_IMPORTED_QUESTIONS
    )
    .map((rawItem, index) => {
      if (
        typeof rawItem !== "object" ||
        rawItem === null
      ) {
        return null;
      }

      const item = rawItem as {
        id?: unknown;
        type?: unknown;
        level?: unknown;
        question?: unknown;
        options?: unknown;
        correctAnswer?: unknown;
        explanation?: unknown;
        sourceKnowledgeIds?: unknown;
      };

      if (
        !isNonEmptyString(
          item.question
        )
      ) {
        return null;
      }

      const type =
        normalizeQuestionType(
          item.type
        );

      const level =
        normalizeQuestionLevel(
          item.level
        );

      let options:
        | string[]
        | undefined;

      if (
        type === "multiple_choice"
      ) {
        const rawOptions =
          Array.isArray(item.options)
            ? item.options
                .filter(
                  isNonEmptyString
                )
                .map((option) =>
                  option.trim()
                )
            : [];

        if (
          rawOptions.length !== 4
        ) {
          return null;
        }

        options = rawOptions;
      }

      if (type === "true_false") {
        options = ["Đúng", "Sai"];
      }

      let correctAnswer =
        isNonEmptyString(
          item.correctAnswer
        )
          ? item.correctAnswer.trim()
          : "";

      if (
        type === "multiple_choice" &&
        options &&
        /^[A-D]$/i.test(
          correctAnswer
        )
      ) {
        const optionIndex =
          correctAnswer
            .toUpperCase()
            .charCodeAt(0) - 65;

        correctAnswer =
          options[optionIndex] ??
          correctAnswer;
      }

      if (
        !correctAnswer &&
        options?.length
      ) {
        correctAnswer =
          options[0];
      }

      if (!correctAnswer) {
        return null;
      }

      return {
        id:
          isNonEmptyString(item.id)
            ? item.id.trim()
            : createQuestionId(
                lessonCode,
                index
              ),

        lessonCode,
        lessonTitle,

        type,
        level,

        question:
          item.question.trim(),

        ...(options
          ? {
              options,
            }
          : {}),

        correctAnswer,

        explanation:
          isNonEmptyString(
            item.explanation
          )
            ? item.explanation.trim()
            : "",

        sourceKnowledgeIds:
          Array.isArray(
            item.sourceKnowledgeIds
          )
            ? item.sourceKnowledgeIds
                .filter(
                  isNonEmptyString
                )
                .map((sourceId) =>
                  sourceId.trim()
                )
            : [],

        status: "draft",
        sourceType:
          "teacher_upload",
      } satisfies ImportedQuestion;
    })
    .filter(
      (
        item
      ): item is ImportedQuestion =>
        item !== null
    );
}

/* =====================================================
   API HANDLER
===================================================== */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", [
      "POST",
    ]);

    return res.status(405).json({
      success: false,
      message:
        "Chỉ hỗ trợ phương thức POST.",
    });
  }

  const apiKey =
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message:
        "Chưa cấu hình GEMINI_API_KEY.",
    });
  }

  let uploadedFile:
    | FormidableFile
    | null = null;

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: MAX_FILE_SIZE,
      keepExtensions: true,
    });

    const [fields, files] =
      await form.parse(req);

    uploadedFile =
      getFirstFile(files.file);

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message:
          "Chưa nhận được file câu hỏi.",
      });
    }

    const lessonCode =
      getFirstField(
        fields.lessonCode
      ).trim();

    const lessonTitle =
      getFirstField(
        fields.lessonTitle
      ).trim();

    const subject =
      getFirstField(
        fields.subject
      ).trim();

    const chapterTitle =
      getFirstField(
        fields.chapterTitle
      ).trim();

    const grade = Number(
      getFirstField(
        fields.grade
      ).trim()
    );

    if (
      !lessonCode ||
      !lessonTitle ||
      !subject ||
      !chapterTitle ||
      !Number.isFinite(grade)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Thông tin bài học chưa đầy đủ.",
      });
    }

    const extension =
      validateUploadedFile(
        uploadedFile
      );

    const fileBuffer =
      await fs.readFile(
        uploadedFile.filepath
      );

    let docxText:
      | string
      | undefined;

    if (extension === ".docx") {
      docxText =
        await readDocxText(
          fileBuffer
        );
    }

    const model =
      getConfiguredModel();

    const prompt = buildPrompt({
      lessonCode,
      lessonTitle,
      subject,
      grade,
      chapterTitle,

      sourceType:
        extension === ".docx"
          ? "docx"
          : "pdf",
    });

    console.log(
      "Đang nhập câu hỏi:",
      uploadedFile.originalFilename
    );

    console.log(
      "Model:",
      model
    );

    const rawResult =
      await callGemini({
        apiKey,
        model,
        prompt,
        extension,
        fileBuffer,
        docxText,
      });

    const questions =
      normalizeImportedQuestions(
        rawResult,
        lessonCode,
        lessonTitle
      );

    if (
      questions.length === 0
    ) {
      throw new Error(
        "Không tìm thấy câu hỏi hợp lệ trong file."
      );
    }

    const processingMode:
      | "docx-text"
      | "pdf-vision" =
      extension === ".docx"
        ? "docx-text"
        : "pdf-vision";

    return res.status(200).json({
      success: true,

      message:
        `Đã nhập ${questions.length} câu hỏi từ file.`,

      questions,
      total: questions.length,
      model,

      fileInfo: {
        fileName:
          uploadedFile.originalFilename ??
          "cau-hoi",

        fileType:
          extension,

        fileSize:
          uploadedFile.size,

        processingMode,
      },
    });
  } catch (error) {
    console.error(
      "Lỗi API import câu hỏi:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Không thể nhập câu hỏi từ file.",
    });
  } finally {
    if (
      uploadedFile?.filepath
    ) {
      await fs
        .unlink(
          uploadedFile.filepath
        )
        .catch(() => undefined);
    }
  }
}
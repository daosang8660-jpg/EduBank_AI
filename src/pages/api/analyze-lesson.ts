import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import formidable, {
  File as FormidableFile,
} from "formidable";

import fs from "fs/promises";
import path from "path";

/* =====================================================
   NEXT CONFIG
===================================================== */

export const config = {
  api: {
    bodyParser: false,
  },
};

/* =====================================================
   TYPES
===================================================== */

interface ObjectiveItem {
  id: string;
  content: string;
}

interface KnowledgeUnitItem {
  id: string;
  title: string;
  content: string;
}

interface KeywordItem {
  id: string;
  word: string;
  meaning: string;
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
}

interface ExerciseItem {
  id: string;
  question: string;
  answer: string;
}

interface AnalyzedLesson {
  objectives: ObjectiveItem[];

  knowledgeUnits:
    KnowledgeUnitItem[];

  keywords: KeywordItem[];

  activities: ActivityItem[];

  exercises: ExerciseItem[];
}

interface AnalyzeLessonResponse {
  success: boolean;

  data?: AnalyzedLesson;

  fileInfo?: {
    fileName: string;
    characterCount: number;
  };

  error?: string;

  message?: string;
}

/* =====================================================
   HELPERS
===================================================== */

function normalizeText(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/* =====================================================
   FORM FIELD
===================================================== */

function getFieldValue(
  value:
    | string
    | string[]
    | undefined
): string {
  if (
    Array.isArray(value)
  ) {
    return normalizeText(
      value[0]
    );
  }

  return normalizeText(
    value
  );
}

/* =====================================================
   FILE
===================================================== */

function getUploadedFile(
  value:
    | FormidableFile
    | FormidableFile[]
    | undefined
): FormidableFile | null {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      null
    );
  }

  return (
    value ??
    null
  );
}

/* =====================================================
   FILE EXTENSION
===================================================== */

function getExtension(
  fileName: string
): string {
  return path
    .extname(fileName)
    .toLowerCase();
}

/* =====================================================
   READ TXT
===================================================== */

async function readTxtFile(
  filePath: string
): Promise<string> {
  return fs.readFile(
    filePath,
    "utf8"
  );
}

/* =====================================================
   READ PDF

   Dùng require ở trong hàm để tránh một số lỗi
   webpack/server khi import pdf-parse ở đầu module.
===================================================== */

async function readPdfFile(
  filePath: string
): Promise<string> {
  const buffer =
    await fs.readFile(
      filePath
    );

  try {
    const pdfModule =
      await import("pdf-parse");

    const pdfParse =
      pdfModule.default ??
      pdfModule;

    const result =
      await pdfParse(
        buffer
      );

    return normalizeText(
      result?.text
    );
  } catch (error) {
    console.error(
      "PDF parse error:",
      error
    );
    // PDF scan hoặc PDF không tương thích với pdf-parse sẽ được gửi
    // nguyên tệp cho Gemini xử lý ở phía dưới.
    return "";
  }
}

/* =====================================================
   READ SOURCE TEXT
===================================================== */

async function extractTextFromFile(
  file:
    FormidableFile
): Promise<string> {
  const originalName =
    file.originalFilename ??
    "upload";

  const extension =
    getExtension(
      originalName
    );

  if (
    extension === ".txt"
  ) {
    return readTxtFile(
      file.filepath
    );
  }

  if (
    extension === ".pdf"
  ) {
    return readPdfFile(
      file.filepath
    );
  }

  /*
   * Ảnh sẽ được gửi trực tiếp cho Gemini ở bước sau.
   */
  if (
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ].includes(
      extension
    )
  ) {
    return "";
  }

  throw new Error(
    `Định dạng ${extension || "không xác định"} chưa được hỗ trợ.`
  );
}

/* =====================================================
   MIME
===================================================== */

function getMimeType(
  file:
    FormidableFile
): string {
  const extension =
    getExtension(
      file.originalFilename ??
        ""
    );

  if (extension === ".pdf") return "application/pdf";

  if (
    file.mimetype
  ) {
    return file.mimetype;
  }

  switch (
    extension
  ) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";

    case ".png":
      return "image/png";

    case ".webp":
      return "image/webp";

    case ".pdf":
      return "application/pdf";

    default:
      return "application/octet-stream";
  }
}

/* =====================================================
   CLEAN AI JSON
===================================================== */

function cleanJsonText(
  value: string
): string {
  let text =
    value.trim();

  if (
    text.startsWith(
      "```json"
    )
  ) {
    text =
      text.slice(7);
  } else if (
    text.startsWith(
      "```"
    )
  ) {
    text =
      text.slice(3);
  }

  if (
    text.endsWith(
      "```"
    )
  ) {
    text =
      text.slice(
        0,
        -3
      );
  }

  return text.trim();
}

/* =====================================================
   NORMALIZE AI ARRAY
===================================================== */

function asArray(
  value: unknown
): unknown[] {
  return Array.isArray(
    value
  )
    ? value.map((item: unknown) => item !== null && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown> : {})
    : [];
}

/* =====================================================
   NORMALIZE RESULT
===================================================== */

function normalizeAnalyzedLesson(
  raw: Record<string, unknown>
): AnalyzedLesson {
  return {
    objectives:
      asArray(
        raw?.objectives
      ).map(
        (
          item: Record<string, unknown>,
          index
        ) => ({
          id:
            normalizeText(
              item?.id
            ) ||
            `objective-${index + 1}`,

          content:
            normalizeText(
              item?.content
            ),
        })
      ).filter(
        (item) =>
          item.content
      ),

    knowledgeUnits:
      asArray(
        raw?.knowledgeUnits
      ).map(
        (
          item: Record<string, unknown>,
          index
        ) => ({
          id:
            normalizeText(
              item?.id
            ) ||
            `knowledge-${index + 1}`,

          title:
            normalizeText(
              item?.title
            ) ||
            `Nội dung ${index + 1}`,

          content:
            normalizeText(
              item?.content
            ),
        })
      ).filter(
        (item) =>
          item.content
      ),

    keywords:
      asArray(
        raw?.keywords
      ).map(
        (
          item: Record<string, unknown>,
          index
        ) => ({
          id:
            normalizeText(
              item?.id
            ) ||
            `keyword-${index + 1}`,

          word:
            normalizeText(
              item?.word
            ),

          meaning:
            normalizeText(
              item?.meaning
            ),
        })
      ).filter(
        (item) =>
          item.word
      ),

    activities:
      asArray(
        raw?.activities
      ).map(
        (
          item: Record<string, unknown>,
          index
        ) => ({
          id:
            normalizeText(
              item?.id
            ) ||
            `activity-${index + 1}`,

          title:
            normalizeText(
              item?.title
            ) ||
            `Hoạt động ${index + 1}`,

          description:
            normalizeText(
              item?.description
            ),
        })
      ).filter(
        (item) =>
          item.description
      ),

    exercises:
      asArray(
        raw?.exercises
      ).map(
        (
          item: Record<string, unknown>,
          index
        ) => ({
          id:
            normalizeText(
              item?.id
            ) ||
            `exercise-${index + 1}`,

          question:
            normalizeText(
              item?.question
            ),

          answer:
            normalizeText(
              item?.answer
            ),
        })
      ).filter(
        (item) =>
          item.question
      ),
  };
}

/* =====================================================
   PROMPT
===================================================== */

function buildPrompt(params: {
  lessonCode: string;
  lessonTitle: string;
  subject: string;
  grade: string;
  chapterTitle: string;
  sourceText: string;
}): string {
  const {
    lessonCode,
    lessonTitle,
    subject,
    grade,
    chapterTitle,
    sourceText,
  } = params;

  return `
Bạn đang hỗ trợ xây dựng Thư viện tri thức cho hệ thống EduBank AI.

NHIỆM VỤ:
Phân tích học liệu của đúng bài học được cung cấp và chuẩn hóa thành dữ liệu có cấu trúc.

THÔNG TIN BÀI HỌC:
- Môn học: ${subject}
- Lớp: ${grade}
- Chương/chủ đề: ${chapterTitle}
- Mã bài: ${lessonCode}
- Tên bài: ${lessonTitle}

NGUYÊN TẮC:
1. Chỉ sử dụng thông tin có trong tài liệu nguồn.
2. Không tự bổ sung kiến thức không có căn cứ trong tài liệu.
3. Không tự tạo yêu cầu cần đạt chính thức nếu tài liệu không thể hiện.
4. Không biến ví dụ minh họa thành kiến thức bắt buộc.
5. Nội dung phải phù hợp với đúng bài học đang xử lý.
6. Tạo bản TÓM TẮT KIẾN THỨC phục vụ dạy học, diễn đạt bằng lời của bạn, không chép lại nguyên văn các đoạn dài trong sách hoặc tài liệu.
7. Mỗi đơn vị kiến thức trình bày ngắn gọn ý chính và quan hệ giữa các khái niệm. Giữ đúng thuật ngữ, số liệu và điều kiện cần thiết; không thêm kiến thức ngoài nguồn.
8. Với hoạt động và bài tập có trong nguồn, tóm tắt mục tiêu, yêu cầu và dữ kiện cần thiết thay vì sao chép lời dẫn dài. Không tự tạo bài tập hoặc đáp án nếu nguồn không cung cấp đủ căn cứ.
9. Yêu cầu cần đạt chỉ ghi nhận khi nguồn có căn cứ; diễn đạt ngắn gọn và không gắn nhãn là trích dẫn chính thức.
10. Trả về JSON hợp lệ, không Markdown, không giải thích ngoài JSON.

JSON BẮT BUỘC:

{
  "objectives": [
    {
      "id": "objective-1",
      "content": "..."
    }
  ],
  "knowledgeUnits": [
    {
      "id": "knowledge-1",
      "title": "...",
      "content": "..."
    }
  ],
  "keywords": [
    {
      "id": "keyword-1",
      "word": "...",
      "meaning": "..."
    }
  ],
  "activities": [
    {
      "id": "activity-1",
      "title": "...",
      "description": "..."
    }
  ],
  "exercises": [
    {
      "id": "exercise-1",
      "question": "...",
      "answer": "..."
    }
  ]
}

Nếu một nhóm dữ liệu không có trong tài liệu, trả về mảng rỗng [].

NỘI DUNG TÀI LIỆU:

${sourceText}
`.trim();
}

/* =====================================================
   CALL GEMINI
===================================================== */

class GeminiContentError extends Error {
  constructor(message: string, public readonly httpStatus = 502) {
    super(message);
  }
}

function responseCode(value: unknown): string {
  return typeof value === "string" && /^[A-Z0-9_]{1,80}$/.test(value) ? value : "UNKNOWN";
}

async function callGemini(params: {
  prompt: string;
  sourceFile?: FormidableFile | null;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiContentError("Chưa cấu hình GEMINI_API_KEY trong .env.local.", 500);
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: params.prompt }];
  if (params.sourceFile) {
    const fileBuffer = await fs.readFile(params.sourceFile.filepath);
    parts.push({ inlineData: { mimeType: getMimeType(params.sourceFile), data: fileBuffer.toString("base64") } });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: requestBody,
    });
    const raw = await response.text();
    let result: {
      error?: { message?: unknown };
      candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; text?: string }> }; finishReason?: unknown }>;
      promptFeedback?: { blockReason?: unknown };
    };
    try { result = JSON.parse(raw); }
    catch {
      if (response.ok) throw new GeminiContentError(`Gemini trả về phản hồi không phải JSON (HTTP ${response.status}).`);
      result = {};
    }
    if (!response.ok) {
      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 1500 * (2 ** attempt);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (response.status === 503) throw new GeminiContentError("Gemini đang quá tải. Hệ thống đã thử tối đa 3 lần; vui lòng thử sau ít phút.", 503);
      if (response.status === 429) throw new GeminiContentError("Gemini đang giới hạn số lượt gọi. Hệ thống đã thử tối đa 3 lần; vui lòng thử sau ít phút hoặc kiểm tra hạn mức API.", 429);
      const message = typeof result?.error?.message === "string" ? result.error.message.split(apiKey).join("[KEY REDACTED]") : "Gemini không chấp nhận yêu cầu.";
      throw new GeminiContentError(`Gemini HTTP ${response.status}: ${message}`);
    }
    const candidate = Array.isArray(result?.candidates) ? result.candidates[0] : undefined;
    const candidateParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const blockReason = responseCode(result?.promptFeedback?.blockReason);
    const finishReason = responseCode(candidate?.finishReason);
    const text = candidateParts
      .filter((part) => part && part.thought !== true && typeof part.text === "string")
      .map((part) => part.text).join("").trim();
    if ((blockReason !== "UNKNOWN" && blockReason !== "BLOCK_REASON_UNSPECIFIED") || finishReason !== "STOP" || !text) {
      console.warn("Gemini analyze-lesson response-check-v2", {
        model, attempt: attempt + 1, httpStatus: response.status,
        candidates: Array.isArray(result?.candidates) ? result.candidates.length : 0,
        parts: candidateParts.length, textLength: text.length, blockReason, finishReason,
      });
    }
    if (blockReason !== "UNKNOWN" && blockReason !== "BLOCK_REASON_UNSPECIFIED") {
      throw new GeminiContentError(`Gemini chặn yêu cầu chuẩn hóa (${blockReason}). Hãy kiểm tra tài liệu gửi lên.`, 422);
    }
    if (finishReason === "RECITATION") {
      // A blocked response contains no usable lesson. Do not retry or accept partial text.
      throw new GeminiContentError(
        "Gemini dừng do RECITATION: phản hồi bị đánh dấu có khả năng lặp lại nội dung nguồn. Chưa nhận được học liệu để lưu. Hãy dùng bản tóm tắt bài học do giáo viên biên soạn hoặc phần nội dung cần phân tích để tạo bản tóm tắt kiến thức.",
        422
      );
    }
    if (finishReason === "MAX_TOKENS") {
      throw new GeminiContentError("Gemini dừng vì hết giới hạn token (MAX_TOKENS). Nội dung có thể bị cắt; hãy tách tài liệu thành phần nhỏ hơn.");
    }
    if (!["STOP", "UNKNOWN", "FINISH_REASON_UNSPECIFIED"].includes(finishReason)) {
      throw new GeminiContentError(`Gemini dừng chuẩn hóa (${finishReason}). Hãy kiểm tra nội dung tài liệu và thử lại với phần phù hợp.`, 422);
    }
    if (text) return text;
    // Retry only an empty, otherwise unblocked response; do not bypass safety.
    if (attempt < 2) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500 * (2 ** attempt)));
      continue;
    }
    throw new GeminiContentError(`Gemini trả phản hồi rỗng sau tối đa 3 lần thử (finishReason=${finishReason}, parts=${candidateParts.length}). Hãy thử lại hoặc tách tài liệu.`);
  }
  throw new GeminiContentError("Không nhận được nội dung chuẩn hóa từ Gemini.");
}

/* =====================================================
   API HANDLER
===================================================== */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeLessonResponse>
) {
  /*
   * Luôn cố gắng trả JSON.
   * Nhờ vậy frontend không còn nhận nguyên trang HTML lỗi Next.js.
   */
  if (
    req.method !==
    "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res
      .status(405)
      .json({
        success:
          false,

        error:
          "Phương thức không được hỗ trợ.",
      });
  }

  try {
    /* ---------------------------------------------
       PARSE MULTIPART
    --------------------------------------------- */

    const form =
      formidable({
        multiples:
          false,

        keepExtensions:
          true,

        maxFileSize:
          25 *
          1024 *
          1024,
      });

    const [
      fields,
      files,
    ] =
      await form.parse(
        req
      );

    /* ---------------------------------------------
       FILE
    --------------------------------------------- */

    const uploadedFile =
      getUploadedFile(
        files.file
      );

    if (
      !uploadedFile
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Không nhận được tệp học liệu.",
        });
    }

    /* ---------------------------------------------
       FIELDS
    --------------------------------------------- */

    const lessonCode =
      getFieldValue(
        fields.lessonCode
      );

    const lessonTitle =
      getFieldValue(
        fields.lessonTitle
      );

    const subject =
      getFieldValue(
        fields.subject
      );

    const grade =
      getFieldValue(
        fields.grade
      );

    const chapterTitle =
      getFieldValue(
        fields.chapterTitle
      );

    if (
      !lessonCode ||
      !lessonTitle ||
      !subject ||
      !grade
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Thiếu thông tin môn, lớp hoặc bài học.",
        });
    }

    /* ---------------------------------------------
       DETECT FILE TYPE
    --------------------------------------------- */

    const fileName =
      uploadedFile
        .originalFilename ??
      "upload";

    const extension =
      getExtension(
        fileName
      );

    const isImage =
      [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
      ].includes(
        extension
      );

    const isPdf = extension === ".pdf";

    /* ---------------------------------------------
       EXTRACT TEXT
    --------------------------------------------- */

    let sourceText =
      "";

    if (!isImage) {
      sourceText =
        normalizeText(
          await extractTextFromFile(
            uploadedFile
          )
        );

      if (!sourceText && !isPdf) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Tệp TXT trống hoặc không đọc được nội dung văn bản.",
          });
      }
    }

    const pdfNeedsVision = isPdf && !sourceText;
    // PDF gửi inline được dùng cho tệp nhỏ. Giới hạn riêng nhằm tránh
    // chuyển một PDF lớn thành payload base64 quá cỡ trong API này.
    if (pdfNeedsVision && uploadedFile.size > 15 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "PDF scan vượt quá 15 MB. Hãy giảm dung lượng hoặc tách tài liệu trước khi tải lên.",
      });
    }

    /* ---------------------------------------------
       PROMPT
    --------------------------------------------- */

    const prompt =
      buildPrompt({
        lessonCode,

        lessonTitle,

        subject,

        grade,

        chapterTitle,

        sourceText:
          isImage || pdfNeedsVision
            ? "Nội dung bài học nằm trong tệp đính kèm. Hãy đọc nội dung tệp và chuẩn hóa; chỉ dùng thông tin có trong tệp."
            : sourceText,
      });

    /* ---------------------------------------------
       AI
    --------------------------------------------- */

    const aiText =
      await callGemini({
        prompt,

        sourceFile:
          isImage || pdfNeedsVision
            ? uploadedFile
            : null,
      });

    /* ---------------------------------------------
       PARSE AI JSON
    --------------------------------------------- */

    let rawLesson: unknown;

    try {
      rawLesson =
        JSON.parse(
          cleanJsonText(
            aiText
          )
        );
    } catch (
      parseError
    ) {
      console.error("Gemini analyze-lesson: JSON nội dung không hợp lệ.", { textLength: aiText.length });

      return res
        .status(502)
        .json({
          success:
            false,

          error:
            "AI đã phản hồi nhưng dữ liệu chuẩn hóa không đúng cấu trúc JSON.",
        });
    }

    if (!rawLesson || typeof rawLesson !== "object" || Array.isArray(rawLesson) ||
        !["objectives", "knowledgeUnits", "keywords", "activities", "exercises"].every((field) => Array.isArray((rawLesson as Record<string, unknown>)[field]))) {
      throw new GeminiContentError("AI trả JSON nhưng thiếu các danh sách học liệu bắt buộc. Vui lòng thử lại.");
    }
    const data = normalizeAnalyzedLesson(rawLesson as Record<string, unknown>);
    if (Object.values(data).every((items) => items.length === 0)) {
      throw new GeminiContentError("AI trả học liệu rỗng. Hãy kiểm tra tài liệu có nội dung bài học rõ ràng và thử lại.");
    }

    /* ---------------------------------------------
       RESPONSE
    --------------------------------------------- */

    return res
      .status(200)
      .json({
        success:
          true,

        data,

        fileInfo: {
          fileName,

          characterCount:
            sourceText.length,
        },
      });
  } catch (
    error
  ) {
    /*
     * Quan trọng:
     * Không throw tiếp ra ngoài.
     * API phải trả JSON để frontend hiển thị lỗi bình thường.
     */
    console.error("ANALYZE LESSON API ERROR:", {
      kind: error instanceof GeminiContentError ? "GEMINI_RESPONSE" : "OTHER",
      httpStatus: error instanceof GeminiContentError ? error.httpStatus : 500,
    });

    return res
      .status(error instanceof GeminiContentError ? error.httpStatus : 500)
      .json({
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Không thể chuẩn hóa học liệu.",
      });
  }
}

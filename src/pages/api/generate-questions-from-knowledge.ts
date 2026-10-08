import { createHash } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

class RequestError extends Error {
  constructor(public readonly httpStatus: number, message: string) {
    super(message);
  }
}

function subjectKey(value: string): string {
  const normalized = value.trim().replace(/đ/gi, "d").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const aliases: Record<string, string> = {
    TIN: "TINHOC", GDCD: "GIAODUCCONGDAN", KHTN: "KHOAHOCTUNHIEN",
    NV: "NGUVAN", T: "TOAN", LSDL: "LICHSUVADIALI",
  };
  return aliases[normalized] ?? normalized;
}

async function authenticatedProfile(req: NextApiRequest) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new RequestError(401, "Bạn cần đăng nhập để sinh câu hỏi.");
  }
  let uid: string;
  try {
    // checkRevoked=true also rejects revoked sessions and disabled Auth users.
    uid = (await adminAuth.verifyIdToken(authorization.replace(/^Bearer\s+/i, ""), true)).uid;
  } catch {
    throw new RequestError(401, "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.");
  }
  const snapshot = await adminDb.collection("users").doc(uid).get();
  const profile = snapshot.data();
  if (!snapshot.exists || !profile || profile.status !== "active" ||
      !["admin", "teacher"].includes(profile.role)) {
    throw new RequestError(403, "Tài khoản chưa được cấp quyền hoặc đã bị khóa.");
  }
  return profile;
}

import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

/* =====================================================
   KIỂU DỮ LIỆU HỌC LIỆU
===================================================== */

interface Objective {
  id: string;
  content: string;
}

interface KnowledgeUnit {
  id: string;
  title: string;
  content: string;
}

interface Keyword {
  id: string;
  word: string;
  meaning?: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
}

interface Exercise {
  id: string;
  question: string;
  answer: string;
}

interface KnowledgeData {
  objectives: Objective[];
  knowledgeUnits: KnowledgeUnit[];
  keywords: Keyword[];
  activities: Activity[];
  exercises: Exercise[];
}

/* =====================================================
   KIỂU CẤU HÌNH SINH CÂU HỎI
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

interface QuestionSpecification {
  type: QuestionType;
  level: QuestionLevel;
  count: number;
}

interface GenerateQuestionsRequest {
  lessonCode: string;
  lessonTitle: string;
  subject: string;
  grade: number;
  chapterTitle: string;

  knowledge: KnowledgeData;

  specifications: QuestionSpecification[];
  temperature?: number;
}

/* =====================================================
   KIỂU CÂU HỎI AI TRẢ VỀ
===================================================== */

interface GeneratedQuestion {
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
    details?: Array<{ reason?: string }>;
  };
}

interface ApiResponse {
  success: boolean;
  message?: string;
  questions?: GeneratedQuestion[];
  model?: string;
  total?: number;
}

/* =====================================================
   CẤU HÌNH
===================================================== */

const GEMINI_API_ROOT =
  "https://generativelanguage.googleapis.com/v1beta";

const MAX_QUESTION_COUNT = 50;

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

function removeMarkdownCodeFence(
  value: string
): string {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getConfiguredModel(): string {
  const configuredModel =
    process.env.GEMINI_MODEL?.trim();

  const selectedModel = (
    configuredModel || "gemini-3.5-flash-lite"
  )
    .replace(/^models\//, "")
    .trim();

  console.log(
    "Model sinh câu hỏi:",
    selectedModel
  );

  return selectedModel;
}
function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function normalizeKnowledge(
  value: unknown
): KnowledgeData {
  const data =
    typeof value === "object" &&
    value !== null
      ? (value as Partial<KnowledgeData>)
      : {};

  return {
    objectives: Array.isArray(
      data.objectives
    )
      ? data.objectives
      : [],

    knowledgeUnits: Array.isArray(
      data.knowledgeUnits
    )
      ? data.knowledgeUnits
      : [],

    keywords: Array.isArray(
      data.keywords
    )
      ? data.keywords
      : [],

    activities: Array.isArray(
      data.activities
    )
      ? data.activities
      : [],

    exercises: Array.isArray(
      data.exercises
    )
      ? data.exercises
      : [],
  };
}

function validateSpecifications(
  specifications: unknown
): QuestionSpecification[] {
  if (!Array.isArray(specifications)) {
    throw new Error(
      "Cấu hình sinh câu hỏi không hợp lệ."
    );
  }

  const normalized =
    specifications.map((item) => {
      const specification =
        item as Partial<QuestionSpecification>;

      if (
        !VALID_TYPES.includes(
          specification.type as QuestionType
        )
      ) {
        throw new Error(
          "Có dạng câu hỏi không hợp lệ."
        );
      }

      if (
        !VALID_LEVELS.includes(
          specification.level as QuestionLevel
        )
      ) {
        throw new Error(
          "Có mức độ câu hỏi không hợp lệ."
        );
      }

      const count = Number(
        specification.count
      );

      if (
        !Number.isInteger(count) ||
        count < 0
      ) {
        throw new Error(
          "Số lượng câu hỏi phải là số nguyên không âm."
        );
      }

      return {
        type:
          specification.type as QuestionType,

        level:
          specification.level as QuestionLevel,

        count,
      };
    });

  const filtered = normalized.filter(
    (item) => item.count > 0
  );

  if (filtered.length === 0) {
    throw new Error(
      "Phải chọn ít nhất một câu hỏi."
    );
  }

  const total = filtered.reduce(
    (sum, item) => sum + item.count,
    0
  );

  if (total > MAX_QUESTION_COUNT) {
    throw new Error(
      `Mỗi lần chỉ được sinh tối đa ${MAX_QUESTION_COUNT} câu hỏi.`
    );
  }

  return filtered;
}

function hasUsableKnowledge(
  knowledge: KnowledgeData
): boolean {
  return (
    knowledge.objectives.length > 0 ||
    knowledge.knowledgeUnits.length > 0 ||
    knowledge.keywords.length > 0 ||
    knowledge.activities.length > 0 ||
    knowledge.exercises.length > 0
  );
}

function normalizeQuestionType(
  value: unknown
): QuestionType | null {
  if (
    typeof value === "string" &&
    VALID_TYPES.includes(
      value as QuestionType
    )
  ) {
    return value as QuestionType;
  }

  return null;
}

function normalizeQuestionLevel(
  value: unknown
): QuestionLevel | null {
  if (
    typeof value === "string" &&
    VALID_LEVELS.includes(
      value as QuestionLevel
    )
  ) {
    return value as QuestionLevel;
  }

  return null;
}

function normalizeGeneratedQuestions(
  value: unknown,
  lessonCode: string,
  lessonTitle: string
): GeneratedQuestion[] {
  const rawQuestions = Array.isArray(value)
    ? value
    : typeof value === "object" &&
        value !== null &&
        Array.isArray(
          (value as { questions?: unknown[] })
            .questions
        )
      ? (
          value as {
            questions: unknown[];
          }
        ).questions
      : [];

  return rawQuestions
    .map((item, index) => {
      if (
        typeof item !== "object" ||
        item === null
      ) {
        return null;
      }

      const question =
        item as Partial<GeneratedQuestion>;

      const type =
        normalizeQuestionType(
          question.type
        );

      const level =
        normalizeQuestionLevel(
          question.level
        );

      if (
        !type ||
        !level ||
        !isNonEmptyString(
          question.question
        ) ||
        !isNonEmptyString(
          question.correctAnswer
        )
      ) {
        return null;
      }

      let options: string[] | undefined;

      if (type === "multiple_choice") {
        options = Array.isArray(
          question.options
        )
          ? question.options
              .filter(isNonEmptyString)
              .map((option) =>
                option.trim()
              )
          : [];

        if (options.length !== 4) {
          return null;
        }
      }

      if (type === "true_false") {
        options = ["Đúng", "Sai"];
      }

      return {
        id:
          isNonEmptyString(question.id)
            ? question.id.trim()
            : `${lessonCode}-q-${index + 1}`,

        lessonCode,
        lessonTitle,

        type,
        level,

        question:
          question.question.trim(),

        ...(options
          ? {
              options,
            }
          : {}),

        correctAnswer:
          question.correctAnswer.trim(),

        explanation:
          isNonEmptyString(
            question.explanation
          )
            ? question.explanation.trim()
            : "",

        sourceKnowledgeIds:
          Array.isArray(
            question.sourceKnowledgeIds
          )
            ? question.sourceKnowledgeIds
                .filter(isNonEmptyString)
                .map((id) => id.trim())
            : [],

        status: "draft",
      };
    })
    .filter(
      (
        item
      ): item is GeneratedQuestion =>
        item !== null
    );
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
  knowledge: KnowledgeData;
  specifications: QuestionSpecification[];
}): string {
  const totalQuestionCount =
    input.specifications.reduce(
      (sum, item) =>
        sum + item.count,
      0
    );

  return `
Bạn là chuyên gia xây dựng ngân hàng câu hỏi cho giáo dục THCS theo Chương trình GDPT 2018.

Hãy sinh chính xác ${totalQuestionCount} câu hỏi từ học liệu chuẩn hóa được cung cấp.

THÔNG TIN BÀI HỌC:
- Mã bài: ${input.lessonCode}
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Chương: ${input.chapterTitle}
- Tên bài: ${input.lessonTitle}

CẤU HÌNH SỐ LƯỢNG:
${JSON.stringify(
  input.specifications,
  null,
  2
)}

QUY ƯỚC DẠNG CÂU HỎI:
- multiple_choice: Trắc nghiệm 4 lựa chọn, chỉ có 1 đáp án đúng.
- true_false: Câu hỏi đúng hoặc sai.
- short_answer: Câu trả lời ngắn.
- essay: Câu tự luận.

QUY ƯỚC MỨC ĐỘ:
- recognition: Nhận biết.
- understanding: Thông hiểu.
- application: Vận dụng.
- high_application: Vận dụng cao.

YÊU CẦU BẮT BUỘC:
1. Chỉ sử dụng nội dung trong học liệu chuẩn hóa.
2. Không tự thêm kiến thức không có trong học liệu.
3. Sinh đúng số lượng theo từng dạng và từng mức độ.
4. Câu hỏi phải rõ ràng, chính xác, phù hợp học sinh lớp ${input.grade}.
5. Không tạo câu hỏi trùng ý hoặc chỉ thay đổi vài từ.
6. Không dùng cách diễn đạt gây hiểu nhầm.
7. Trắc nghiệm phải có đúng 4 lựa chọn.
8. Các phương án nhiễu phải hợp lí, cùng kiểu dữ liệu và không quá vô lí.
9. correctAnswer phải khớp chính xác với đáp án đúng.
10. explanation phải giải thích ngắn gọn căn cứ kiến thức.
11. sourceKnowledgeIds phải chứa id của đơn vị kiến thức dùng để tạo câu hỏi.
12. Nếu không có đủ căn cứ để tạo câu vận dụng cao, vẫn phải bám sát học liệu, không được bịa thêm dữ kiện chuyên môn.
13. Mọi câu hỏi đều có status là "draft".
14. Chỉ trả về JSON hợp lệ.
15. Không dùng Markdown.
16. Không viết nội dung ngoài JSON.

CẤU TRÚC JSON BẮT BUỘC:

{
  "questions": [
    {
      "id": "${input.lessonCode}-q-1",
      "lessonCode": "${input.lessonCode}",
      "lessonTitle": "${input.lessonTitle}",
      "type": "multiple_choice",
      "level": "recognition",
      "question": "Nội dung câu hỏi",
      "options": [
        "Phương án A",
        "Phương án B",
        "Phương án C",
        "Phương án D"
      ],
      "correctAnswer": "Phương án đúng",
      "explanation": "Giải thích đáp án",
      "sourceKnowledgeIds": [
        "knowledge-1"
      ],
      "status": "draft"
    }
  ]
}

HỌC LIỆU CHUẨN HÓA:

${JSON.stringify(
  input.knowledge,
  null,
  2
)}
`;
}

/* =====================================================
   GỌI GEMINI
===================================================== */

async function generateQuestions(input: {
  apiKey: string;
  model: string;
  prompt: string;
  temperature: number;
}): Promise<unknown> {
  const endpoint =
    `${GEMINI_API_ROOT}/models/` +
    `${encodeURIComponent(input.model)}` +
    ":generateContent";

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
            parts: [
              {
                text: input.prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: input.temperature,
          responseMimeType:
            "application/json",
        },
      }),
    });
  } catch (error) {
    const connectionMessage = error instanceof Error
      ? error.message : "Lỗi kết nối chưa xác định";
    console.error("Lỗi kết nối Gemini:",
      connectionMessage.split(input.apiKey).join("[KEY REDACTED]"));

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
    const status = result.error?.status ?? "UNKNOWN";
    const reasons = (result.error?.details ?? [])
      .map(detail => detail.reason)
      .filter((reason): reason is string => typeof reason === "string")
      .join(", ");
    // Log only diagnostic fields, never credentials or the entire response.
    console.error("Lỗi Gemini sinh câu hỏi:", {
      httpStatus: response.status,
      status,
      reason: reasons || "Không có reason trong phản hồi Google",
    });
    const message = (result.error?.message ?? "Gemini không thể sinh câu hỏi.")
      .split(input.apiKey).join("[KEY REDACTED]");
    throw new Error(
      `Gemini HTTP ${response.status} / ${status}${reasons ? ` / ${reasons}` : ""}: ${message}`
    );
  }

  if (
    result.promptFeedback?.blockReason
  ) {
    throw new Error(
      `Gemini từ chối yêu cầu: ${result.promptFeedback.blockReason}.`
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
        ? `Gemini không trả câu hỏi. Lý do: ${finishReason}.`
        : "Gemini không trả về câu hỏi."
    );
  }

  try {
    return JSON.parse(
      removeMarkdownCodeFence(rawText)
    );
  } catch {
    console.error(
      "JSON câu hỏi không hợp lệ:",
      "Không ghi nội dung học liệu/câu hỏi vào log."
    );

    throw new Error(
      "Gemini trả về JSON câu hỏi không hợp lệ."
    );
  }
}

/* =====================================================
   API HANDLER
===================================================== */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      success: false,
      message:
        "Chỉ hỗ trợ phương thức POST.",
    });
  }

  try {
    const profile = await authenticatedProfile(req);
    const apiKey =
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message:
          "Chưa cấu hình GEMINI_API_KEY.",
      });
    }

    const model =
      getConfiguredModel();

    // Chỉ in mã băm rút gọn để đối chiếu; tuyệt đối không in khóa.
    console.log("Gemini runtime [auth-check-v1]:", {
      cwd: process.cwd(),
      apiRoot: GEMINI_API_ROOT,
      model,
      keyLength: apiKey.length,
      keyFingerprint: createHash("sha256")
        .update(apiKey, "utf8")
        .digest("hex")
        .slice(0, 12),
    });

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      throw new RequestError(400, "Nội dung yêu cầu không hợp lệ.");
    }
    const body = req.body as Partial<GenerateQuestionsRequest>;

    const temperature = body.temperature === undefined ? 0.35 : body.temperature;
    if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
      return res.status(400).json({ success: false, message: "Temperature phải là số từ 0 đến 1." });
    }

    const lessonCode = typeof body.lessonCode === "string" ? body.lessonCode.trim() : "";
    if (!lessonCode || lessonCode.includes("/") || lessonCode.length > 200) {
      throw new RequestError(400, "Mã bài học không hợp lệ.");
    }
    // Ignore client-supplied subject, grade and knowledge for authorization/prompt.
    const lessonSnapshot = await adminDb.collection("knowledge_repository").doc(lessonCode).get();
    const lesson = lessonSnapshot.data();
    if (!lessonSnapshot.exists || !lesson) {
      throw new RequestError(404, "Chưa tìm thấy học liệu đã lưu cho bài học này.");
    }
    const lessonTitle = typeof lesson.lessonTitle === "string" ? lesson.lessonTitle.trim() : "";
    const subject = typeof lesson.subject === "string" ? lesson.subject.trim() : "";
    const chapterTitle = typeof lesson.chapterTitle === "string" ? lesson.chapterTitle.trim() : "";
    const grade = Number(lesson.grade);

    if (
      !lessonCode ||
      !lessonTitle ||
      !subject ||
      !chapterTitle ||
      !Number.isInteger(grade) || grade < 6 || grade > 9
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Thông tin bài học chưa đầy đủ.",
      });
    }

    if (profile.role === "teacher") {
      const subjects = Array.isArray(profile.subjectCodes)
        ? profile.subjectCodes.filter((value: unknown): value is string => typeof value === "string").map(subjectKey) : [];
      const grades = Array.isArray(profile.gradeLevels) ? profile.gradeLevels.map(Number) : [];
      if (lesson.status !== "published" || !subjects.includes(subjectKey(subject)) || !grades.includes(grade)) {
        throw new RequestError(403, "Bài học chưa xuất bản hoặc nằm ngoài môn/khối được phân công.");
      }
    }

    const knowledge =
      normalizeKnowledge(
        lesson
      );

    if (
      !hasUsableKnowledge(knowledge)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Bài học chưa có dữ liệu tri thức để sinh câu hỏi.",
      });
    }

    let specifications: QuestionSpecification[];
    try {
      specifications = validateSpecifications(body.specifications);
    } catch {
      throw new RequestError(400, "Cấu hình dạng, mức độ hoặc số câu không hợp lệ (tối đa 50 câu).");
    }

    const requestedTotal =
      specifications.reduce(
        (sum, item) =>
          sum + item.count,
        0
      );

    const prompt = buildPrompt({
      lessonCode,
      lessonTitle,
      subject,
      grade,
      chapterTitle,
      knowledge,
      specifications,
    });

    console.log(
      "Sinh câu hỏi từ học liệu:",
      lessonCode
    );

    console.log(
      "Model:",
      model
    );

    console.log(
      "Số câu yêu cầu:",
      requestedTotal
    );

    const rawData =
      await generateQuestions({
        apiKey,
        model,
        prompt,
        temperature,
      });

    const questions =
      normalizeGeneratedQuestions(
        rawData,
        lessonCode,
        lessonTitle
      );

    if (questions.length === 0) {
      throw new Error(
        "AI không tạo được câu hỏi hợp lệ."
      );
    }

    if (
      questions.length !==
      requestedTotal
    ) {
      console.warn(
        `AI trả ${questions.length}/${requestedTotal} câu hợp lệ.`
      );
    }

    return res.status(200).json({
      success: true,
      questions,
      total: questions.length,
      model,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    console.error(
      "Lỗi API sinh câu hỏi:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Không thể sinh câu hỏi từ học liệu.",
    });
  }
}

// src/services/questionGeneratorService.ts
import { auth } from "@/lib/firebase";

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay";

export type QuestionLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export interface Objective {
  id: string;
  content: string;
}

export interface KnowledgeUnit {
  id: string;
  title: string;
  content: string;
}

export interface Keyword {
  id: string;
  word: string;
  meaning?: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
}

export interface Exercise {
  id: string;
  question: string;
  answer: string;
}

export interface KnowledgeData {
  objectives: Objective[];
  knowledgeUnits: KnowledgeUnit[];
  keywords: Keyword[];
  activities: Activity[];
  exercises: Exercise[];
}

export interface QuestionSpecification {
  type: QuestionType;
  level: QuestionLevel;
  count: number;
}

export interface GenerateQuestionsInput {
  lessonCode: string;
  lessonTitle: string;
  subject: string;
  grade: number;
  chapterTitle: string;
  knowledge: KnowledgeData;
  specifications: QuestionSpecification[];
  temperature?: number;
}

export interface GeneratedQuestion {
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

export interface GenerateQuestionsResult {
  questions: GeneratedQuestion[];
  total: number;
  model?: string;
}

interface GenerateQuestionsApiResponse {
  success: boolean;
  message?: string;
  questions?: GeneratedQuestion[];
  total?: number;
  model?: string;
}

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

const MAX_QUESTION_COUNT = 50;

function hasKnowledgeData(
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

function validateInput(
  input: GenerateQuestionsInput
): void {
  if (!input.lessonCode.trim()) {
    throw new Error("Thiếu mã bài học.");
  }

  if (!input.lessonTitle.trim()) {
    throw new Error("Thiếu tên bài học.");
  }

  if (!input.subject.trim()) {
    throw new Error("Thiếu tên môn học.");
  }

  if (
    !Number.isFinite(input.grade) ||
    input.grade <= 0
  ) {
    throw new Error("Khối lớp không hợp lệ.");
  }

  if (!input.chapterTitle.trim()) {
    throw new Error("Thiếu tên chương.");
  }

  if (!hasKnowledgeData(input.knowledge)) {
    throw new Error(
      "Bài học chưa có dữ liệu tri thức để sinh câu hỏi."
    );
  }

  if (
    !Array.isArray(input.specifications) ||
    input.specifications.length === 0
  ) {
    throw new Error(
      "Chưa cấu hình số lượng câu hỏi."
    );
  }

  let total = 0;

  input.specifications.forEach(
    (specification) => {
      if (
        !VALID_TYPES.includes(
          specification.type
        )
      ) {
        throw new Error(
          "Có dạng câu hỏi không hợp lệ."
        );
      }

      if (
        !VALID_LEVELS.includes(
          specification.level
        )
      ) {
        throw new Error(
          "Có mức độ câu hỏi không hợp lệ."
        );
      }

      if (
        !Number.isInteger(
          specification.count
        ) ||
        specification.count < 0
      ) {
        throw new Error(
          "Số lượng câu hỏi phải là số nguyên không âm."
        );
      }

      total += specification.count;
    }
  );

  if (total <= 0) {
    throw new Error(
      "Phải chọn ít nhất một câu hỏi."
    );
  }

  if (total > MAX_QUESTION_COUNT) {
    throw new Error(
      `Mỗi lần chỉ được sinh tối đa ${MAX_QUESTION_COUNT} câu hỏi.`
    );
  }
}

function normalizeQuestions(
  questions: unknown
): GeneratedQuestion[] {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.filter(
    (question): question is GeneratedQuestion => {
      if (
        typeof question !== "object" ||
        question === null
      ) {
        return false;
      }

      const item =
        question as Partial<GeneratedQuestion>;

      return (
        typeof item.id === "string" &&
        typeof item.lessonCode === "string" &&
        typeof item.lessonTitle === "string" &&
        typeof item.question === "string" &&
        typeof item.correctAnswer === "string" &&
        typeof item.explanation === "string" &&
        typeof item.type === "string" &&
        VALID_TYPES.includes(
          item.type as QuestionType
        ) &&
        typeof item.level === "string" &&
        VALID_LEVELS.includes(
          item.level as QuestionLevel
        ) &&
        Array.isArray(
          item.sourceKnowledgeIds
        )
      );
    }
  );
}

export async function generateQuestionsFromKnowledge(
  input: GenerateQuestionsInput
): Promise<GenerateQuestionsResult> {
  validateInput(input);

  const user = auth.currentUser;
  if (!user) {
    throw new Error("Bạn cần đăng nhập để sinh câu hỏi.");
  }
  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch {
    throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
  }
  if (auth.currentUser?.uid !== user.uid) {
    throw new Error("Phiên đăng nhập đã thay đổi. Hãy thử lại.");
  }

  let response: Response;

  try {
    response = await fetch(
      "/api/generate-questions-from-knowledge",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },

        body: JSON.stringify({
          lessonCode:
            input.lessonCode.trim(),

          lessonTitle:
            input.lessonTitle.trim(),

          subject:
            input.subject.trim(),

          grade:
            input.grade,

          chapterTitle:
            input.chapterTitle.trim(),

          knowledge:
            input.knowledge,

          temperature: input.temperature,
          specifications:
            input.specifications.filter(
              (item) => item.count > 0
            ),
        }),
      }
    );
  } catch (error) {
    console.error(
      "Lỗi kết nối API sinh câu hỏi:",
      error
    );

    throw new Error(
      "Không kết nối được máy chủ sinh câu hỏi."
    );
  }

  let result: GenerateQuestionsApiResponse;

  try {
    result =
      (await response.json()) as GenerateQuestionsApiResponse;
  } catch {
    throw new Error(
      "Máy chủ trả về dữ liệu không hợp lệ."
    );
  }

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Không thể sinh câu hỏi từ học liệu."
    );
  }

  const questions =
    normalizeQuestions(
      result.questions
    );

  if (questions.length === 0) {
    throw new Error(
      "AI không trả về câu hỏi hợp lệ."
    );
  }

  return {
    questions,
    total:
      typeof result.total === "number"
        ? result.total
        : questions.length,

    model:
      result.model,
  };
}

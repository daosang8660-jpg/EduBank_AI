import type { ExamSpecificationRequirement } from "@/services/examQuestionService";
import type {
  QuestionLevel,
  QuestionType,
} from "@/services/questionGeneratorService";

/* =====================================================
   CẤU HÌNH
===================================================== */

const COLLECTION_NAME = "exams";

/* =====================================================
   KIỂU DỮ LIỆU
===================================================== */

export type ExamType =
  | "15_minutes"
  | "midterm"
  | "final";

export type ExamStatus =
  | "draft"
  | "final";

export interface ExamMatrixItem {
  type: QuestionType;

  level: QuestionLevel;

  count: number;

  scorePerQuestion: number;
}

/*
 * Một ý trong hướng dẫn chấm.
 * Chủ yếu dùng cho câu tự luận.
 */
export interface ExamMarkingGuideItem {
  content: string;

  score: number;
}

/*
 * Câu hỏi đã được đưa vào một đề.
 *
 * Lưu snapshot nội dung câu hỏi thay vì chỉ lưu questionId.
 * Nhờ vậy đề cũ không bị thay đổi nếu ngân hàng câu hỏi
 * được chỉnh sửa về sau.
 */
export interface SavedExamQuestion {
  questionId: string;

  lessonCode: string;

  type: QuestionType;

  level: QuestionLevel;

  question: string;

  options: string[];

  correctAnswer: string;

  explanation: string;

  score: number;

  markingGuide: ExamMarkingGuideItem[];

  order: number;
}

/* =====================================================
   INPUT TẠO ĐỀ
===================================================== */

export interface SaveExamInput {
  examName: string;

  examType: ExamType;

  subjectId: string;

  subjectName: string;

  gradeId: string;

  grade: number;

  lessonCodes: string[];

  duration: number;

  totalScore: number;

  matrix: ExamMatrixItem[];
  specification?: ExamSpecificationRequirement[];
  specificationName?: string;

  questions: SavedExamQuestion[];

  /*
   * Mã đề gốc.
   * Sau này có thể thêm 102, 103, 104...
   */
  examCodes?: string[];

  createdBy?: string;

  status?: ExamStatus;
  examSemester?: "1" | "2";
}

/* =====================================================
   DỮ LIỆU ĐỀ ĐÃ LƯU
===================================================== */

export interface SavedExam
  extends SaveExamInput {
  id: string;
}

/* =====================================================
   KẾT QUẢ LƯU
===================================================== */

export interface SaveExamResult {
  success: boolean;

  examId: string;
}

/* =====================================================
   HÀM TIỆN ÍCH
===================================================== */

function normalizeText(
  value: string
): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createExamId(): string {
  const randomPart =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    `exam-` +
    `${Date.now()}-` +
    `${randomPart}`
  );
}

/* =====================================================
   KIỂM TRA MA TRẬN
===================================================== */

function validateMatrix(
  matrix: ExamMatrixItem[]
): void {
  if (
    !Array.isArray(matrix) ||
    matrix.length === 0
  ) {
    throw new Error(
      "Đề kiểm tra chưa có ma trận."
    );
  }

  for (const item of matrix) {
    if (
      !Number.isFinite(item.count) ||
      item.count < 0
    ) {
      throw new Error(
        "Số câu trong ma trận không hợp lệ."
      );
    }

    if (
      !Number.isFinite(
        item.scorePerQuestion
      ) ||
      item.scorePerQuestion < 0
    ) {
      throw new Error(
        "Điểm câu hỏi trong ma trận không hợp lệ."
      );
    }
  }
}

/* =====================================================
   KIỂM TRA CÂU HỎI
===================================================== */

function validateQuestions(
  questions: SavedExamQuestion[]
): void {
  if (
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    throw new Error(
      "Đề kiểm tra chưa có câu hỏi."
    );
  }

  for (const item of questions) {
    if (!item.questionId.trim()) {
      throw new Error(
        "Có câu hỏi chưa có ID."
      );
    }

    if (!item.question.trim()) {
      throw new Error(
        "Có câu hỏi chưa có nội dung."
      );
    }

    if (
      !Number.isFinite(item.score) ||
      item.score < 0
    ) {
      throw new Error(
        "Có câu hỏi có điểm không hợp lệ."
      );
    }
  }
}

/* =====================================================
   KIỂM TRA TOÀN BỘ ĐỀ
===================================================== */

export function validateExam(
  input: SaveExamInput
): void {
  if (!input.examName.trim()) {
    throw new Error(
      "Tên đề kiểm tra không được để trống."
    );
  }

  if (!input.subjectName.trim()) {
    throw new Error(
      "Môn học không hợp lệ."
    );
  }

  if (
    !Number.isFinite(input.grade) ||
    input.grade <= 0
  ) {
    throw new Error(
      "Khối lớp không hợp lệ."
    );
  }

  if (
    !Array.isArray(
      input.lessonCodes
    ) ||
    input.lessonCodes.length === 0
  ) {
    throw new Error(
      "Đề chưa có phạm vi kiến thức."
    );
  }

  if (
    !Number.isFinite(
      input.duration
    ) ||
    input.duration <= 0
  ) {
    throw new Error(
      "Thời gian làm bài không hợp lệ."
    );
  }

  if (
    Math.abs(
      input.totalScore - 10
    ) > 0.001
  ) {
    throw new Error(
      "Tổng điểm của đề phải bằng 10."
    );
  }

  validateMatrix(
    input.matrix
  );

  validateQuestions(
    input.questions
  );

  /*
   * Kiểm tra tổng điểm thực tế
   * của danh sách câu hỏi.
   */
  const questionScore =
    input.questions.reduce(
      (total, item) =>
        total + item.score,
      0
    );

  if (
    Math.abs(
      questionScore -
        input.totalScore
    ) > 0.001
  ) {
    throw new Error(
      `Tổng điểm câu hỏi là ${questionScore.toFixed(
        2
      )}, không khớp tổng điểm đề ${input.totalScore.toFixed(
        2
      )}.`
    );
  }
}

/* =====================================================
   CHUẨN HÓA DỮ LIỆU
===================================================== */

export function normalizeExam(
  input: SaveExamInput
): SaveExamInput {
  return {
    ...input,

    examName:
      normalizeText(
        input.examName
      ),

    subjectId:
      input.subjectId.trim(),

    subjectName:
      normalizeText(
        input.subjectName
      ),

    gradeId:
      input.gradeId.trim(),

    lessonCodes:
      Array.from(
        new Set(
          input.lessonCodes
            .map((code) =>
              normalizeText(code)
            )
            .filter(Boolean)
        )
      ),

    examCodes:
      input.examCodes?.length
        ? Array.from(
            new Set(
              input.examCodes
                .map((code) =>
                  normalizeText(code)
                )
                .filter(Boolean)
            )
          )
        : ["101"],

    createdBy:
      normalizeText(
        input.createdBy ??
          "teacher"
      ),

    status:
      input.status ?? "draft",

    matrix:
      input.matrix.map(
        (item) => ({
          ...item,
        })
      ),

    questions:
      input.questions.map(
        (item, index) => ({
          ...item,

          questionId:
            item.questionId.trim(),

          lessonCode:
            normalizeText(
              item.lessonCode
            ),

          question:
            normalizeText(
              item.question
            ),

          options:
            Array.isArray(
              item.options
            )
              ? item.options
                  .map((option) =>
                    normalizeText(
                      option
                    )
                  )
                  .filter(Boolean)
              : [],

          correctAnswer:
            normalizeText(
              item.correctAnswer
            ),

          explanation:
            normalizeText(
              item.explanation ?? ""
            ),

          markingGuide:
            Array.isArray(
              item.markingGuide
            )
              ? item.markingGuide
                  .map((guide) => ({
                    content:
                      normalizeText(
                        guide.content
                      ),

                    score:
                      guide.score,
                  }))
                  .filter(
                    (guide) =>
                      guide.content
                  )
              : [],

          order: index + 1,
        })
      ),
  };
}


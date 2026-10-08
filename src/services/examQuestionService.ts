import { getAllQuestionsForLesson } from "@/services/questionBankReadService";
export type ExamQuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay";

export type ExamQuestionLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export interface ExamMatrixRequirement {
  type: ExamQuestionType;
  level: ExamQuestionLevel;
  count: number;
}

export interface ExamBankQuestion {
  id: string;

  subject: string;
  grade: number;

  chapterTitle: string;

  lessonCode: string;
  lessonTitle: string;

  type: ExamQuestionType;
  level: ExamQuestionLevel;

  question: string;

  options?: string[];

  correctAnswer: string;

  explanation: string;

  sourceKnowledgeIds: string[];

  sourceType:
    | "ai"
    | "teacher_upload"
    | "manual";

  createdBy?: string;

  status: "approved";
}

export interface ExamMatrixCheckItem {
  type: ExamQuestionType;
  level: ExamQuestionLevel;

  required: number;

  available: number;

  missing: number;

  isEnough: boolean;
}

export interface ExamMatrixCheckResult {
  isEnough: boolean;

  totalRequired: number;

  totalAvailable: number;

  totalMissing: number;

  details: ExamMatrixCheckItem[];

  availableQuestions:
    ExamBankQuestion[];
}

/* =====================================================
   FIRESTORE
===================================================== */

const COLLECTION_NAME =
  "question_bank";

/* =====================================================
   HÀM TIỆN ÍCH
===================================================== */

function normalizeQuestion(
  id: string,
  data: Record<
    string,
    unknown
  >
): ExamBankQuestion | null {
  if (
    data.status !== "approved"
  ) {
    return null;
  }

  if (
    typeof data.question !==
      "string" ||
    !data.question.trim()
  ) {
    return null;
  }

  if (
    typeof data.lessonCode !==
      "string" ||
    !data.lessonCode.trim()
  ) {
    return null;
  }

  if (
    typeof data.type !==
      "string" ||
    typeof data.level !==
      "string"
  ) {
    return null;
  }

  const validTypes:
    ExamQuestionType[] = [
      "multiple_choice",
      "true_false",
      "short_answer",
      "essay",
    ];

  const validLevels:
    ExamQuestionLevel[] = [
      "recognition",
      "understanding",
      "application",
      "high_application",
    ];

  if (
    !validTypes.includes(
      data.type as ExamQuestionType
    )
  ) {
    return null;
  }

  if (
    !validLevels.includes(
      data.level as ExamQuestionLevel
    )
  ) {
    return null;
  }

  return {
    id,

    subject:
      typeof data.subject ===
      "string"
        ? data.subject
        : "",

    grade:
      typeof data.grade ===
      "number"
        ? data.grade
        : Number(
            data.grade ?? 0
          ),

    chapterTitle:
      typeof data.chapterTitle ===
      "string"
        ? data.chapterTitle
        : "",

    lessonCode:
      data.lessonCode,

    lessonTitle:
      typeof data.lessonTitle ===
      "string"
        ? data.lessonTitle
        : "",

    type:
      data.type as ExamQuestionType,

    level:
      data.level as ExamQuestionLevel,

    question:
      data.question.trim(),

    options:
      Array.isArray(
        data.options
      )
        ? data.options.filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
        : undefined,

    correctAnswer:
      typeof data.correctAnswer ===
      "string"
        ? data.correctAnswer
        : "",

    explanation:
      typeof data.explanation ===
      "string"
        ? data.explanation
        : "",

    sourceKnowledgeIds:
      Array.isArray(
        data.sourceKnowledgeIds
      )
        ? data.sourceKnowledgeIds.filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
        : [],

    sourceType:
      data.sourceType ===
        "teacher_upload" ||
      data.sourceType ===
        "manual"
        ? data.sourceType
        : "ai",

    createdBy:
      typeof data.createdBy ===
      "string"
        ? data.createdBy
        : undefined,

    status:
      "approved",
  };
}

/* =====================================================
   ĐỌC CÂU HỎI THEO PHẠM VI
===================================================== */

export async function getExamQuestionsByLessons(lessonCodes:string[]):Promise<ExamBankQuestion[]> {
  const result:ExamBankQuestion[]=[];
  for(const code of Array.from(new Set(lessonCodes.map(c=>c.trim()).filter(Boolean)))) {
    const questions=await getAllQuestionsForLesson(code);
    for(const item of questions) {
      const normalized=normalizeQuestion(item.id,item as unknown as Record<string,unknown>);
      if(normalized) result.push(normalized);
    }
  }
  return result;
}

/* =====================================================
   LỌC THEO MÔN / LỚP
===================================================== */

export function filterExamQuestionsBySubjectGrade(
  questions:
    ExamBankQuestion[],
  subject: string,
  grade: number
): ExamBankQuestion[] {
  const normalizedSubject =
    subject
      .trim()
      .toLowerCase();

  return questions.filter(
    (question) => {
      const sameSubject =
        question.subject
          .trim()
          .toLowerCase() ===
        normalizedSubject;

      const sameGrade =
        Number(
          question.grade
        ) === Number(grade);

      return (
        sameSubject &&
        sameGrade
      );
    }
  );
}

/* =====================================================
   KIỂM TRA MA TRẬN
===================================================== */

export async function checkExamMatrixAvailability(
  input: {
    lessonCodes: string[];

    subject: string;
    grade: number;

    matrix:
      ExamMatrixRequirement[];
  }
): Promise<
  ExamMatrixCheckResult
> {
  const {
    lessonCodes,
    subject,
    grade,
    matrix,
  } = input;

  const activeRequirements =
    matrix.filter(
      (item) =>
        item.count > 0
    );

  if (
    activeRequirements.length ===
    0
  ) {
    return {
      isEnough: false,

      totalRequired: 0,

      totalAvailable: 0,

      totalMissing: 0,

      details: [],

      availableQuestions: [],
    };
  }

  const allQuestions =
    await getExamQuestionsByLessons(
      lessonCodes
    );

  const availableQuestions =
    filterExamQuestionsBySubjectGrade(
      allQuestions,
      subject,
      grade
    );

  const details:
    ExamMatrixCheckItem[] =
    activeRequirements.map(
      (requirement) => {
        const available =
          availableQuestions.filter(
            (question) =>
              question.type ===
                requirement.type &&
              question.level ===
                requirement.level
          ).length;

        const missing =
          Math.max(
            requirement.count -
              available,
            0
          );

        return {
          type:
            requirement.type,

          level:
            requirement.level,

          required:
            requirement.count,

          available,

          missing,

          isEnough:
            available >=
            requirement.count,
        };
      }
    );

  const totalRequired =
    activeRequirements.reduce(
      (total, item) =>
        total + item.count,
      0
    );

  const totalAvailable =
    details.reduce(
      (total, item) =>
        total +
        Math.min(
          item.available,
          item.required
        ),
      0
    );

  const totalMissing =
    details.reduce(
      (total, item) =>
        total +
        item.missing,
      0
    );

  const isEnough =
    details.every(
      (item) =>
        item.isEnough
    );

  return {
    isEnough,

    totalRequired,

    totalAvailable,

    totalMissing,

    details,

    availableQuestions,
  };
}

/* =====================================================
   CHỌN NGẪU NHIÊN
===================================================== */

function shuffleArray<T>(
  items: T[]
): T[] {
  const result = [
    ...items,
  ];

  for (
    let index =
      result.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
          (index + 1)
      );

    [
      result[index],
      result[randomIndex],
    ] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
}

/* =====================================================
   SINH BỘ CÂU HỎI THEO MA TRẬN
===================================================== */

export async function generateExamQuestions(
  input: {
    lessonCodes: string[];

    subject: string;
    grade: number;

    matrix:
      ExamMatrixRequirement[];
  }
): Promise<
  ExamBankQuestion[]
> {
  const checkResult =
    await checkExamMatrixAvailability(
      input
    );

  if (
    !checkResult.isEnough
  ) {
    const missingDetails =
      checkResult.details
        .filter(
          (item) =>
            !item.isEnough
        )
        .map(
          (item) =>
            `${item.type} / ${item.level}: thiếu ${item.missing}`
        )
        .join(", ");

    throw new Error(
      `Ngân hàng chưa đủ câu hỏi theo ma trận. ${missingDetails}`
    );
  }

  const selectedQuestions:
    ExamBankQuestion[] = [];

  const selectedIds =
    new Set<string>();

  const activeRequirements =
    input.matrix.filter(
      (item) =>
        item.count > 0
    );

  for (
    const requirement of
      activeRequirements
  ) {
    const candidates =
      checkResult.availableQuestions.filter(
        (question) =>
          question.type ===
            requirement.type &&
          question.level ===
            requirement.level &&
          !selectedIds.has(
            question.id
          )
      );

    const shuffled =
      shuffleArray(
        candidates
      );

    const selected =
      shuffled.slice(
        0,
        requirement.count
      );

    if (
      selected.length <
      requirement.count
    ) {
      throw new Error(
        `Không đủ câu hỏi cho ${requirement.type} / ${requirement.level}.`
      );
    }

    selected.forEach(
      (question) => {
        selectedIds.add(
          question.id
        );

        selectedQuestions.push(
          question
        );
      }
    );
  }

  return selectedQuestions;
}

/* =====================================================
   THAY MỘT CÂU TRONG ĐỀ
===================================================== */

export async function getReplacementExamQuestion(
  input: {
    lessonCode: string;

    subject: string;
    grade: number;

    type: ExamQuestionType;
    level: ExamQuestionLevel;

    excludeQuestionIds?: string[];
  }
): Promise<ExamBankQuestion> {
  const {
    lessonCode,
    subject,
    grade,
    type,
    level,
    excludeQuestionIds = [],
  } = input;

  const safeLessonCode =
    lessonCode.trim();

  if (!safeLessonCode) {
    throw new Error(
      "Không xác định được bài học của câu cần thay."
    );
  }

  const questions =
    await getExamQuestionsByLessons([
      safeLessonCode,
    ]);

  const filteredBySubjectGrade =
    filterExamQuestionsBySubjectGrade(
      questions,
      subject,
      grade
    );

  const excludedIds =
    new Set(
      excludeQuestionIds
        .map((id) => id.trim())
        .filter(Boolean)
    );

  const candidates =
    filteredBySubjectGrade.filter(
      (question) =>
        question.type === type &&
        question.level === level &&
        !excludedIds.has(
          question.id
        )
    );

  if (candidates.length === 0) {
    throw new Error(
      "Không còn câu hỏi thay thế phù hợp trong ngân hàng cho cùng bài, dạng câu và mức độ."
    );
  }

  const shuffled =
    shuffleArray(candidates);

  return shuffled[0];
}

/* =====================================================
   SINH LẠI ĐỀ NHƯNG GIỮ CÂU ĐÃ KHÓA
===================================================== */

export async function generateExamQuestionsKeepingLocked(
  input: {
    lessonCodes: string[];

    subject: string;
    grade: number;

    matrix:
      ExamMatrixRequirement[];

    lockedQuestions:
      ExamBankQuestion[];
  }
): Promise<ExamBankQuestion[]> {
  const {
    lessonCodes,
    subject,
    grade,
    matrix,
    lockedQuestions,
  } = input;

  const activeRequirements =
    matrix.filter(
      (item) =>
        item.count > 0
    );

  if (
    activeRequirements.length ===
    0
  ) {
    return [];
  }

  /*
   * Kiểm tra số câu khóa không vượt
   * số lượng yêu cầu của từng ô ma trận.
   */
  for (
    const requirement of
    activeRequirements
  ) {
    const lockedCount =
      lockedQuestions.filter(
        (question) =>
          question.type ===
            requirement.type &&
          question.level ===
            requirement.level
      ).length;

    if (
      lockedCount >
      requirement.count
    ) {
      throw new Error(
        `Số câu đã khóa của ${requirement.type} / ${requirement.level} vượt số câu yêu cầu trong ma trận.`
      );
    }
  }

  const allQuestions =
    await getExamQuestionsByLessons(
      lessonCodes
    );

  const availableQuestions =
    filterExamQuestionsBySubjectGrade(
      allQuestions,
      subject,
      grade
    );

  const result:
    ExamBankQuestion[] = [
      ...lockedQuestions,
    ];

  const selectedIds =
    new Set(
      lockedQuestions.map(
        (question) =>
          question.id
      )
    );

  for (
    const requirement of
    activeRequirements
  ) {
    const lockedCount =
      lockedQuestions.filter(
        (question) =>
          question.type ===
            requirement.type &&
          question.level ===
            requirement.level
      ).length;

    const remainingCount =
      requirement.count -
      lockedCount;

    if (
      remainingCount <= 0
    ) {
      continue;
    }

    const candidates =
      availableQuestions.filter(
        (question) =>
          question.type ===
            requirement.type &&
          question.level ===
            requirement.level &&
          !selectedIds.has(
            question.id
          )
      );

    const shuffled =
      shuffleArray(
        candidates
      );

    const selected =
      shuffled.slice(
        0,
        remainingCount
      );

    if (
      selected.length <
      remainingCount
    ) {
      throw new Error(
        `Không đủ câu chưa khóa để sinh lại ${requirement.type} / ${requirement.level}.`
      );
    }

    selected.forEach(
      (question) => {
        selectedIds.add(
          question.id
        );

        result.push(
          question
        );
      }
    );
  }

  return result;
}



/* =====================================================
   MA TRẬN ĐẶC TẢ - ADMIN
===================================================== */

export interface ExamSpecificationRequirement {
  lessonCode: string;
  lessonTitle?: string;
  requirement?: string;
  type: ExamQuestionType;
  level: ExamQuestionLevel;
  count: number;
  scorePerQuestion: number;
}

export interface ExamSpecificationCheckItem
  extends ExamSpecificationRequirement {
  available: number;
  missing: number;
  isEnough: boolean;
}

export interface ExamSpecificationCheckResult {
  isEnough: boolean;
  totalRequired: number;
  totalAvailable: number;
  totalMissing: number;
  details: ExamSpecificationCheckItem[];
  availableQuestions: ExamBankQuestion[];
}

export async function checkExamSpecificationAvailability(
  input: {
    subject: string;
    grade: number;
    specification: ExamSpecificationRequirement[];
  }
): Promise<ExamSpecificationCheckResult> {
  const active = input.specification.filter(
    (item) =>
      item.lessonCode.trim() &&
      item.count > 0
  );

  const lessonCodes = Array.from(
    new Set(
      active.map((item) =>
        item.lessonCode.trim()
      )
    )
  );

  const allQuestions =
    await getExamQuestionsByLessons(
      lessonCodes
    );

  const availableQuestions =
    filterExamQuestionsBySubjectGrade(
      allQuestions,
      input.subject,
      input.grade
    );

  // Nhiều nội dung có thể được gắn cùng một bài; phải trừ số câu đã dành
  // cho các dòng trước để tránh báo đủ sai khi nguồn câu hỏi bị dùng chung.
  const reserved = new Map<string, number>();
  const details =
    active.map((item) => {
      const key = `${item.lessonCode.trim()}\u0000${item.type}\u0000${item.level}`;
      const previouslyReserved = reserved.get(key) ?? 0;
      const available =
        availableQuestions.filter(
          (question) =>
            question.lessonCode.trim() ===
              item.lessonCode.trim() &&
            question.type === item.type &&
            question.level === item.level
        ).length;

      const remaining = Math.max(0, available - previouslyReserved);
      reserved.set(key, previouslyReserved + item.count);
      const missing =
        Math.max(
          item.count - remaining,
          0
        );

      return {
        ...item,
        available: remaining,
        missing,
        isEnough:
          missing === 0,
      };
    });

  return {
    isEnough:
      details.every(
        (item) =>
          item.isEnough
      ),

    totalRequired:
      details.reduce(
        (sum, item) =>
          sum + item.count,
        0
      ),

    totalAvailable:
      details.reduce(
        (sum, item) =>
          sum +
          Math.min(
            item.available,
            item.count
          ),
        0
      ),

    totalMissing:
      details.reduce(
        (sum, item) =>
          sum + item.missing,
        0
      ),

    details,
    availableQuestions,
  };
}

export async function generateExamQuestionsFromSpecification(
  input: {
    subject: string;
    grade: number;
    specification: ExamSpecificationRequirement[];
  }
): Promise<ExamBankQuestion[]> {
  const check =
    await checkExamSpecificationAvailability(
      input
    );

  if (!check.isEnough) {
    const missingDetails =
      check.details
        .filter(
          (item) =>
            !item.isEnough
        )
        .map(
          (item) =>
            `${item.lessonCode} / ${item.type} / ${item.level}: thiếu ${item.missing}`
        )
        .join("; ");

    throw new Error(
      `Ngân hàng chưa đủ câu theo đặc tả. ${missingDetails}`
    );
  }

  const selected:
    ExamBankQuestion[] = [];

  const selectedIds =
    new Set<string>();

  for (
    const requirement of
    input.specification.filter(
      (item) =>
        item.count > 0
    )
  ) {
    const candidates =
      check.availableQuestions.filter(
        (question) =>
          question.lessonCode.trim() ===
            requirement.lessonCode.trim() &&
          question.type ===
            requirement.type &&
          question.level ===
            requirement.level &&
          !selectedIds.has(
            question.id
          )
      );

    const picked =
      shuffleArray(
        candidates
      ).slice(
        0,
        requirement.count
      );

    if (
      picked.length <
      requirement.count
    ) {
      throw new Error(
        `Không đủ câu cho ${requirement.lessonCode} / ${requirement.type} / ${requirement.level}.`
      );
    }

    picked.forEach(
      (question) => {
        selectedIds.add(
          question.id
        );

        selected.push(
          question
        );
      }
    );
  }

  return selected;
}

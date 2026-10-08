// src/services/questionImportService.ts

import type {
  QuestionLevel,
  QuestionType,
} from "@/services/questionGeneratorService";

/* =====================================================
   KIỂU DỮ LIỆU
===================================================== */

export interface ImportedQuestion {
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

export interface ImportQuestionsInput {
  file: File;

  lessonCode: string;
  lessonTitle: string;

  subject: string;
  grade: number;

  chapterTitle: string;
}

export interface ImportQuestionsResult {
  questions: ImportedQuestion[];

  model?: string;

  fileName?: string;

  rawText?: string;
}

/* =====================================================
   HÀM TIỆN ÍCH
===================================================== */

function createQuestionId(
  lessonCode: string,
  index: number
): string {
  return `${lessonCode}-upload-${Date.now()}-${index}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeText(
  value: unknown
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is string =>
        typeof item === "string"
    )
    .map((item) =>
      normalizeText(item)
    )
    .filter(Boolean);
}

/* =====================================================
   KIỂM TRA TYPE
===================================================== */

function normalizeQuestionType(
  value: unknown
): QuestionType {
  switch (value) {
    case "multiple_choice":
    case "true_false":
    case "short_answer":
    case "essay":
      return value;

    default:
      return "multiple_choice";
  }
}

function normalizeQuestionLevel(
  value: unknown
): QuestionLevel {
  switch (value) {
    case "recognition":
    case "understanding":
    case "application":
    case "high_application":
      return value;

    default:
      return "recognition";
  }
}

/* =====================================================
   CHUẨN HÓA PHƯƠNG ÁN
===================================================== */

function normalizeOptions(
  value: unknown,
  type: QuestionType
): string[] | undefined {
  if (
    type === "true_false"
  ) {
    return [
      "Đúng",
      "Sai",
    ];
  }

  if (
    type !==
    "multiple_choice"
  ) {
    return undefined;
  }

  const options =
    normalizeStringArray(
      value
    );

  if (
    options.length === 4
  ) {
    return options;
  }

  return [
    "Phương án A",
    "Phương án B",
    "Phương án C",
    "Phương án D",
  ];
}

/* =====================================================
   CHUẨN HÓA ĐÁP ÁN
===================================================== */

function normalizeCorrectAnswer(
  value: unknown,
  options:
    | string[]
    | undefined,
  type: QuestionType
): string {
  const answer =
    normalizeText(value);

  if (
    type ===
      "multiple_choice" &&
    options
  ) {
    if (
      /^[A-D]$/i.test(
        answer
      )
    ) {
      const index =
        answer
          .toUpperCase()
          .charCodeAt(0) - 65;

      return (
        options[index] ??
        options[0] ??
        ""
      );
    }

    if (
      options.includes(
        answer
      )
    ) {
      return answer;
    }

    return (
      options[0] ?? ""
    );
  }

  if (
    type ===
    "true_false"
  ) {
    const normalized =
      answer
        .toLowerCase();

    if (
      normalized ===
        "đúng" ||
      normalized ===
        "dung" ||
      normalized ===
        "true"
    ) {
      return "Đúng";
    }

    if (
      normalized ===
        "sai" ||
      normalized ===
        "false"
    ) {
      return "Sai";
    }

    return "Đúng";
  }

  return answer;
}

/* =====================================================
   CHUẨN HÓA MỘT CÂU
===================================================== */

function normalizeImportedQuestion(
  raw: unknown,
  index: number,
  input: ImportQuestionsInput
): ImportedQuestion | null {
  if (
    typeof raw !==
      "object" ||
    raw === null
  ) {
    return null;
  }

  const item =
    raw as {
      id?: unknown;
      type?: unknown;
      level?: unknown;
      question?: unknown;
      options?: unknown;
      correctAnswer?: unknown;
      explanation?: unknown;
      sourceKnowledgeIds?: unknown;
    };

  const question =
    normalizeText(
      item.question
    );

  if (!question) {
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

  const options =
    normalizeOptions(
      item.options,
      type
    );

  const correctAnswer =
    normalizeCorrectAnswer(
      item.correctAnswer,
      options,
      type
    );

  const explanation =
    normalizeText(
      item.explanation
    );

  const sourceKnowledgeIds =
    normalizeStringArray(
      item.sourceKnowledgeIds
    );

  const rawId =
    normalizeText(
      item.id
    );

  return {
    id:
      rawId ||
      createQuestionId(
        input.lessonCode,
        index
      ),

    lessonCode:
      input.lessonCode,

    lessonTitle:
      input.lessonTitle,

    type,

    level,

    question,

    ...(options
      ? {
          options,
        }
      : {}),

    correctAnswer,

    explanation,

    sourceKnowledgeIds,

    status:
      "draft",

    sourceType:
      "teacher_upload",
  };
}

/* =====================================================
   KIỂM TRA FILE
===================================================== */

function validateFile(
  file: File
): void {
  const fileName =
    file.name.toLowerCase();

  const isDocx =
    fileName.endsWith(
      ".docx"
    );

  const isPdf =
    fileName.endsWith(
      ".pdf"
    );

  if (
    !isDocx &&
    !isPdf
  ) {
    throw new Error(
      "Chỉ hỗ trợ file Word (.docx) và PDF (.pdf)."
    );
  }

  const maxSize =
    15 * 1024 * 1024;

  if (
    file.size >
    maxSize
  ) {
    throw new Error(
      "File quá lớn. Dung lượng tối đa là 15MB."
    );
  }
}

/* =====================================================
   GỌI API IMPORT
===================================================== */

export async function importQuestionsFromFile(
  input: ImportQuestionsInput
): Promise<
  ImportQuestionsResult
> {
  const {
    file,
    lessonCode,
    lessonTitle,
    subject,
    grade,
    chapterTitle,
  } = input;

  if (!file) {
    throw new Error(
      "Chưa chọn file câu hỏi."
    );
  }

  if (
    !lessonCode.trim()
  ) {
    throw new Error(
      "Thiếu mã bài học."
    );
  }

  if (
    !lessonTitle.trim()
  ) {
    throw new Error(
      "Thiếu tên bài học."
    );
  }

  if (
    !subject.trim()
  ) {
    throw new Error(
      "Thiếu môn học."
    );
  }

  if (
    !chapterTitle.trim()
  ) {
    throw new Error(
      "Thiếu tên chương."
    );
  }

  validateFile(file);

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "lessonCode",
    lessonCode
  );

  formData.append(
    "lessonTitle",
    lessonTitle
  );

  formData.append(
    "subject",
    subject
  );

  formData.append(
    "grade",
    String(grade)
  );

  formData.append(
    "chapterTitle",
    chapterTitle
  );

  const response =
    await fetch(
      "/api/analyzeDocument",
      {
        method: "POST",

        body:
          formData,
      }
    );

  let data:
    unknown = null;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "API không trả về dữ liệu JSON hợp lệ."
    );
  }

  if (
    !response.ok
  ) {
    const errorData =
      data as {
        error?: string;
        message?: string;
      };

    throw new Error(
      errorData.error ||
        errorData.message ||
        "Không thể phân tích file câu hỏi."
    );
  }

  const result =
    data as {
      questions?: unknown[];
      model?: string;
      fileName?: string;
      rawText?: string;
    };

  if (
    !Array.isArray(
      result.questions
    )
  ) {
    throw new Error(
      "API không trả về danh sách câu hỏi."
    );
  }

  const questions =
    result.questions
      .map(
        (
          item,
          index
        ) =>
          normalizeImportedQuestion(
            item,
            index,
            input
          )
      )
      .filter(
        (
          item
        ): item is ImportedQuestion =>
          item !== null
      );

  if (
    questions.length === 0
  ) {
    throw new Error(
      "Không tìm thấy câu hỏi hợp lệ trong file."
    );
  }

  return {
    questions,

    model:
      result.model,

    fileName:
      result.fileName ??
      file.name,

    rawText:
      result.rawText,
  };
}
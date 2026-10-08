import {
  getAllQuestionsForLesson,
  type QuestionBankItem,
} from "@/services/questionBankReadService";

/* =====================================================
   KIỂU DỮ LIỆU
===================================================== */

export type DuplicateMatchType =
  | "exact"
  | "near"
  | "clean";

export interface DuplicateCandidate {
  existingQuestion: QuestionBankItem;

  similarity: number;

  matchType:
    | "exact"
    | "near";
}

export interface DuplicateCheckInput {
  id: string;

  lessonCode: string;

  question: string;
}

export interface DuplicateCheckResult {
  questionId: string;

  lessonCode: string;

  question: string;

  matchType:
    DuplicateMatchType;

  exactMatches:
    DuplicateCandidate[];

  nearMatches:
    DuplicateCandidate[];

  allMatches:
    DuplicateCandidate[];

  // Mã câu xuất hiện trước trong cùng lần tải, nếu trùng chính xác.
  duplicateWithinBatchOf?: string;
}

export interface DuplicateBatchSummary {
  results:
    DuplicateCheckResult[];

  exactDuplicateIds:
    string[];

  nearDuplicateIds:
    string[];

  cleanIds:
    string[];

  exactCount: number;

  nearCount: number;

  cleanCount: number;
}

export interface DuplicateCheckOptions {
  nearThreshold?: number;

  maxMatchesPerQuestion?: number;
}

/* =====================================================
   CẤU HÌNH
===================================================== */

const DEFAULT_NEAR_THRESHOLD =
  0.78;

const DEFAULT_MAX_MATCHES =
  5;

/* =====================================================
   CHUẨN HÓA VĂN BẢN
===================================================== */

function normalizeText(
  value: string
): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/đ/g, "d")
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/* =====================================================
   TOKEN
===================================================== */

function tokenize(
  value: string
): string[] {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .filter(Boolean);
}

/* =====================================================
   JACCARD
===================================================== */

function calculateJaccardSimilarity(
  textA: string,
  textB: string
): number {
  const tokensA =
    new Set(
      tokenize(textA)
    );

  const tokensB =
    new Set(
      tokenize(textB)
    );

  if (
    tokensA.size === 0 &&
    tokensB.size === 0
  ) {
    return 1;
  }

  if (
    tokensA.size === 0 ||
    tokensB.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  tokensA.forEach(
    (token) => {
      if (
        tokensB.has(token)
      ) {
        intersection += 1;
      }
    }
  );

  const union =
    tokensA.size +
    tokensB.size -
    intersection;

  if (union <= 0) {
    return 0;
  }

  return (
    intersection /
    union
  );
}

/* =====================================================
   DICE BIGRAM
===================================================== */

function buildBigrams(
  value: string
): string[] {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return [];
  }

  if (
    normalized.length === 1
  ) {
    return [
      normalized,
    ];
  }

  const result:
    string[] = [];

  for (
    let index = 0;
    index <
    normalized.length - 1;
    index += 1
  ) {
    result.push(
      normalized.slice(
        index,
        index + 2
      )
    );
  }

  return result;
}

function calculateDiceSimilarity(
  textA: string,
  textB: string
): number {
  const bigramsA =
    buildBigrams(textA);

  const bigramsB =
    buildBigrams(textB);

  if (
    bigramsA.length === 0 &&
    bigramsB.length === 0
  ) {
    return 1;
  }

  if (
    bigramsA.length === 0 ||
    bigramsB.length === 0
  ) {
    return 0;
  }

  const counts =
    new Map<
      string,
      number
    >();

  bigramsA.forEach(
    (bigram) => {
      counts.set(
        bigram,
        (
          counts.get(
            bigram
          ) ?? 0
        ) + 1
      );
    }
  );

  let intersection = 0;

  bigramsB.forEach(
    (bigram) => {
      const count =
        counts.get(
          bigram
        ) ?? 0;

      if (
        count > 0
      ) {
        intersection += 1;

        counts.set(
          bigram,
          count - 1
        );
      }
    }
  );

  return (
    (
      2 *
      intersection
    ) /
    (
      bigramsA.length +
      bigramsB.length
    )
  );
}

/* =====================================================
   TƯƠNG ĐỒNG TỔNG HỢP
===================================================== */

export function calculateQuestionSimilarity(
  questionA: string,
  questionB: string
): number {
  const normalizedA =
    normalizeText(
      questionA
    );

  const normalizedB =
    normalizeText(
      questionB
    );

  if (
    !normalizedA ||
    !normalizedB
  ) {
    return 0;
  }

  if (
    normalizedA ===
    normalizedB
  ) {
    return 1;
  }

  const jaccard =
    calculateJaccardSimilarity(
      normalizedA,
      normalizedB
    );

  const dice =
    calculateDiceSimilarity(
      normalizedA,
      normalizedB
    );

  const score =
    jaccard * 0.55 +
    dice * 0.45;

  return Math.min(
    Math.max(
      score,
      0
    ),
    1
  );
}

/* =====================================================
   TRÙNG CHÍNH XÁC
===================================================== */

function isExactDuplicate(
  questionA: string,
  questionB: string
): boolean {
  const normalizedA =
    normalizeText(
      questionA
    );

  const normalizedB =
    normalizeText(
      questionB
    );

  if (
    !normalizedA ||
    !normalizedB
  ) {
    return false;
  }

  return (
    normalizedA ===
    normalizedB
  );
}

/* =====================================================
   KIỂM TRA MỘT CÂU SO VỚI NGÂN HÀNG
===================================================== */

export async function checkQuestionAgainstBank(
  input: DuplicateCheckInput,
  options:
    DuplicateCheckOptions = {},
  existingBankQuestions?: QuestionBankItem[]
): Promise<
  DuplicateCheckResult
> {
  const lessonCode =
    input.lessonCode.trim();

  const question =
    input.question.trim();

  if (!lessonCode) {
    throw new Error(
      "Thiếu mã bài học để kiểm tra trùng."
    );
  }

  if (!question) {
    throw new Error(
      "Nội dung câu hỏi đang trống."
    );
  }

  const nearThreshold =
    options.nearThreshold ??
    DEFAULT_NEAR_THRESHOLD;

  const maxMatches =
    options.maxMatchesPerQuestion ??
    DEFAULT_MAX_MATCHES;

  /*
   * Chỉ lấy câu APPROVED
   * cùng lessonCode từ question_bank.
   */
  const bankQuestions = existingBankQuestions ??
    await getAllQuestionsForLesson(lessonCode, 1000);

  const matches:
    DuplicateCandidate[] =
    [];

  for (
    const existingQuestion of
      bankQuestions
  ) {
    if (
      isExactDuplicate(
        question,
        existingQuestion.question
      )
    ) {
      matches.push({
        existingQuestion,

        similarity: 1,

        matchType:
          "exact",
      });

      continue;
    }

    const similarity =
      calculateQuestionSimilarity(
        question,
        existingQuestion.question
      );

    if (
      similarity >=
      nearThreshold
    ) {
      matches.push({
        existingQuestion,

        similarity,

        matchType:
          "near",
      });
    }
  }

  const sortedMatches =
    matches
      .sort(
        (
          itemA,
          itemB
        ) =>
          itemB.similarity -
          itemA.similarity
      )
      .slice(
        0,
        maxMatches
      );

  const exactMatches =
    sortedMatches.filter(
      (item) =>
        item.matchType ===
        "exact"
    );

  const nearMatches =
    sortedMatches.filter(
      (item) =>
        item.matchType ===
        "near"
    );

  let matchType:
    DuplicateMatchType =
      "clean";

  if (
    exactMatches.length > 0
  ) {
    matchType =
      "exact";
  } else if (
    nearMatches.length > 0
  ) {
    matchType =
      "near";
  }

  return {
    questionId:
      input.id,

    lessonCode,

    question,

    matchType,

    exactMatches,

    nearMatches,

    allMatches:
      sortedMatches,
  };
}

/* =====================================================
   KIỂM TRA NHIỀU CÂU
===================================================== */

export async function checkQuestionsDuplicateBatch(
  questions:
    DuplicateCheckInput[],
  options:
    DuplicateCheckOptions = {}
): Promise<
  DuplicateCheckResult[]
> {
  if (
    !Array.isArray(
      questions
    ) ||
    questions.length === 0
  ) {
    return [];
  }

  // Đọc ngân hàng một lần cho mỗi bài học, rồi kiểm tra cả các câu
  // trong cùng lần tải. Giữ câu xuất hiện đầu tiên khi trùng chính xác.
  const bankByLesson = new Map<string, QuestionBankItem[]>();
  const firstByQuestion = new Map<string, string>();
  const results: DuplicateCheckResult[] = [];

  for (const question of questions) {
    const lessonCode = question.lessonCode.trim();
    if (!bankByLesson.has(lessonCode)) {
      bankByLesson.set(lessonCode,
        await getAllQuestionsForLesson(lessonCode, 1000));
    }
    const result = await checkQuestionAgainstBank(
      question, options, bankByLesson.get(lessonCode)
    );
    const normalized = normalizeText(question.question);
    if (normalized) {
      const key = `${lessonCode}\u0000${normalized}`;
      const earlierId = firstByQuestion.get(key);
      if (earlierId) {
        result.duplicateWithinBatchOf = earlierId;
        result.matchType = "exact";
      } else {
        firstByQuestion.set(key, question.id);
      }
    }
    results.push(result);
  }

  return results;
}

/* =====================================================
   TÓM TẮT
===================================================== */

export function summarizeDuplicateResults(
  results:
    DuplicateCheckResult[]
): DuplicateBatchSummary {
  const exactDuplicateIds:
    string[] = [];

  const nearDuplicateIds:
    string[] = [];

  const cleanIds:
    string[] = [];

  results.forEach(
    (item) => {
      if (
        item.matchType ===
        "exact"
      ) {
        exactDuplicateIds.push(
          item.questionId
        );

        return;
      }

      if (
        item.matchType ===
        "near"
      ) {
        nearDuplicateIds.push(
          item.questionId
        );

        return;
      }

      cleanIds.push(
        item.questionId
      );
    }
  );

  return {
    results,

    exactDuplicateIds,

    nearDuplicateIds,

    cleanIds,

    exactCount:
      exactDuplicateIds.length,

    nearCount:
      nearDuplicateIds.length,

    cleanCount:
      cleanIds.length,
  };
}
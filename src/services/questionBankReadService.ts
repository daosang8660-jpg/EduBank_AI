import { educationRequest } from "@/services/educationApiClient";
import type {
  QuestionLevel,
  QuestionType,
} from "@/services/questionGeneratorService";

/* =====================================================
   KIỂU DỮ LIỆU
===================================================== */

export type QuestionSourceType =
  | "ai"
  | "teacher_upload"
  | "manual";

export type QuestionBankStatus =
  | "approved"
  | "inactive";

export interface QuestionBankItem {
  id: string;

  subject: string;
  grade: number;

  chapterTitle: string;

  lessonCode: string;
  lessonTitle: string;

  type: QuestionType;
  level: QuestionLevel;

  question: string;

  options?: string[];

  correctAnswer: string;

  explanation: string;

  sourceKnowledgeIds: string[];

  sourceType: QuestionSourceType;

  status: QuestionBankStatus;

  createdBy?: string;
  canEdit?: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuestionBankFilter {
  subject?: string;

  grade?: number;

  chapterTitle?: string;

  lessonCode?: string;

  type?: QuestionType;

  level?: QuestionLevel;

  sourceType?: QuestionSourceType;

  status?: QuestionBankStatus;

  maxResults?: number;
}

export interface QuestionBankStatistics {
  total: number;

  byType: Record<
    QuestionType,
    number
  >;

  byLevel: Record<
    QuestionLevel,
    number
  >;

  bySource: Record<
    QuestionSourceType,
    number
  >;
}

/* =====================================================
   CẤU HÌNH
===================================================== */

const DEFAULT_MAX_RESULTS = 300;
const MAX_RESULTS = 1000;

/* =====================================================
   HÀM TIỆN ÍCH
===================================================== */

function normalizeText(
  value: unknown
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function normalizeStringArray(
  value: unknown
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

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

function normalizeSourceType(
  value: unknown
): QuestionSourceType {
  switch (value) {
    case "ai":
    case "teacher_upload":
    case "manual":
      return value;

    default:
      return "manual";
  }
}

function normalizeStatus(
  value: unknown
): QuestionBankStatus {
  if (
    value === "inactive"
  ) {
    return "inactive";
  }

  return "approved";
}

function getSafeLimit(
  value?: number
): number {
  if (
    !value ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(
    Math.max(
      Math.floor(value),
      1
    ),
    MAX_RESULTS
  );
}

function getTimestampMilliseconds(
  value: unknown
): number {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return 0;
  }

  const timestamp =
    value as {
      toMillis?: () => number;
      seconds?: number;
    };

  if (
    typeof timestamp.toMillis ===
    "function"
  ) {
    return timestamp.toMillis();
  }

  if (
    typeof timestamp.seconds ===
    "number"
  ) {
    return (
      timestamp.seconds *
      1000
    );
  }

  return 0;
}

export function normalizeQuestionBankItem(
  id: string,
  data: Record<
    string,
    unknown
  >
): QuestionBankItem {
  const type =
    normalizeQuestionType(
      data.type
    );

  const options =
    normalizeStringArray(
      data.options
    );

  return {
    id,

    subject:
      normalizeText(
        data.subject
      ),

    grade:
      typeof data.grade ===
      "number"
        ? data.grade
        : Number(
            data.grade
          ) || 0,

    chapterTitle:
      normalizeText(
        data.chapterTitle
      ),

    lessonCode:
      normalizeText(
        data.lessonCode
      ),

    lessonTitle:
      normalizeText(
        data.lessonTitle
      ),

    type,

    level:
      normalizeQuestionLevel(
        data.level
      ),

    question:
      normalizeText(
        data.question
      ),

    ...(type ===
        "multiple_choice" ||
      type === "true_false"
      ? {
          options,
        }
      : {}),

    correctAnswer:
      normalizeText(
        data.correctAnswer
      ),

    explanation:
      normalizeText(
        data.explanation
      ),

    sourceKnowledgeIds:
      normalizeStringArray(
        data.sourceKnowledgeIds
      ),

    sourceType:
      normalizeSourceType(
        data.sourceType
      ),

    status:
      normalizeStatus(
        data.status
      ),

    createdBy:
      normalizeText(
        data.createdBy
      ),

    canEdit: data.canEdit === true,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =====================================================
   ĐỌC NGÂN HÀNG CÂU HỎI
===================================================== */

export async function getQuestionBank(filter:QuestionBankFilter={}): Promise<QuestionBankItem[]> {
  const params=new URLSearchParams();
  for(const key of ["subject","grade","chapterTitle","lessonCode","type","level","sourceType","status"] as const)
    if(filter[key]!==undefined && String(filter[key]).trim()) params.set(key,String(filter[key]).trim());
  params.set("maxResults",String(getSafeLimit(filter.maxResults)));
  const result=await educationRequest(`/api/question-bank?${params}`);
  if(!Array.isArray(result.items)) throw new Error("Danh sách câu hỏi không hợp lệ.");
  return result.items.map(item=>normalizeQuestionBankItem(item.id,item)).sort((a:QuestionBankItem,b:QuestionBankItem)=>getTimestampMilliseconds(b.updatedAt??b.createdAt)-getTimestampMilliseconds(a.updatedAt??a.createdAt));
}

// No silent truncation when assembling exams or checking duplicates.
export async function getAllQuestionsForLesson(lessonCode:string, _legacyMaxResults?:number): Promise<QuestionBankItem[]> {
  const params=new URLSearchParams({lessonCode:lessonCode.trim(),status:"approved",maxResults:"1000"});
  const items:QuestionBankItem[]=[];
  let cursor:string|undefined;
  do {
    if(cursor) params.set("cursor",cursor);
    const result=await educationRequest(`/api/question-bank?${params}`);
    if(!Array.isArray(result.items)) throw new Error("Danh sách câu hỏi không hợp lệ.");
    items.push(...result.items.map(item=>normalizeQuestionBankItem(item.id,item)));
    cursor=typeof result.nextCursor==="string" ? result.nextCursor : undefined;
  } while(cursor);
  return items;
}

/* =====================================================
   ĐỌC THEO BÀI HỌC
===================================================== */

export async function getQuestionsByLessonCode(
  lessonCode: string,
  maxResults = 300
): Promise<
  QuestionBankItem[]
> {
  const normalizedLessonCode =
    lessonCode.trim();

  if (
    !normalizedLessonCode
  ) {
    return [];
  }

  return getQuestionBank({
    lessonCode:
      normalizedLessonCode,

    status:
      "approved",

    maxResults,
  });
}

/* =====================================================
   ĐỌC THEO MÔN + LỚP
===================================================== */

export async function getQuestionsBySubjectAndGrade(
  subject: string,
  grade: number,
  maxResults = 500
): Promise<
  QuestionBankItem[]
> {
  const normalizedSubject =
    subject.trim();

  if (
    !normalizedSubject ||
    !Number.isFinite(grade)
  ) {
    return [];
  }

  return getQuestionBank({
    subject:
      normalizedSubject,

    grade,

    status:
      "approved",

    maxResults,
  });
}

/* =====================================================
   THỐNG KÊ NGÂN HÀNG CÂU HỎI
===================================================== */

export function buildQuestionBankStatistics(
  questions: QuestionBankItem[]
): QuestionBankStatistics {
  const statistics:
    QuestionBankStatistics = {
      total:
        questions.length,

      byType: {
        multiple_choice: 0,
        true_false: 0,
        short_answer: 0,
        essay: 0,
      },

      byLevel: {
        recognition: 0,
        understanding: 0,
        application: 0,
        high_application: 0,
      },

      bySource: {
        ai: 0,
        teacher_upload: 0,
        manual: 0,
      },
    };

  questions.forEach(
    (question) => {
      statistics.byType[
        question.type
      ] += 1;

      statistics.byLevel[
        question.level
      ] += 1;

      statistics.bySource[
        question.sourceType
      ] += 1;
    }
  );

  return statistics;
}
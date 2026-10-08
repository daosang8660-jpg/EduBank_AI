// =====================================================
// EduBank AI - AI Importer Service
// Chuẩn hóa học liệu qua /api/analyze-lesson
// =====================================================

/* =====================================================
   TYPES - DỮ LIỆU CHUẨN HÓA
===================================================== */

export interface AnalyzedObjective {
  id: string;
  content: string;
}

export interface AnalyzedKnowledgeUnit {
  id: string;
  title: string;
  content: string;
}

export interface AnalyzedKeyword {
  id: string;
  word: string;
  meaning: string;
}

export interface AnalyzedActivity {
  id: string;
  title: string;
  description: string;
}

export interface AnalyzedExercise {
  id: string;
  question: string;
  answer: string;
}

export interface AnalyzedLesson {
  objectives: AnalyzedObjective[];

  knowledgeUnits: AnalyzedKnowledgeUnit[];

  keywords: AnalyzedKeyword[];

  activities: AnalyzedActivity[];

  exercises: AnalyzedExercise[];
}

/* =====================================================
   INPUT
===================================================== */

export interface AnalyzeLessonInput {
  file: File;

  lessonCode: string;

  lessonTitle: string;

  subject: string;

  grade: number;

  chapterTitle: string;
}

/* =====================================================
   OUTPUT
===================================================== */

export interface AnalyzeLessonResult {
  data: AnalyzedLesson;

  fileInfo?: {
    fileName: string;

    characterCount: number;
  };
}

/* =====================================================
   API RESPONSE
===================================================== */

interface AnalyzeLessonApiResponse {
  success?: boolean;

  data?: unknown;

  fileInfo?: {
    fileName?: unknown;

    characterCount?: unknown;
  };

  message?: string;

  error?: string;
}

/* =====================================================
   CONFIG
===================================================== */

const ANALYZE_LESSON_API_URL =
  "/api/analyze-lesson";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
];

/* =====================================================
   NORMALIZE TEXT
===================================================== */

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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* =====================================================
   ARRAY
===================================================== */

function asArray(
  value: unknown
): unknown[] {
  return Array.isArray(
    value
  )
    ? value
    : [];
}

/* =====================================================
   FILE EXTENSION
===================================================== */

function getFileExtension(
  fileName: string
): string {
  const parts =
    fileName
      .toLowerCase()
      .split(".");

  if (
    parts.length < 2
  ) {
    return "";
  }

  return (
    parts.pop() ?? ""
  );
}

/* =====================================================
   VALIDATE FILE
===================================================== */

function validateFile(
  file: File
): void {
  if (
    !file ||
    !file.name
  ) {
    throw new Error(
      "Chưa chọn tệp học liệu."
    );
  }

  if (
    file.size <= 0
  ) {
    throw new Error(
      "Tệp học liệu đang trống."
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      "Tệp học liệu vượt quá 25 MB."
    );
  }

  const extension =
    getFileExtension(
      file.name
    );

  if (
    !ALLOWED_EXTENSIONS.includes(
      extension
    )
  ) {
    throw new Error(
      "Chỉ hỗ trợ TXT, PDF, JPG, JPEG, PNG và WEBP."
    );
  }
}

/* =====================================================
   VALIDATE INPUT
===================================================== */

function validateInput(
  input: AnalyzeLessonInput
): void {
  validateFile(
    input.file
  );

  if (
    !input.lessonCode
      .trim()
  ) {
    throw new Error(
      "Thiếu mã bài học."
    );
  }

  if (
    !input.lessonTitle
      .trim()
  ) {
    throw new Error(
      "Thiếu tên bài học."
    );
  }

  if (
    !input.subject
      .trim()
  ) {
    throw new Error(
      "Thiếu tên môn học."
    );
  }

  if (
    !Number.isFinite(
      input.grade
    ) ||
    input.grade <= 0
  ) {
    throw new Error(
      "Khối lớp không hợp lệ."
    );
  }

  if (
    !input.chapterTitle
      .trim()
  ) {
    throw new Error(
      "Thiếu tên chương/chủ đề."
    );
  }
}

/* =====================================================
   NORMALIZE OBJECTIVES
===================================================== */

function normalizeObjectives(
  value: unknown
): AnalyzedObjective[] {
  return asArray(
    value
  )
    .map(
      (
        raw,
        index
      ) => {
        if (
          typeof raw !==
            "object" ||
          raw === null
        ) {
          return null;
        }

        const item =
          raw as Record<
            string,
            unknown
          >;

        const content =
          normalizeText(
            item.content
          );

        if (!content) {
          return null;
        }

        return {
          id:
            normalizeText(
              item.id
            ) ||
            `objective-${index + 1}`,

          content,
        };
      }
    )
    .filter(
      (
        item
      ): item is
        AnalyzedObjective =>
        item !== null
    );
}

/* =====================================================
   NORMALIZE KNOWLEDGE
===================================================== */

function normalizeKnowledgeUnits(
  value: unknown
): AnalyzedKnowledgeUnit[] {
  return asArray(
    value
  )
    .map(
      (
        raw,
        index
      ) => {
        if (
          typeof raw !==
            "object" ||
          raw === null
        ) {
          return null;
        }

        const item =
          raw as Record<
            string,
            unknown
          >;

        const content =
          normalizeText(
            item.content
          );

        if (!content) {
          return null;
        }

        return {
          id:
            normalizeText(
              item.id
            ) ||
            `knowledge-${index + 1}`,

          title:
            normalizeText(
              item.title
            ) ||
            `Nội dung ${index + 1}`,

          content,
        };
      }
    )
    .filter(
      (
        item
      ): item is
        AnalyzedKnowledgeUnit =>
        item !== null
    );
}

/* =====================================================
   NORMALIZE KEYWORDS
===================================================== */

function normalizeKeywords(
  value: unknown
): AnalyzedKeyword[] {
  return asArray(
    value
  )
    .map(
      (
        raw,
        index
      ) => {
        if (
          typeof raw !==
            "object" ||
          raw === null
        ) {
          return null;
        }

        const item =
          raw as Record<
            string,
            unknown
          >;

        const word =
          normalizeText(
            item.word
          );

        if (!word) {
          return null;
        }

        return {
          id:
            normalizeText(
              item.id
            ) ||
            `keyword-${index + 1}`,

          word,

          meaning:
            normalizeText(
              item.meaning
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is
        AnalyzedKeyword =>
        item !== null
    );
}

/* =====================================================
   NORMALIZE ACTIVITIES
===================================================== */

function normalizeActivities(
  value: unknown
): AnalyzedActivity[] {
  return asArray(
    value
  )
    .map(
      (
        raw,
        index
      ) => {
        if (
          typeof raw !==
            "object" ||
          raw === null
        ) {
          return null;
        }

        const item =
          raw as Record<
            string,
            unknown
          >;

        const description =
          normalizeText(
            item.description
          );

        if (!description) {
          return null;
        }

        return {
          id:
            normalizeText(
              item.id
            ) ||
            `activity-${index + 1}`,

          title:
            normalizeText(
              item.title
            ) ||
            `Hoạt động ${index + 1}`,

          description,
        };
      }
    )
    .filter(
      (
        item
      ): item is
        AnalyzedActivity =>
        item !== null
    );
}

/* =====================================================
   NORMALIZE EXERCISES
===================================================== */

function normalizeExercises(
  value: unknown
): AnalyzedExercise[] {
  return asArray(
    value
  )
    .map(
      (
        raw,
        index
      ) => {
        if (
          typeof raw !==
            "object" ||
          raw === null
        ) {
          return null;
        }

        const item =
          raw as Record<
            string,
            unknown
          >;

        const question =
          normalizeText(
            item.question
          );

        if (!question) {
          return null;
        }

        return {
          id:
            normalizeText(
              item.id
            ) ||
            `exercise-${index + 1}`,

          question,

          answer:
            normalizeText(
              item.answer
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is
        AnalyzedExercise =>
        item !== null
    );
}

/* =====================================================
   NORMALIZE ANALYZED LESSON
===================================================== */

function normalizeAnalyzedLesson(
  value: unknown
): AnalyzedLesson {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    throw new Error(
      "API trả về dữ liệu học liệu không đúng cấu trúc."
    );
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  return {
    objectives:
      normalizeObjectives(
        data.objectives
      ),

    knowledgeUnits:
      normalizeKnowledgeUnits(
        data.knowledgeUnits
      ),

    keywords:
      normalizeKeywords(
        data.keywords
      ),

    activities:
      normalizeActivities(
        data.activities
      ),

    exercises:
      normalizeExercises(
        data.exercises
      ),
  };
}

/* =====================================================
   NORMALIZE FILE INFO
===================================================== */

function normalizeFileInfo(
  value:
    AnalyzeLessonApiResponse["fileInfo"]
): AnalyzeLessonResult["fileInfo"] {
  if (!value) {
    return undefined;
  }

  const fileName =
    normalizeText(
      value.fileName
    );

  const characterCount =
    Number(
      value.characterCount
    );

  if (
    !fileName
  ) {
    return undefined;
  }

  return {
    fileName,

    characterCount:
      Number.isFinite(
        characterCount
      )
        ? characterCount
        : 0,
  };
}

/* =====================================================
   ANALYZE LESSON
===================================================== */

export async function analyzeLesson(
  input: AnalyzeLessonInput
): Promise<AnalyzeLessonResult> {
  validateInput(
    input
  );

  /* ---------------------------------------------
     BUILD FORM DATA
  --------------------------------------------- */

  const formData =
    new FormData();

  formData.append(
    "file",
    input.file
  );

  formData.append(
    "lessonCode",
    input.lessonCode.trim()
  );

  formData.append(
    "lessonTitle",
    input.lessonTitle.trim()
  );

  formData.append(
    "subject",
    input.subject.trim()
  );

  formData.append(
    "grade",
    String(
      input.grade
    )
  );

  formData.append(
    "chapterTitle",
    input.chapterTitle.trim()
  );

  /* ---------------------------------------------
     FETCH
  --------------------------------------------- */

  let response:
    Response;

  try {
    response =
      await fetch(
        ANALYZE_LESSON_API_URL,
        {
          method:
            "POST",

          body:
            formData,
        }
      );
  } catch (
    error
  ) {
    console.error(
      "Lỗi kết nối API chuẩn hóa học liệu:",
      error
    );

    throw new Error(
      "Không kết nối được máy chủ chuẩn hóa học liệu."
    );
  }

  /* ---------------------------------------------
     READ RAW RESPONSE
  --------------------------------------------- */

  let rawText =
    "";

  try {
    rawText =
      await response.text();
  } catch (
    error
  ) {
    console.error(
      "Không đọc được response của API chuẩn hóa:",
      error
    );

    throw new Error(
      `Không đọc được phản hồi từ máy chủ. HTTP ${response.status}.`
    );
  }

  console.log(
    "AI Import API status:",
    response.status
  );

  console.log(
    "AI Import API raw response:",
    rawText
  );

  /* ---------------------------------------------
     PARSE JSON
  --------------------------------------------- */

  let result:
    AnalyzeLessonApiResponse;

  try {
    result =
      JSON.parse(
        rawText
      ) as AnalyzeLessonApiResponse;
  } catch (
    error
  ) {
    console.error(
      "API chuẩn hóa trả response không phải JSON:",
      {
        status:
          response.status,

        rawText,
      }
    );

    throw new Error(
      `API chuẩn hóa không trả về JSON hợp lệ. HTTP ${response.status}. ` +
        `Phản hồi: ${rawText.slice(
          0,
          500
        )}`
    );
  }

  /* ---------------------------------------------
     API ERROR
  --------------------------------------------- */

  if (
    !response.ok ||
    result.success === false
  ) {
    const message =
      normalizeText(
        result.error
      ) ||
      normalizeText(
        result.message
      ) ||
      `Không thể chuẩn hóa học liệu. HTTP ${response.status}.`;

    throw new Error(
      message
    );
  }

  /* ---------------------------------------------
     DATA CHECK
  --------------------------------------------- */

  if (!result.data) {
    throw new Error(
      "API không trả về dữ liệu học liệu."
    );
  }

  /* ---------------------------------------------
     NORMALIZE RESULT
  --------------------------------------------- */

  const data =
    normalizeAnalyzedLesson(
      result.data
    );

  const fileInfo =
    normalizeFileInfo(
      result.fileInfo
    );

  /* ---------------------------------------------
     RETURN
  --------------------------------------------- */

  return {
    data,

    ...(fileInfo
      ? {
          fileInfo,
        }
      : {}),
  };
}
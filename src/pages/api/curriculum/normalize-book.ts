import { requireTextbookAdmin, downloadTextbook, type TextbookFile, TextbookRequestError } from "@/lib/textbookStorageServer";
import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import formidable, {
  type File as FormidableFile,
} from "formidable";

import {
  promises as fs,
} from "fs";

import path from "path";


/* =====================================================
   NEXT CONFIG
===================================================== */

export const config = {
  api: {
    bodyParser: false,
  },

  /*
   * Có tác dụng trên nền tảng hỗ trợ maxDuration.
   * Local dev không bị giới hạn bởi giá trị này.
   */
  maxDuration: 300,
};

/* =====================================================
   TYPES - CURRICULUM INPUT
===================================================== */

interface NormalizeBookLesson {
  id?: string;

  lessonCode: string;

  lessonNo: number;

  title: string;

  startPage?: number;

  endPage?: number;

  status?: string;
}

interface NormalizeBookChapter {
  id?: string;

  chapterNo: number;

  title: string;

  lessons: NormalizeBookLesson[];
}

interface NormalizationJob {
  chapterTitle: string;

  lessonCode: string;

  lessonNo: number;

  lessonTitle: string;

  startPage: number;

  endPage: number;
}

/* =====================================================
   TYPES - KNOWLEDGE
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

  meaning: string;
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

interface AnalyzedLesson {
  objectives: Objective[];

  knowledgeUnits:
    KnowledgeUnit[];

  keywords: Keyword[];

  activities: Activity[];

  exercises: Exercise[];
}

/* =====================================================
   TYPES - API RESPONSE
===================================================== */

interface NormalizeBookLessonResult {
  lessonCode: string;

  title: string;

  chapterTitle: string;

  startPage: number;

  endPage: number;

  status:
    | "success"
    | "failed";

  data?: AnalyzedLesson;

  message?: string;
}

interface NormalizeBookSuccessResponse {
  success: true;

  curriculumId: string;

  subjectCode: string;

  subjectName: string;

  grade: number;

  total: number;

  completed: number;

  failed: number;

  model: string;

  results:
    NormalizeBookLessonResult[];
}

interface NormalizeBookErrorResponse {
  success: false;

  error: string;
}

type ApiResponse =
  | NormalizeBookSuccessResponse
  | NormalizeBookErrorResponse;

/* =====================================================
   TYPES - GEMINI
===================================================== */

interface GeminiModel {
  name?: string;

  supportedGenerationMethods?:
    string[];
}

interface GeminiModelsResponse {
  models?: GeminiModel[];

  error?: {
    code?: number;

    message?: string;

    status?: string;
  };
}

interface GeminiFileInfo {
  name?: string;

  uri?: string;

  mimeType?: string;

  state?: string;

  error?: {
    code?: number;

    message?: string;
  };
}

interface GeminiUploadResponse {
  file?: GeminiFileInfo;

  error?: {
    code?: number;

    message?: string;

    status?: string;
  };
}

interface GeminiGenerateResponse {
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

/* =====================================================
   CONFIG
===================================================== */

const MAX_FILE_SIZE =
  50 * 1024 * 1024;

const GEMINI_API_ROOT =
  "https://generativelanguage.googleapis.com/v1beta";

const GEMINI_UPLOAD_ROOT =
  "https://generativelanguage.googleapis.com/upload/v1beta";

const FILE_PROCESS_TIMEOUT_MS =
  120_000;

const FILE_PROCESS_INTERVAL_MS =
  2_000;

/*
 * Xử lý tuần tự để:
 * - giảm lỗi quota
 * - dễ xác định bài lỗi
 * - không làm một bài lỗi dừng cả quyển
 *
 * Có thể tăng concurrency ở phiên bản sau.
 */
const DELAY_BETWEEN_LESSONS_MS =
  5000;

/* =====================================================
   BASIC HELPERS
===================================================== */

function normalizeText(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFirstField(
  value:
    | string
    | string[]
    | undefined
): string {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      ""
    );
  }

  return (
    value ??
    ""
  );
}

function getFirstFile(
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

function delay(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function modelShortName(
  modelName: string
): string {
  return modelName
    .replace(
      /^models\//,
      ""
    )
    .trim();
}

function removeMarkdownCodeFence(
  value: string
): string {
  return value
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();
}

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
   FILE VALIDATION
===================================================== */

function validatePdfFile(
  file: TextbookFile
): void {
  if (
    !file.size ||
    file.size <= 0
  ) {
    throw new Error(
      "File SGK đang trống."
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      "File SGK vượt quá 50 MB."
    );
  }

  const fileName =
    (
      file.originalFilename ??
      ""
    ).toLowerCase();

  const extension =
    path
      .extname(fileName)
      .toLowerCase();

  const mimeType =
    file.mimetype
      ?.toLowerCase() ??
    "";

  if (
    extension !== ".pdf" &&
    mimeType !==
      "application/pdf"
  ) {
    throw new Error(
      "Chuẩn hóa toàn bộ SGK hiện chỉ nhận file PDF."
    );
  }
}

/* =====================================================
   PARSE CHAPTER JSON
===================================================== */

function parseChapters(
  raw: string
): NormalizeBookChapter[] {
  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new Error(
      "Dữ liệu chapters không phải JSON hợp lệ."
    );
  }

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      "Curriculum gửi lên không có danh sách chương hợp lệ."
    );
  }

  return parsed.map(
    (
      rawChapter,
      chapterIndex
    ) => {
      if (
        typeof rawChapter !==
          "object" ||
        rawChapter ===
          null
      ) {
        throw new Error(
          `Chương ${chapterIndex + 1} không hợp lệ.`
        );
      }

      const chapter =
        rawChapter as Record<
          string,
          unknown
        >;

      const title =
        normalizeText(
          chapter.title
        );

      const chapterNo =
        Number(
          chapter.chapterNo
        ) ||
        chapterIndex + 1;

      const rawLessons =
        Array.isArray(
          chapter.lessons
        )
          ? chapter.lessons
          : [];

      const lessons:
        NormalizeBookLesson[] =
        rawLessons.map(
          (
            rawLesson,
            lessonIndex
          ) => {
            if (
              typeof rawLesson !==
                "object" ||
              rawLesson ===
                null
            ) {
              throw new Error(
                `Bài ${lessonIndex + 1} của chương ${chapterNo} không hợp lệ.`
              );
            }

            const lesson =
              rawLesson as Record<
                string,
                unknown
              >;

            return {
              id:
                normalizeText(
                  lesson.id
                ) ||
                undefined,

              lessonCode:
                normalizeText(
                  lesson.lessonCode
                ),

              lessonNo:
                Number(
                  lesson.lessonNo
                ) ||
                lessonIndex +
                  1,

              title:
                normalizeText(
                  lesson.title
                ),

              startPage:
                Number(
                  lesson.startPage
                ) ||
                undefined,

              endPage:
                Number(
                  lesson.endPage
                ) ||
                undefined,

              status:
                normalizeText(
                  lesson.status
                ) ||
                undefined,
            };
          }
        );

      return {
        id:
          normalizeText(
            chapter.id
          ) ||
          undefined,

        chapterNo,

        title,

        lessons,
      };
    }
  );
}

/* =====================================================
   BUILD JOBS
===================================================== */

function buildNormalizationJobs(
  chapters:
    NormalizeBookChapter[]
): NormalizationJob[] {
  const jobs:
    NormalizationJob[] = [];

  chapters.forEach(
    (
      chapter,
      chapterIndex
    ) => {
      const chapterTitle =
        chapter.title ||
        `Chương ${chapter.chapterNo || chapterIndex + 1}`;

      chapter.lessons.forEach(
        (
          lesson,
          lessonIndex
        ) => {
          if (
            !lesson.lessonCode
          ) {
            throw new Error(
              `Có bài chưa có lessonCode tại "${chapterTitle}".`
            );
          }

          if (
            !lesson.title
          ) {
            throw new Error(
              `Bài ${lesson.lessonCode} chưa có tên.`
            );
          }

          const startPage =
            Number(
              lesson.startPage
            );

          const endPage =
            Number(
              lesson.endPage
            );

          if (
            !Number.isInteger(
              startPage
            ) ||
            startPage <= 0 ||
            !Number.isInteger(
              endPage
            ) ||
            endPage <= 0
          ) {
            throw new Error(
              `Bài ${lesson.lessonCode} chưa có trang bắt đầu/kết thúc hợp lệ.`
            );
          }

          if (
            endPage <
            startPage
          ) {
            throw new Error(
              `Bài ${lesson.lessonCode} có endPage nhỏ hơn startPage.`
            );
          }

          jobs.push({
            chapterTitle,

            lessonCode:
              lesson.lessonCode,

            lessonNo:
              lesson.lessonNo ||
              lessonIndex +
                1,

            lessonTitle:
              lesson.title,

            startPage,

            endPage,
          });
        }
      );
    }
  );

  return jobs;
}

/* =====================================================
   GEMINI MODEL SELECTION
===================================================== */

function isSuitableModel(
  model: GeminiModel
): boolean {
  const name =
    modelShortName(
      model.name ?? ""
    ).toLowerCase();

  const methods =
    model
      .supportedGenerationMethods ??
    [];

  if (
    !methods.includes(
      "generateContent"
    )
  ) {
    return false;
  }

  if (
    !name.includes(
      "gemini"
    )
  ) {
    return false;
  }

  if (
    name.includes(
      "embedding"
    ) ||
    name.includes(
      "imagen"
    )
  ) {
    return false;
  }

  return true;
}

function getModelScore(
  value: string
): number {
  const name =
    value.toLowerCase();

  let score =
    0;

  if (
    name.includes(
      "flash"
    )
  ) {
    score +=
      100;
  }

  if (
    name.includes(
      "lite"
    )
  ) {
    score +=
      20;
  }

  if (
    name.includes(
      "pro"
    )
  ) {
    score +=
      10;
  }

  if (
    name.includes(
      "preview"
    )
  ) {
    score -=
      10;
  }

  if (
    name.includes(
      "experimental"
    )
  ) {
    score -=
      30;
  }

  return score;
}

async function getAvailableModels(
  apiKey: string
): Promise<GeminiModel[]> {
  const response =
    await fetch(
      `${GEMINI_API_ROOT}/models`,
      {
        method:
          "GET",

        headers: {
          "x-goog-api-key":
            apiKey,
        },
      }
    );

  const result =
    (await response.json()) as
      GeminiModelsResponse;

  if (
    !response.ok
  ) {
    throw new Error(
      result.error?.message ??
        "Không lấy được danh sách model Gemini."
    );
  }

  return Array.isArray(
    result.models
  )
    ? result.models
    : [];
}

async function selectGeminiModel(
  apiKey: string
): Promise<string> {
  const configured =
    process.env
      .GEMINI_MODEL
      ?.trim();

  if (
    configured
  ) {
    return modelShortName(
      configured
    );
  }

  const models =
    await getAvailableModels(
      apiKey
    );

  const suitable =
    models
      .filter(
        isSuitableModel
      )
      .sort(
        (
          a,
          b
        ) => {
          const nameA =
            modelShortName(
              a.name ?? ""
            );

          const nameB =
            modelShortName(
              b.name ?? ""
            );

          return (
            getModelScore(
              nameB
            ) -
            getModelScore(
              nameA
            )
          );
        }
      );

  const selected =
    suitable[0]?.name;

  if (
    !selected
  ) {
    throw new Error(
      "Không tìm thấy model Gemini phù hợp để chuẩn hóa SGK."
    );
  }

  return modelShortName(
    selected
  );
}

/* =====================================================
   GEMINI FILE API - UPLOAD
===================================================== */

async function uploadPdfToGemini(
  input: {
    apiKey: string;

    fileName: string;

    fileBuffer: Buffer;
  }
): Promise<GeminiFileInfo> {
  const startResponse =
    await fetch(
      `${GEMINI_UPLOAD_ROOT}/files`,
      {
        method:
          "POST",

        headers: {
          "x-goog-api-key":
            input.apiKey,

          "X-Goog-Upload-Protocol":
            "resumable",

          "X-Goog-Upload-Command":
            "start",

          "X-Goog-Upload-Header-Content-Length":
            String(
              input
                .fileBuffer
                .length
            ),

          "X-Goog-Upload-Header-Content-Type":
            "application/pdf",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            file: {
              display_name:
                input.fileName,
            },
          }),
      }
    );

  if (
    !startResponse.ok
  ) {
    const body =
      await startResponse.text();

    throw new Error(
      `Không khởi tạo được upload SGK lên Gemini: ${body}`
    );
  }

  const uploadUrl =
    startResponse.headers.get(
      "x-goog-upload-url"
    );

  if (
    !uploadUrl
  ) {
    throw new Error(
      "Gemini không trả về upload URL."
    );
  }

  const uploadResponse =
    await fetch(
      uploadUrl,
      {
        method:
          "POST",

        headers: {
          "Content-Length":
            String(
              input
                .fileBuffer
                .length
            ),

          "X-Goog-Upload-Offset":
            "0",

          "X-Goog-Upload-Command":
            "upload, finalize",
        },

        body:
          new Uint8Array(input.fileBuffer),
      }
    );

  const result =
    (await uploadResponse.json()) as
      GeminiUploadResponse;

  if (
    !uploadResponse.ok
  ) {
    throw new Error(
      result.error?.message ??
        "Không upload được SGK lên Gemini."
    );
  }

  if (
    !result.file?.name ||
    !result.file?.uri
  ) {
    throw new Error(
      "Gemini không trả về thông tin file SGK."
    );
  }

  return result.file;
}

/* =====================================================
   GEMINI FILE STATUS
===================================================== */

async function getGeminiFile(
  apiKey: string,
  fileName: string
): Promise<GeminiFileInfo> {
  const normalizedName =
    fileName.startsWith(
      "files/"
    )
      ? fileName
      : `files/${fileName}`;

  const response =
    await fetch(
      `${GEMINI_API_ROOT}/${normalizedName}`,
      {
        method:
          "GET",

        headers: {
          "x-goog-api-key":
            apiKey,
        },
      }
    );

  const result =
    (await response.json()) as
      GeminiFileInfo & {
        error?: {
          code?: number;

          message?: string;
        };
      };

  if (
    !response.ok
  ) {
    throw new Error(
      result.error?.message ??
        "Không đọc được trạng thái file Gemini."
    );
  }

  return result;
}

async function waitUntilFileReady(
  apiKey: string,
  initialFile:
    GeminiFileInfo
): Promise<GeminiFileInfo> {
  if (
    !initialFile.name
  ) {
    throw new Error(
      "Thiếu tên file Gemini."
    );
  }

  const startedAt =
    Date.now();

  let current =
    initialFile;

  while (
    Date.now() -
      startedAt <
    FILE_PROCESS_TIMEOUT_MS
  ) {
    const state =
      (
        current.state ??
        ""
      ).toUpperCase();

    if (
      state ===
        "ACTIVE" ||
      state ===
        "READY" ||
      !state
    ) {
      return current;
    }

    if (
      state ===
      "FAILED"
    ) {
      throw new Error(
        current.error
          ?.message ??
          "Gemini không xử lý được file SGK."
      );
    }

    await delay(
      FILE_PROCESS_INTERVAL_MS
    );

    current =
      await getGeminiFile(
        apiKey,
        initialFile.name
      );
  }

  throw new Error(
    "Gemini xử lý SGK quá lâu. Hãy thử lại."
  );
}

/* =====================================================
   DELETE GEMINI TEMP FILE
===================================================== */

async function deleteGeminiFile(
  apiKey: string,
  fileName?: string
): Promise<void> {
  if (
    !fileName
  ) {
    return;
  }

  const normalizedName =
    fileName.startsWith(
      "files/"
    )
      ? fileName
      : `files/${fileName}`;

  await fetch(
    `${GEMINI_API_ROOT}/${normalizedName}`,
    {
      method:
        "DELETE",

      headers: {
        "x-goog-api-key":
          apiKey,
      },
    }
  ).catch(
    () =>
      undefined
  );
}

/* =====================================================
   PROMPT FOR ONE LESSON
===================================================== */

function buildLessonPrompt(
  input: {
    subjectName: string;

    grade: number;

    chapterTitle: string;

    lessonCode: string;

    lessonNo: number;

    lessonTitle: string;

    startPage: number;

    endPage: number;
  }
): string {
  return `
Bạn đang chuẩn hóa học liệu SGK THCS cho hệ thống EduBank AI.

THÔNG TIN:
- Môn học: ${input.subjectName}
- Lớp: ${input.grade}
- Chương/Chủ đề: ${input.chapterTitle}
- Mã bài: ${input.lessonCode}
- Thứ tự bài: ${input.lessonNo}
- Tên bài: ${input.lessonTitle}
- Phạm vi cần đọc trong FILE PDF: từ trang PDF ${input.startPage} đến trang PDF ${input.endPage}, tính trang đầu tiên của file là trang 1.

NHIỆM VỤ:
Chỉ phân tích nội dung thuộc phạm vi trang PDF ${input.startPage}-${input.endPage}.
Không lấy nội dung của bài trước hoặc bài sau dù cùng xuất hiện trong file.

YÊU CẦU:
1. Đọc cả chữ, bảng, sơ đồ, chú thích và nội dung có ý nghĩa trong hình ảnh để hiểu bài.
2. PDF có thể là PDF scan; hãy dùng khả năng đọc tài liệu trực quan.
3. Chỉ sử dụng kiến thức có căn cứ trong phạm vi bài; không tự bổ sung kiến thức ngoài SGK.
4. Bỏ qua đầu trang, chân trang, số trang, logo và mục lục không liên quan.
5. Mục tiêu của nhiệm vụ là TÓM LƯỢC VÀ CẤU TRÚC HÓA TRI THỨC, không tái tạo nội dung SGK.
6. Tuyệt đối không sao chép hoặc tái tạo nguyên văn đoạn văn, câu chuyện, tình huống, ví dụ, câu hỏi hay bài tập dài từ SGK.
7. Mọi nội dung mô tả phải được diễn đạt lại bằng lời văn mới, ngắn gọn, trung tính và chính xác.
8. "objectives" chỉ ghi mục tiêu/yêu cầu có thể suy ra trực tiếp từ bài, nhưng phải diễn đạt lại; không tự tạo chuẩn chính thức của Chương trình GDPT.
9. "knowledgeUnits" chỉ lưu ý nghĩa, khái niệm, nguyên tắc và kiến thức cốt lõi đã được diễn đạt lại; tách thành các đơn vị nhỏ, rõ ràng.
10. "keywords" chỉ gồm thuật ngữ quan trọng và phần giải nghĩa ngắn bằng lời văn mới.
11. "activities" không chép nhiệm vụ trong SGK; chỉ mô tả ngắn loại hoạt động, mục đích hoặc năng lực mà hoạt động hướng tới.
12. "exercises" không chép nguyên văn câu hỏi/bài tập SGK. Chỉ ghi mô tả ngắn nội dung cần luyện tập và hướng trả lời khái quát. Nếu không thể diễn đạt lại an toàn thì trả [].
13. Không đưa vào JSON các đoạn trích, lời thoại, thơ, truyện, tình huống hoặc văn bản nguồn.
14. Ưu tiên dữ liệu ngắn gọn phục vụ Thư viện tri thức và sinh câu hỏi của EduBank AI.
15. Mỗi phần tử có id duy nhất.
16. Nếu một nhóm không có dữ liệu thì trả [].
17. Chỉ trả JSON hợp lệ.
18. Không dùng Markdown.
19. Không viết nội dung ngoài JSON.

JSON BẮT BUỘC:

{
  "objectives": [
    {
      "id": "obj-1",
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

Hãy kiểm tra lần cuối rằng dữ liệu chỉ thuộc bài ${input.lessonCode} và phạm vi trang ${input.startPage}-${input.endPage}.
`;
}

/* =====================================================
   NORMALIZE AI RESULT
===================================================== */

function normalizeAnalyzedLesson(
  raw: unknown
): AnalyzedLesson {
  if (
    typeof raw !==
      "object" ||
    raw ===
      null
  ) {
    throw new Error(
      "AI trả về dữ liệu bài học không đúng cấu trúc."
    );
  }

  const data =
    raw as Record<
      string,
      unknown
    >;

  const objectives =
    asArray(
      data.objectives
    )
      .map(
        (
          rawItem,
          index
        ) => {
          if (
            typeof rawItem !==
              "object" ||
            rawItem ===
              null
          ) {
            return null;
          }

          const item =
            rawItem as Record<
              string,
              unknown
            >;

          const content =
            normalizeText(
              item.content
            );

          if (
            !content
          ) {
            return null;
          }

          return {
            id:
              normalizeText(
                item.id
              ) ||
              `obj-${index + 1}`,

            content,
          };
        }
      )
      .filter(
        (
          item
        ): item is
          Objective =>
          item !== null
      );

  const knowledgeUnits =
    asArray(
      data.knowledgeUnits
    )
      .map(
        (
          rawItem,
          index
        ) => {
          if (
            typeof rawItem !==
              "object" ||
            rawItem ===
              null
          ) {
            return null;
          }

          const item =
            rawItem as Record<
              string,
              unknown
            >;

          const content =
            normalizeText(
              item.content
            );

          if (
            !content
          ) {
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
          KnowledgeUnit =>
          item !== null
      );

  const keywords =
    asArray(
      data.keywords
    )
      .map(
        (
          rawItem,
          index
        ) => {
          if (
            typeof rawItem !==
              "object" ||
            rawItem ===
              null
          ) {
            return null;
          }

          const item =
            rawItem as Record<
              string,
              unknown
            >;

          const word =
            normalizeText(
              item.word
            );

          if (
            !word
          ) {
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
          Keyword =>
          item !== null
      );

  const activities =
    asArray(
      data.activities
    )
      .map(
        (
          rawItem,
          index
        ) => {
          if (
            typeof rawItem !==
              "object" ||
            rawItem ===
              null
          ) {
            return null;
          }

          const item =
            rawItem as Record<
              string,
              unknown
            >;

          const description =
            normalizeText(
              item.description
            );

          if (
            !description
          ) {
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
          Activity =>
          item !== null
      );

  const exercises =
    asArray(
      data.exercises
    )
      .map(
        (
          rawItem,
          index
        ) => {
          if (
            typeof rawItem !==
              "object" ||
            rawItem ===
              null
          ) {
            return null;
          }

          const item =
            rawItem as Record<
              string,
              unknown
            >;

          const question =
            normalizeText(
              item.question
            );

          if (
            !question
          ) {
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
          Exercise =>
          item !== null
      );

  return {
    objectives,

    knowledgeUnits,

    keywords,

    activities,

    exercises,
  };
}

/* =====================================================
   CALL GEMINI FOR ONE LESSON
===================================================== */

async function analyzeLessonFromBookOnce(
  input: {
    apiKey: string;
    model: string;
    fileUri: string;
    prompt: string;
  }
): Promise<AnalyzedLesson> {
  const endpoint =
    `${GEMINI_API_ROOT}/models/` +
    `${encodeURIComponent(
      input.model
    )}:generateContent`;

  const response =
    await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            input.apiKey,
        },

        body:
          JSON.stringify({
            contents: [
              {
                role: "user",

                parts: [
                  {
                    text:
                      input.prompt,
                  },

                  {
                    file_data: {
                      mime_type:
                        "application/pdf",

                      file_uri:
                        input.fileUri,
                    },
                  },
                ],
              },
            ],

            generationConfig: {
              temperature: 0.1,

              responseMimeType:
                "application/json",
            },
          }),
      }
    );

  const rawResponse =
    await response.text();

  let result:
    GeminiGenerateResponse;

  try {
    result =
      JSON.parse(
        rawResponse
      ) as GeminiGenerateResponse;
  } catch {
    throw new Error(
      `Gemini không trả về JSON hợp lệ. HTTP ${response.status}. ` +
        `Phản hồi: ${rawResponse.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
        `Gemini lỗi HTTP ${response.status}.`
    );
  }

  if (
    result.promptFeedback
      ?.blockReason
  ) {
    throw new Error(
      `Gemini từ chối xử lý: ${result.promptFeedback.blockReason}.`
    );
  }

  const rawText =
    result
      .candidates?.[0]
      ?.content
      ?.parts
      ?.map(
        (part) =>
          part.text ?? ""
      )
      .join("")
      .trim();

  if (!rawText) {
    const reason =
      result
        .candidates?.[0]
        ?.finishReason;

    throw new Error(
      reason
        ? `Gemini không trả dữ liệu. Lý do: ${reason}.`
        : "Gemini không trả dữ liệu bài học."
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        removeMarkdownCodeFence(
          rawText
        )
      );
  } catch {
    console.error(
      "JSON chuẩn hóa bài không hợp lệ:",
      rawText
    );

    throw new Error(
      "Gemini trả về JSON không hợp lệ."
    );
  }

  return normalizeAnalyzedLesson(
    parsed
  );
}

function isRetryableGeminiError(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("resource exhausted") ||
    message.includes("deadline") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("503") ||
    message.includes("temporarily unavailable") ||
    message.includes("recitation")
  );
}

function extractRetrySeconds(
  error: unknown
): number | null {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const match =
    message.match(
      /retry\s+in\s+([\d.]+)s/i
    );

  if (!match) {
    return null;
  }

  const seconds =
    Number(match[1]);

  return Number.isFinite(seconds)
    ? Math.ceil(seconds)
    : null;
}

async function analyzeLessonFromBook(
  input: {
    apiKey: string;
    model: string;
    fileUri: string;
    prompt: string;
  }
): Promise<AnalyzedLesson> {
  const MAX_RETRIES = 3;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    try {
      return await analyzeLessonFromBookOnce(
        input
      );
    } catch (error) {
      const canRetry =
        isRetryableGeminiError(
          error
        );

      if (
        !canRetry ||
        attempt === MAX_RETRIES
      ) {
        throw error;
      }

      const retrySeconds =
        extractRetrySeconds(
          error
        );

      const waitSeconds =
        retrySeconds !== null
          ? retrySeconds + 5
          : attempt * 15;

      console.warn(
        `[normalize-book] Gemini tạm lỗi. ` +
          `Thử lại lần ${attempt + 1}/${MAX_RETRIES} ` +
          `sau ${waitSeconds}s.`
      );

      await delay(
        waitSeconds * 1000
      );
    }
  }

  throw new Error(
    "Không thể chuẩn hóa bài sau nhiều lần thử."
  );
}

/* =====================================================
   API HANDLER
===================================================== */

export default async function handler(
  req: NextApiRequest,
  res:
    NextApiResponse<ApiResponse>
) {
  if (
    req.method !==
    "POST"
  ) {
    res.setHeader(
      "Allow",
      ["POST"]
    );

    return res
      .status(405)
      .json({
        success:
          false,

        error:
          "Chỉ hỗ trợ phương thức POST.",
      });
  }

  const apiKey =
    process.env
      .GEMINI_API_KEY
      ?.trim();

  if (
    !apiKey
  ) {
    return res
      .status(500)
      .json({
        success:
          false,

        error:
          "Chưa cấu hình GEMINI_API_KEY trong .env.local.",
      });
  }

  let uploadedFile:
    TextbookFile | null =
    null;

  let geminiFile:
    GeminiFileInfo | null =
    null;

  try {
    /* ---------------------------------------------
       PARSE MULTIPART
    --------------------------------------------- */

    const uid = await requireTextbookAdmin(req);

    const form =
      formidable({
        maxFieldsSize: 1024 * 1024,
        multiples:
          false,

        maxFileSize:
          MAX_FILE_SIZE,

        keepExtensions:
          true,
      });

    const [
      fields,
      files,
    ] =
      await form.parse(
        req
      );

    uploadedFile =
      getFirstFile(
        files.file
      );

    const storagePath = getFirstField(fields.storagePath).trim();
    if (storagePath) {
      // Neither arbitrary URLs nor another user's objects are accepted.
      if (uploadedFile) {
        await fs.unlink(uploadedFile.filepath).catch(() => undefined);
        uploadedFile = null;
        throw new TextbookRequestError(400, "Chỉ gửi đường dẫn SGK, không gửi thêm tệp.");
      }
      uploadedFile = await downloadTextbook(uid, storagePath);
    }


    if (
      !uploadedFile
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Chưa nhận được file SGK.",
        });
    }

    validatePdfFile(
      uploadedFile
    );

    /* ---------------------------------------------
       FIELDS
    --------------------------------------------- */

    const curriculumId =
      normalizeText(
        getFirstField(
          fields.curriculumId
        )
      );

    const subjectCode =
      normalizeText(
        getFirstField(
          fields.subjectCode
        )
      ).toUpperCase();

    const subjectName =
      normalizeText(
        getFirstField(
          fields.subjectName
        )
      );

    const grade =
      Number(
        getFirstField(
          fields.grade
        )
      );

    const chaptersText =
      getFirstField(
        fields.chapters
      );

    if (
      !curriculumId
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Thiếu curriculumId.",
        });
    }

    if (
      !subjectCode ||
      !subjectName ||
      !Number.isInteger(
        grade
      ) ||
      grade <= 0
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Thiếu thông tin môn học hoặc khối lớp.",
        });
    }

    if (
      !chaptersText
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Thiếu dữ liệu Curriculum.",
        });
    }

    const chapters =
      parseChapters(
        chaptersText
      );

    let jobs =
  buildNormalizationJobs(
    chapters
  );

const lessonCodesText =
  getFirstField(
    fields.lessonCodes
  );

if (
  lessonCodesText
) {
  let requestedCodes:
    string[] = [];

  try {
    const parsed =
      JSON.parse(
        lessonCodesText
      );

    if (
      Array.isArray(
        parsed
      )
    ) {
      requestedCodes =
        parsed
          .map(
            (item) =>
              normalizeText(
                item
              )
          )
          .filter(Boolean);
    }
  } catch {
    throw new Error(
      "Danh sách bài cần thử lại không hợp lệ."
    );
  }

  if (
    requestedCodes.length >
    0
  ) {
    const codeSet =
      new Set(
        requestedCodes
      );

    jobs =
      jobs.filter(
        (job) =>
          codeSet.has(
            job.lessonCode
          )
      );
  }

    }

    /* ---------------------------------------------
       READ PDF
    --------------------------------------------- */

    const fileBuffer =
      await fs.readFile(
        uploadedFile.filepath
      );

    /* ---------------------------------------------
       MODEL
    --------------------------------------------- */

    const selectedModel =
      await selectGeminiModel(
        apiKey
      );

    console.log(
      `[normalize-book] Model: ${selectedModel}`
    );

    console.log(
      `[normalize-book] ${subjectName} ${grade}: ${jobs.length} bài`
    );

    /* ---------------------------------------------
       UPLOAD PDF ONCE
    --------------------------------------------- */

    geminiFile =
      await uploadPdfToGemini(
        {
          apiKey,

          fileName:
            uploadedFile
              .originalFilename ??
            `SGK-${subjectCode}-${grade}.pdf`,

          fileBuffer,
        }
      );

    const readyFile =
      await waitUntilFileReady(
        apiKey,
        geminiFile
      );

    if (
      !readyFile.uri
    ) {
      throw new Error(
        "Gemini chưa trả URI của file SGK."
      );
    }

    /* ---------------------------------------------
       NORMALIZE EACH LESSON - KHÔNG GHI FIRESTORE TRÊN SERVER
    --------------------------------------------- */

    const results:
      NormalizeBookLessonResult[] =
      [];

    let completed =
      0;

    let failed =
      0;

    for (
      let index =
        0;
      index <
      jobs.length;
      index +=
        1
    ) {
      const job =
        jobs[index];

      console.log(
        `[normalize-book] ${index + 1}/${jobs.length} - ${job.lessonCode}`
      );

      try {
        const prompt =
          buildLessonPrompt({
            subjectName,

            grade,

            chapterTitle:
              job.chapterTitle,

            lessonCode:
              job.lessonCode,

            lessonNo:
              job.lessonNo,

            lessonTitle:
              job.lessonTitle,

            startPage:
              job.startPage,

            endPage:
              job.endPage,
          });

        const lessonData =
          await analyzeLessonFromBook(
            {
              apiKey,

              model:
                selectedModel,

              fileUri:
                readyFile.uri,

              prompt,
            }
          );

        /*
         * API SERVER CHỈ PHÂN TÍCH.
         *
         * Không import Firebase client service vào API route.
         * Kết quả của từng bài được trả về cho TextbookImport.tsx;
         * phía client sẽ lưu Firestore bằng các service đang dùng ổn định.
         */
        completed +=
          1;

        results.push({
          lessonCode:
            job.lessonCode,

          title:
            job.lessonTitle,

          chapterTitle:
            job.chapterTitle,

          startPage:
            job.startPage,

          endPage:
            job.endPage,

          status:
            "success",

          data:
            lessonData,

          message:
            `AI đã chuẩn hóa trang ${job.startPage}-${job.endPage}.`,
        });
      } catch (
        error
      ) {
        failed +=
          1;

        const message =
          error instanceof
          Error
            ? error.message
            : "Không thể chuẩn hóa bài học.";

        console.error(
          `[normalize-book] Lỗi ${job.lessonCode}:`,
          error
        );

        results.push({
          lessonCode:
            job.lessonCode,

          title:
            job.lessonTitle,

          chapterTitle:
            job.chapterTitle,

          startPage:
            job.startPage,

          endPage:
            job.endPage,

          status:
            "failed",

          message,
        });
      }

      if (
        index <
        jobs.length -
          1
      ) {
        await delay(
          DELAY_BETWEEN_LESSONS_MS
        );
      }
    }

    /* ---------------------------------------------
       RETURN SUMMARY
    --------------------------------------------- */

    return res
      .status(200)
      .json({
        success:
          true,

        curriculumId,

        subjectCode,

        subjectName,

        grade,

        total:
          jobs.length,

        completed,

        failed,

        model:
          selectedModel,

        results,
      });
  } catch (error) {
    if (error instanceof TextbookRequestError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    console.error(
      "NORMALIZE BOOK API ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Không thể chuẩn hóa toàn bộ SGK.",
      });
  } finally {
    /*
     * Xóa file Gemini tạm.
     */
    if (
      geminiFile?.name
    ) {
      await deleteGeminiFile(
        apiKey,
        geminiFile.name
      );
    }

    /*
     * Xóa file Formidable tạm.
     */
    if (
      uploadedFile
        ?.filepath
    ) {
      await fs
        .unlink(
          uploadedFile.filepath
        )
        .catch(
          () =>
            undefined
        );
    }
  }
}

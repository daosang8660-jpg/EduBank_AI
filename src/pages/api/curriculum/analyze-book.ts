import { requireTextbookAdmin, downloadTextbook, type TextbookFile, TextbookRequestError } from "@/lib/textbookStorageServer";
import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { type File as FormidableFile } from "formidable";
import { promises as fs } from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

type LessonStatus =
  | "empty"
  | "imported"
  | "reviewed"
  | "published";

interface AnalyzedLesson {
  id: string;
  lessonCode: string;
  lessonNo: number;
  title: string;
  startPage?: number;
  endPage?: number;
  status: LessonStatus;
}

interface AnalyzedChapter {
  id: string;
  chapterNo: number;
  title: string;
  lessons: AnalyzedLesson[];
}

interface AnalyzeBookSuccess {
  subjectCode: string;
  subjectName: string;
  grade: number;
  chapters: AnalyzedChapter[];
  warnings: string[];
  model?: string;
  fileInfo?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
}

interface AnalyzeBookError {
  error: string;
}

type ApiResponse =
  | AnalyzeBookSuccess
  | AnalyzeBookError;

interface RawBookResult {
  chapters?: Array<{
    chapterNo?: number;
    title?: string;
    lessons?: Array<{
      lessonNo?: number;
      title?: string;
      startPage?: number;
      endPage?: number;
    }>;
  }>;
  warnings?: string[];
}

interface GeminiModel {
  name?: string;
  supportedGenerationMethods?: string[];
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

function getFirstField(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getFirstFile(
  value:
    | FormidableFile
    | FormidableFile[]
    | undefined
): FormidableFile | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeText(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeMarkdownCodeFence(
  value: string
): string {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function modelShortName(
  modelName: string
): string {
  return modelName.replace(
    /^models\//,
    ""
  );
}

function delay(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

function buildLessonCode(
  subjectCode: string,
  grade: number,
  lessonNo: number
): string {
  const prefix =
    subjectCode
      .trim()
      .toUpperCase();

  if (prefix === "TA") {
    return `${prefix}${grade}_U${lessonNo}`;
  }

  return `${prefix}${grade}_B${lessonNo}`;
}

function safeNumber(
  value: unknown
): number | undefined {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : undefined;
}

function validateUploadedFile(
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
      "File SGK vượt quá 50 MB. Hãy giảm dung lượng PDF trước khi phân tích."
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
    file.mimetype?.toLowerCase() ??
    "";

  if (
    extension !== ".pdf" &&
    mimeType !==
      "application/pdf"
  ) {
    throw new Error(
      "Chức năng Nhập SGK hiện chỉ nhận file PDF."
    );
  }
}

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
    !name.includes("gemini")
  ) {
    return false;
  }

  if (
    name.includes("embedding") ||
    name.includes("imagen")
  ) {
    return false;
  }

  return true;
}

function getModelScore(
  nameValue: string
): number {
  const name =
    nameValue.toLowerCase();

  let score = 0;

  if (name.includes("flash")) {
    score += 100;
  }

  if (name.includes("lite")) {
    score += 20;
  }

  if (name.includes("pro")) {
    score += 10;
  }

  if (name.includes("preview")) {
    score -= 10;
  }

  if (
    name.includes(
      "experimental"
    )
  ) {
    score -= 30;
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
        method: "GET",
        headers: {
          "x-goog-api-key":
            apiKey,
        },
      }
    );

  const result =
    (await response.json()) as
      GeminiModelsResponse;

  if (!response.ok) {
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
  const configuredModel =
    process.env
      .GEMINI_MODEL
      ?.trim();

  if (configuredModel) {
    return modelShortName(
      configuredModel
    );
  }

  const models =
    await getAvailableModels(
      apiKey
    );

  const suitableModels =
    models
      .filter(
        isSuitableModel
      )
      .sort(
        (modelA, modelB) => {
          const nameA =
            modelShortName(
              modelA.name ??
                ""
            );

          const nameB =
            modelShortName(
              modelB.name ??
                ""
            );

          return (
            getModelScore(nameB) -
            getModelScore(nameA)
          );
        }
      );

  const selectedModel =
    suitableModels[0]?.name;

  if (!selectedModel) {
    throw new Error(
      "Project chưa có model Gemini phù hợp để phân tích PDF."
    );
  }

  return modelShortName(
    selectedModel
  );
}

function buildAnalyzeBookPrompt(
  input: {
    subjectCode: string;
    subjectName: string;
    grade: number;
  }
): string {
  return `
Bạn là chuyên gia phân tích cấu trúc sách giáo khoa THCS theo Chương trình GDPT 2018.

NHIỆM VỤ:
Đọc file SGK PDF được cung cấp và chỉ nhận diện CẤU TRÚC SÁCH để xây Curriculum cho hệ thống EduBank AI.

THÔNG TIN ĐÃ XÁC ĐỊNH:
- Mã môn: ${input.subjectCode}
- Môn học: ${input.subjectName}
- Khối lớp: ${input.grade}

MỤC TIÊU:
1. Nhận diện toàn bộ các chương/chủ đề/bài lớn trong SGK.
2. Trong từng chương/chủ đề, nhận diện các bài học thực sự.
3. Xác định trang PDF bắt đầu và kết thúc của từng bài.
4. Giữ nguyên tên chương và tên bài theo SGK; không tự viết lại tên.
5. Không phân tích kiến thức chi tiết ở bước này.
6. Không tạo câu hỏi, mục tiêu học tập hay bài tập.
7. Không lấy Lời nói đầu, Hướng dẫn sử dụng sách, Mục lục, Phụ lục hoặc Bảng tra cứu làm bài học.
8. Nếu SGK không dùng từ "Chương" mà dùng "Chủ đề", "Bài", "Unit" hoặc cấu trúc tương đương, vẫn gom thành chapters → lessons hợp lý.
9. Với Ngữ văn, một Bài/Chủ đề lớn có thể là chapter và các nội dung học chính bên trong là lessons nếu cấu trúc sách thể hiện rõ.
10. Với Tiếng Anh, Unit có thể là chapter; các lesson/section chính trong Unit có thể là lessons nếu cần để chuẩn hóa học liệu.
11. Không tự bịa tên chương/bài khi không đọc rõ.
12. Nếu có phần chưa chắc chắn, ghi vào warnings.
13. chapterNo phải là số nguyên bắt đầu từ 1.
14. Các lesson trong toàn bộ sách phải đúng thứ tự xuất hiện.
15. startPage và endPage phải là VỊ TRÍ TRANG TRONG FILE PDF, đánh số từ 1; không dùng số trang in trên sách nếu khác vị trí PDF.
16. startPage <= endPage.
17. Không trả lessonCode hoặc id; hệ thống sẽ tự sinh.
18. Chỉ trả JSON hợp lệ.
19. Không dùng Markdown.
20. Không viết nội dung ngoài JSON.

CẤU TRÚC JSON BẮT BUỘC:

{
  "chapters": [
    {
      "chapterNo": 1,
      "title": "Tên chương/chủ đề/Unit đúng theo SGK",
      "lessons": [
        {
          "lessonNo": 1,
          "title": "Tên bài học đúng theo SGK",
          "startPage": 10,
          "endPage": 15
        }
      ]
    }
  ],
  "warnings": [
    "Nội dung cần quản trị viên kiểm tra lại nếu có"
  ]
}

TRƯỚC KHI TRẢ KẾT QUẢ:
- Không bỏ sót chương/bài trong mục lục.
- Không đưa mục lục/phụ lục vào lessons.
- Tên phải bám sát SGK.
- Thứ tự phải đúng.
- Khoảng trang không được vô lý.
`;
}

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
        method: "POST",
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

        body: JSON.stringify({
          file: {
            display_name:
              input.fileName,
          },
        }),
      }
    );

  if (!startResponse.ok) {
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

  if (!uploadUrl) {
    throw new Error(
      "Gemini không trả về upload URL."
    );
  }

  const uploadResponse =
    await fetch(
      uploadUrl,
      {
        method: "POST",

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

  if (!uploadResponse.ok) {
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
      "Gemini không trả về thông tin file đã upload."
    );
  }

  return result.file;
}

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
        method: "GET",

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

  if (!response.ok) {
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
  if (!initialFile.name) {
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
      state === "ACTIVE" ||
      state === "READY" ||
      !state
    ) {
      return current;
    }

    if (
      state === "FAILED"
    ) {
      throw new Error(
        current.error?.message ??
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
    "Gemini xử lý file SGK quá lâu. Hãy thử lại."
  );
}

async function deleteGeminiFile(
  apiKey: string,
  fileName?: string
): Promise<void> {
  if (!fileName) {
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
      method: "DELETE",
      headers: {
        "x-goog-api-key":
          apiKey,
      },
    }
  ).catch(
    () => undefined
  );
}

async function analyzeBookWithGemini(
  input: {
    apiKey: string;
    model: string;
    prompt: string;
    fileUri: string;
  }
): Promise<RawBookResult> {
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

        body: JSON.stringify({
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
            temperature:
              0.1,

            responseMimeType:
              "application/json",
          },
        }),
      }
    );

  const result =
    (await response.json()) as
      GeminiGenerateResponse;

  if (!response.ok) {
    console.error(
      "Lỗi Gemini analyze-book:",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    throw new Error(
      result.error?.message ??
        `Model ${input.model} không phân tích được SGK.`
    );
  }

  if (
    result
      .promptFeedback
      ?.blockReason
  ) {
    throw new Error(
      `Gemini từ chối xử lý file: ${result.promptFeedback.blockReason}.`
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
    const finishReason =
      result
        .candidates?.[0]
        ?.finishReason;

    throw new Error(
      finishReason
        ? `Gemini không trả dữ liệu. Lý do: ${finishReason}.`
        : "Gemini không trả về cấu trúc SGK."
    );
  }

  try {
    return JSON.parse(
      removeMarkdownCodeFence(
        rawText
      )
    ) as RawBookResult;
  } catch {
    console.error(
      "JSON analyze-book không hợp lệ:",
      rawText
    );

    throw new Error(
      "Gemini trả về cấu trúc JSON không hợp lệ."
    );
  }
}

function normalizeBookResult(
  input: {
    raw: RawBookResult;
    subjectCode: string;
    subjectName: string;
    grade: number;
  }
): AnalyzeBookSuccess {
  const warnings =
    Array.isArray(
      input.raw.warnings
    )
      ? input.raw.warnings
          .map(
            normalizeText
          )
          .filter(Boolean)
      : [];

  const sourceChapters =
    Array.isArray(
      input.raw.chapters
    )
      ? input.raw.chapters
      : [];

  let globalLessonNo =
    1;

  const chapters =
    sourceChapters
      .map(
        (
          chapter,
          chapterIndex
        ) => {
          const chapterNo =
            Math.max(
              1,
              Math.floor(
                safeNumber(
                  chapter.chapterNo
                ) ??
                  chapterIndex +
                    1
              )
            );

          const chapterTitle =
            normalizeText(
              chapter.title
            );

          const sourceLessons =
            Array.isArray(
              chapter.lessons
            )
              ? chapter.lessons
              : [];

          const lessons =
            sourceLessons
              .map(
                (lesson) => {
                  const lessonTitle =
                    normalizeText(
                      lesson.title
                    );

                  if (
                    !lessonTitle
                  ) {
                    return null;
                  }

                  const lessonNo =
                    globalLessonNo;

                  const startPage =
                    safeNumber(
                      lesson.startPage
                    );

                  const endPage =
                    safeNumber(
                      lesson.endPage
                    );

                  const normalized:
                    AnalyzedLesson =
                    {
                      id:
                        `lesson-${chapterNo}-${lessonNo}`,

                      lessonCode:
                        buildLessonCode(
                          input.subjectCode,
                          input.grade,
                          lessonNo
                        ),

                      lessonNo,

                      title:
                        lessonTitle,

                      status:
                        "empty",
                    };

                  if (
                    startPage !==
                    undefined
                  ) {
                    normalized.startPage =
                      Math.max(
                        1,
                        Math.floor(
                          startPage
                        )
                      );
                  }

                  if (
                    endPage !==
                    undefined
                  ) {
                    normalized.endPage =
                      Math.max(
                        normalized
                          .startPage ??
                          1,
                        Math.floor(
                          endPage
                        )
                      );
                  }

                  globalLessonNo +=
                    1;

                  return normalized;
                }
              )
              .filter(
                (
                  lesson
                ): lesson is
                  AnalyzedLesson =>
                  lesson !==
                  null
              );

          if (
            !chapterTitle ||
            lessons.length ===
              0
          ) {
            return null;
          }

          return {
            id:
              `chapter-${chapterNo}`,
            chapterNo,
            title:
              chapterTitle,
            lessons,
          };
        }
      )
      .filter(
        (
          chapter
        ): chapter is
          AnalyzedChapter =>
          chapter !==
          null
      );

  if (
    chapters.length === 0
  ) {
    throw new Error(
      "AI chưa nhận diện được chương và bài hợp lệ trong SGK."
    );
  }

  return {
    subjectCode:
      input.subjectCode,
    subjectName:
      input.subjectName,
    grade:
      input.grade,
    chapters,
    warnings,
  };
}

export default async function handler(
  req: NextApiRequest,
  res:
    NextApiResponse<ApiResponse>
) {
  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      ["POST"]
    );

    return res
      .status(405)
      .json({
        error:
          "Chỉ hỗ trợ phương thức POST.",
      });
  }

  const apiKey =
    process.env
      .GEMINI_API_KEY
      ?.trim();

  if (!apiKey) {
    return res
      .status(500)
      .json({
        error:
          "Chưa cấu hình GEMINI_API_KEY trong .env.local.",
      });
  }

  let uploadedFile:
    | TextbookFile
    | null = null;

  let geminiFile:
    GeminiFileInfo | null =
    null;

  try {
    const uid = await requireTextbookAdmin(req);

    const form =
      formidable({
        maxFieldsSize: 1024 * 1024,
        multiples: false,
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


    if (!uploadedFile) {
      return res
        .status(400)
        .json({
          error:
            "Chưa nhận được file SGK.",
        });
    }

    validateUploadedFile(
      uploadedFile
    );

    const subjectCode =
      getFirstField(
        fields.subjectCode
      )
        .trim()
        .toUpperCase();

    const subjectName =
      getFirstField(
        fields.subjectName
      ).trim();

    const grade =
      Number(
        getFirstField(
          fields.grade
        ).trim()
      );

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
          error:
            "Thông tin môn học hoặc khối lớp chưa đầy đủ.",
        });
    }

    const fileBuffer =
      await fs.readFile(
        uploadedFile.filepath
      );

    const selectedModel =
      await selectGeminiModel(
        apiKey
      );

    console.log(
      "Analyze-book model:",
      selectedModel
    );

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

    if (!readyFile.uri) {
      throw new Error(
        "Gemini chưa trả URI của file SGK."
      );
    }

    const prompt =
      buildAnalyzeBookPrompt(
        {
          subjectCode,
          subjectName,
          grade,
        }
      );

    const rawResult =
      await analyzeBookWithGemini(
        {
          apiKey,
          model:
            selectedModel,
          prompt,
          fileUri:
            readyFile.uri,
        }
      );

    const result =
      normalizeBookResult(
        {
          raw:
            rawResult,
          subjectCode,
          subjectName,
          grade,
        }
      );

    return res
      .status(200)
      .json({
        ...result,

        model:
          selectedModel,

        fileInfo: {
          fileName:
            uploadedFile
              .originalFilename ??
            "sgk.pdf",

          fileSize:
            uploadedFile.size,

          mimeType:
            "application/pdf",
        },
      });
  } catch (error) {
    if (error instanceof TextbookRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(
      "Lỗi API analyze-book:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể phân tích SGK.",
      });
  } finally {
    if (
      geminiFile?.name
    ) {
      await deleteGeminiFile(
        apiKey,
        geminiFile.name
      );
    }

    if (
      uploadedFile?.filepath
    ) {
      await fs
        .unlink(
          uploadedFile.filepath
        )
        .catch(
          () => undefined
        );
    }
  }
}

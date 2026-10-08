import { auth, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable } from "firebase/storage";
// src/components/curriculum/TextbookImport.tsx
import {
  ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  curriculumData,
} from "@/lib/curriculumData";

import {
  buildLessonCode,
  saveCurriculum,
  updateLessonStatus,
  type CurriculumChapter,
  type CurriculumLesson,
} from "@/services/curriculumService";

import {
  saveKnowledgeRepository,
} from "@/services/firestoreKnowledgeService";

/* =====================================================
   TYPES
===================================================== */

interface AnalyzedBookResult {
  subjectCode: string;

  subjectName: string;

  grade: number;

  chapters: CurriculumChapter[];

  warnings?: string[];
}

interface NormalizedKnowledgeData {
  objectives: Array<{
    id: string;
    content: string;
  }>;

  knowledgeUnits: Array<{
    id: string;
    title: string;
    content: string;
  }>;

  keywords: Array<{
    id: string;
    word: string;
    meaning: string;
  }>;

  activities: Array<{
    id: string;
    title: string;
    description: string;
  }>;

  exercises: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

interface NormalizeBookLessonResult {
  lessonCode: string;
  title: string;
  chapterTitle: string;
  startPage: number;
  endPage: number;
  status: "success" | "failed";
  data?: NormalizedKnowledgeData;
  message?: string;
}

interface NormalizeBookApiResponse {
  success?: boolean;
  error?: string;
  total?: number;
  completed?: number;
  failed?: number;
  results?: NormalizeBookLessonResult[];
}

/* =====================================================
   HELPERS
===================================================== */

function createLessonId(
  chapterNo: number,
  lessonNo: number
): string {
  return `lesson-${chapterNo}-${lessonNo}`;
}

function createChapterId(
  chapterNo: number
): string {
  return `chapter-${chapterNo}`;
}

function normalizeLessons(
  chapters: CurriculumChapter[],
  subjectCode: string,
  grade: number
): CurriculumChapter[] {
  let globalLessonNo = 1;

  return chapters.map(
    (
      chapter,
      chapterIndex
    ) => {
      const chapterNo =
        chapter.chapterNo ||
        chapterIndex + 1;

      return {
        ...chapter,

        id:
          chapter.id ||
          createChapterId(
            chapterNo
          ),

        chapterNo,

        lessons:
          chapter.lessons.map(
            (
              lesson,
              lessonIndex
            ) => {
              const lessonNo =
                globalLessonNo;

              globalLessonNo +=
                1;

              return {
                ...lesson,

                id:
                  lesson.id ||
                  createLessonId(
                    chapterNo,
                    lessonNo
                  ),

                lessonNo,

                lessonCode:
                  lesson.lessonCode ||
                  buildLessonCode(
                    subjectCode,
                    grade,
                    lessonNo
                  ),

                status:
                  lesson.status ??
                  "empty",
              };
            }
          ),
      };
    }
  );
}

/* =====================================================
   COMPONENT
===================================================== */

export default function TextbookImport() {
  const uploadedBook = useRef<{ file: File; uid: string; storagePath: string } | null>(null);

  async function prepareBookUpload(file: File): Promise<{ storagePath: string; token: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error("Phiên đăng nhập đã hết. Hãy đăng nhập lại.");
    if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
      throw new Error("SGK phải là tệp PDF có dung lượng từ 1 byte đến 50 MB.");
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Chỉ nhận SGK PDF.");
    const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (signature !== "%PDF-") throw new Error("Nội dung tệp không phải PDF hợp lệ.");
    if (uploadedBook.current?.file !== file || uploadedBook.current.uid !== user.uid) {
      const storagePath = `textbooks/${user.uid}/${crypto.randomUUID()}.pdf`;
      const task = uploadBytesResumable(ref(storage, storagePath), file, {
        contentType: "application/pdf",
        customMetadata: { originalName: file.name },
      });
      try {
        await new Promise<void>((resolve, reject) => {
          task.on("state_changed", (snapshot) => {
            const percent = Math.round(100 * snapshot.bytesTransferred / snapshot.totalBytes);
            setSuccessMessage(`Đang tải SGK: ${percent}%`);
          }, reject, () => resolve());
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "storage/unauthorized") {
          throw new Error("Chưa có quyền tải SGK. Kiểm tra Storage Rules và quyền admin của tài khoản.");
        }
        if (code === "storage/bucket-not-found") {
          throw new Error("Không tìm thấy Firebase Storage. Kiểm tra bucket trong cấu hình website.");
        }
        throw error;
      }
      uploadedBook.current = { file, uid: user.uid, storagePath };
    }
    setSuccessMessage("Đã tải SGK. Đang xử lý nội dung...");
    return { storagePath: uploadedBook.current.storagePath, token: await user.getIdToken() };
  }

  const firstSubject =
    curriculumData[0];

  const firstGrade =
    firstSubject?.grades[0];

  const [
    subjectId,
    setSubjectId,
  ] = useState(
    firstSubject?.id ?? ""
  );

  const [
    gradeId,
    setGradeId,
  ] = useState(
    firstGrade?.id ?? ""
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null
  );

  const [
    chapters,
    setChapters,
  ] = useState<
    CurriculumChapter[]
  >([]);

  const [
    warnings,
    setWarnings,
  ] = useState<string[]>(
    []
  );

  const [
    collapsedChapterIds,
    setCollapsedChapterIds,
  ] = useState<
    string[]
  >([]);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    savedCurriculumId,
    setSavedCurriculumId,
  ] = useState("");

  const [
    isNormalizingBook,
    setIsNormalizingBook,
  ] = useState(false);

  const [
    normalizeProgress,
    setNormalizeProgress,
  ] = useState({
    total: 0,
    completed: 0,
    failed: 0,
  });

  const [
    normalizeResults,
    setNormalizeResults,
  ] = useState<
    NormalizeBookLessonResult[]
  >([]);

  /* =====================================================
     SELECTED SUBJECT / GRADE
  ===================================================== */

  const selectedSubject =
    useMemo(
      () =>
        curriculumData.find(
          (subject) =>
            subject.id ===
            subjectId
        ) ??
        curriculumData[0],
      [subjectId]
    );

  const selectedGrade =
    useMemo(
      () =>
        selectedSubject?.grades.find(
          (grade) =>
            grade.id ===
            gradeId
        ) ??
        selectedSubject?.grades[0],
      [
        selectedSubject,
        gradeId,
      ]
    );

  /* =====================================================
     TOTALS
  ===================================================== */

  const totalLessons =
    useMemo(
      () =>
        chapters.reduce(
          (
            total,
            chapter
          ) =>
            total +
            chapter.lessons.length,
          0
        ),
      [chapters]
    );

  /* =====================================================
     CLEAR RESULT
  ===================================================== */

  const clearResult =
    () => {
      setSelectedFile(null);

      setChapters([]);

      setWarnings([]);

      setCollapsedChapterIds(
        []
      );

      setErrorMessage("");

      setSuccessMessage("");

      setSavedCurriculumId("");

      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });

      setNormalizeResults([]);
    };

  /* =====================================================
     CHANGE SUBJECT
  ===================================================== */

  const handleSubjectChange =
    (
      value: string
    ) => {
      const subject =
        curriculumData.find(
          (item) =>
            item.id === value
        );

      setSubjectId(
        value
      );

      setGradeId(
        subject?.grades[0]?.id ??
          ""
      );

      clearResult();
    };

  /* =====================================================
     CHANGE GRADE
  ===================================================== */

  const handleGradeChange =
    (
      value: string
    ) => {
      setGradeId(
        value
      );

      clearResult();
    };

  /* =====================================================
     FILE SELECT
  ===================================================== */

  const handleFileChange =
    (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      setErrorMessage("");

      setSuccessMessage("");

      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      if (
        file.type !==
          "application/pdf" &&
        !file.name
          .toLowerCase()
          .endsWith(
            ".pdf"
          )
      ) {
        setErrorMessage(
          "Hiện chức năng nhập SGK chỉ nhận file PDF."
        );

        event.target.value =
          "";

        return;
      }

      const maxSize =
        50 *
        1024 *
        1024;

      if (
        file.size >
        maxSize
      ) {
        setErrorMessage(
          "File SGK vượt quá 50 MB."
        );

        event.target.value =
          "";

        return;
      }

      setSelectedFile(
        file
      );

      setChapters([]);

      setWarnings([]);
    };

  /* =====================================================
     ANALYZE BOOK
  ===================================================== */

  const handleAnalyzeBook =
    async () => {
      setErrorMessage("");

      setSuccessMessage("");

      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        setErrorMessage(
          "Hãy chọn môn học và khối lớp."
        );

        return;
      }

      if (
        !selectedFile
      ) {
        setErrorMessage(
          "Hãy chọn file SGK PDF."
        );

        return;
      }

      setIsAnalyzing(
        true
      );

      try {
        const formData =
          new FormData();

        const bookUpload = await prepareBookUpload(selectedFile);
        formData.append("storagePath", bookUpload.storagePath);

        formData.append(
          "subjectId",
          selectedSubject.id
        );

        formData.append(
          "subjectCode",
          selectedSubject.code
        );

        formData.append(
          "subjectName",
          selectedSubject.name
        );

        formData.append(
          "grade",
          String(
            selectedGrade.grade
          )
        );

        const response =
          await fetch(
            "/api/curriculum/analyze-book",
            {
              method:
                "POST",

              headers: { Authorization: `Bearer ${bookUpload.token}` },
              body:
                formData,
            }
          );

        const raw =
          await response.text();

        let data:
          | AnalyzedBookResult
          | {
              error?:
                string;
            };

        try {
          data =
            JSON.parse(
              raw
            );
        } catch {
          throw new Error(
            raw ||
              "API không trả về JSON hợp lệ."
          );
        }

        if (
          !response.ok
        ) {
          throw new Error(
            "error" in data
              ? data.error ||
                  "Không thể phân tích SGK."
              : "Không thể phân tích SGK."
          );
        }

        const result =
          data as
            AnalyzedBookResult;

        if (
          !Array.isArray(
            result.chapters
          ) ||
          result.chapters
            .length ===
            0
        ) {
          throw new Error(
            "AI chưa nhận diện được chương và bài trong SGK."
          );
        }

        const normalized =
          normalizeLessons(
            result.chapters,
            selectedSubject.code,
            selectedGrade.grade
          );

        setChapters(
          normalized
        );

        setWarnings(
          result.warnings ??
            []
        );

        setSuccessMessage(
          `Đã nhận diện ${normalized.length} chương và ${normalized.reduce(
            (
              total,
              chapter
            ) =>
              total +
              chapter.lessons
                .length,
            0
          )} bài. Hãy kiểm tra trước khi lưu Curriculum.`
        );
      } catch (
        error
      ) {
        console.error(
          "Lỗi phân tích SGK:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể phân tích SGK."
        );
      } finally {
        setIsAnalyzing(
          false
        );
      }
    };

  /* =====================================================
     UPDATE CHAPTER
  ===================================================== */

  const updateChapter =
    (
      chapterIndex:
        number,
      patch:
        Partial<CurriculumChapter>
    ) => {
      setChapters(
        (current) =>
          current.map(
            (
              chapter,
              index
            ) =>
              index ===
              chapterIndex
                ? {
                    ...chapter,
                    ...patch,
                  }
                : chapter
          )
      );

      setSuccessMessage(
        ""
      );

      setSavedCurriculumId("");
      setNormalizeResults([]);
      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });
    };

  /* =====================================================
     UPDATE LESSON
  ===================================================== */

  const updateLesson =
    (
      chapterIndex:
        number,
      lessonIndex:
        number,
      patch:
        Partial<CurriculumLesson>
    ) => {
      setChapters(
        (current) =>
          current.map(
            (
              chapter,
              currentChapterIndex
            ) => {
              if (
                currentChapterIndex !==
                chapterIndex
              ) {
                return chapter;
              }

              return {
                ...chapter,

                lessons:
                  chapter.lessons.map(
                    (
                      lesson,
                      currentLessonIndex
                    ) =>
                      currentLessonIndex ===
                      lessonIndex
                        ? {
                            ...lesson,
                            ...patch,
                          }
                        : lesson
                  ),
              };
            }
          )
      );

      setSuccessMessage(
        ""
      );

      setSavedCurriculumId("");
      setNormalizeResults([]);
      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });
    };

  /* =====================================================
     ADD CHAPTER
  ===================================================== */

  const handleAddChapter =
    () => {
      const chapterNo =
        chapters.length +
        1;

      setChapters(
        (current) => [
          ...current,

          {
            id:
              createChapterId(
                chapterNo
              ),

            chapterNo,

            title:
              `Chương ${chapterNo}`,

            lessons:
              [],
          },
        ]
      );
      setSavedCurriculumId("");
      setNormalizeResults([]);
      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });
    };

  /* =====================================================
     REMOVE CHAPTER
  ===================================================== */

  const handleRemoveChapter =
    (
      chapterIndex:
        number
    ) => {
      setChapters(
        (current) =>
          current.filter(
            (
              _,
              index
            ) =>
              index !==
              chapterIndex
          )
      );
      setSavedCurriculumId("");
      setNormalizeResults([]);
      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });
    };

  /* =====================================================
     ADD LESSON
  ===================================================== */

  const handleAddLesson =
    (
      chapterIndex:
        number
    ) => {
      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        return;
      }

      const nextLessonNo =
        totalLessons +
        1;

      setChapters(
        (current) =>
          current.map(
            (
              chapter,
              index
            ) => {
              if (
                index !==
                chapterIndex
              ) {
                return chapter;
              }

              return {
                ...chapter,

                lessons: [
                  ...chapter.lessons,

                  {
                    id:
                      createLessonId(
                        chapter.chapterNo,
                        nextLessonNo
                      ),

                    lessonCode:
                      buildLessonCode(
                        selectedSubject.code,
                        selectedGrade.grade,
                        nextLessonNo
                      ),

                    lessonNo:
                      nextLessonNo,

                    title:
                      `Bài ${nextLessonNo}`,

                    status:
                      "empty",
                  },
                ],
              };
            }
          )
      );
      setSavedCurriculumId("");
      setNormalizeResults([]);
      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });
    };

  /* =====================================================
     REMOVE LESSON
  ===================================================== */

  const handleRemoveLesson =
    (
      chapterIndex:
        number,
      lessonIndex:
        number
    ) => {
      setChapters(
        (current) =>
          current.map(
            (
              chapter,
              index
            ) => {
              if (
                index !==
                chapterIndex
              ) {
                return chapter;
              }

              return {
                ...chapter,

                lessons:
                  chapter.lessons.filter(
                    (
                      _,
                      index
                    ) =>
                      index !==
                      lessonIndex
                  ),
              };
            }
          )
      );
      setSavedCurriculumId("");
      setNormalizeResults([]);
      setNormalizeProgress({
        total: 0,
        completed: 0,
        failed: 0,
      });
    };

  /* =====================================================
     TOGGLE CHAPTER
  ===================================================== */

  const toggleChapter =
    (
      chapterId:
        string
    ) => {
      setCollapsedChapterIds(
        (current) =>
          current.includes(
            chapterId
          )
            ? current.filter(
                (id) =>
                  id !==
                  chapterId
              )
            : [
                ...current,
                chapterId,
              ]
      );
    };

  /* =====================================================
     SAVE CURRICULUM
  ===================================================== */

  const handleSaveCurriculum =
    async () => {
      setErrorMessage("");

      setSuccessMessage("");

      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        setErrorMessage(
          "Thiếu môn học hoặc khối lớp."
        );

        return;
      }

      if (
        chapters.length ===
        0
      ) {
        setErrorMessage(
          "Curriculum chưa có chương."
        );

        return;
      }

      setIsSaving(
        true
      );

      try {
        const curriculumId =
          await saveCurriculum(
            {
              subjectId:
                selectedSubject.id,

              subjectCode:
                selectedSubject.code,

              subjectName:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              curriculumVersion:
                "GDPT2018",

              chapters,

              status:
                "reviewed",
            }
          );

        setSavedCurriculumId(
          curriculumId
        );

        setNormalizeResults([]);

        setNormalizeProgress({
          total: totalLessons,
          completed: 0,
          failed: 0,
        });

        setSuccessMessage(
          `Đã lưu Curriculum ${curriculumId} vào Firestore. Có thể bắt đầu chuẩn hóa toàn bộ SGK.`
        );
      } catch (
        error
      ) {
        console.error(
          "Lỗi lưu Curriculum:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể lưu Curriculum."
        );
      } finally {
        setIsSaving(
          false
        );
      }
    };

  /* =====================================================
     NORMALIZE WHOLE BOOK
  ===================================================== */
    const failedNormalizeResults =
  useMemo(
    () =>
      normalizeResults.filter(
        (item) =>
          item.status ===
          "failed"
      ),
    [normalizeResults]
  );
  const handleNormalizeWholeBook =
    async (retryLessonCodes?: string[]) => {
      setErrorMessage("");
      setSuccessMessage("");

      const isRetry =
        Array.isArray(retryLessonCodes) &&
        retryLessonCodes.length > 0;

      if (!selectedFile) {
        setErrorMessage(
          "Không còn file SGK để chuẩn hóa. Hãy chọn lại file PDF."
        );
        return;
      }

      if (!savedCurriculumId) {
        setErrorMessage(
          "Hãy xác nhận và lưu Curriculum trước khi chuẩn hóa toàn bộ SGK."
        );
        return;
      }

      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        setErrorMessage(
          "Thiếu thông tin môn học hoặc khối lớp."
        );
        return;
      }

      if (totalLessons === 0) {
        setErrorMessage(
          "Curriculum chưa có bài học để chuẩn hóa."
        );
        return;
      }

      const retryCodeSet =
        new Set(
          retryLessonCodes ?? []
        );

      const missingPageLessons =
        chapters.flatMap(
          (chapter) =>
            chapter.lessons
              .filter(
                (lesson) =>
                  (
                    !isRetry ||
                    retryCodeSet.has(
                      lesson.lessonCode
                    )
                  ) &&
                  (
                    !lesson.startPage ||
                    !lesson.endPage
                  )
              )
              .map(
                (lesson) =>
                  `${lesson.lessonCode} - ${lesson.title}`
              )
        );

      if (
        missingPageLessons.length > 0
      ) {
        setErrorMessage(
          isRetry
            ? `Có ${missingPageLessons.length} bài lỗi chưa đủ trang bắt đầu/kết thúc. Hãy kiểm tra Curriculum trước khi thử lại.`
            : `Có ${missingPageLessons.length} bài chưa đủ trang bắt đầu/kết thúc. Hãy kiểm tra Curriculum trước khi chuẩn hóa toàn bộ SGK.`
        );
        return;
      }

      setIsNormalizingBook(true);

      if (!isRetry) {
        setNormalizeResults([]);

        setNormalizeProgress({
          total: totalLessons,
          completed: 0,
          failed: 0,
        });
      } else {
        setSuccessMessage(
          `Đang thử lại ${retryLessonCodes!.length} bài lỗi...`
        );
      }

      try {
        const formData =
          new FormData();

        const bookUpload = await prepareBookUpload(selectedFile);
        formData.append("storagePath", bookUpload.storagePath);

        formData.append(
          "curriculumId",
          savedCurriculumId
        );

        formData.append(
          "subjectId",
          selectedSubject.id
        );

        formData.append(
          "subjectCode",
          selectedSubject.code
        );

        formData.append(
          "subjectName",
          selectedSubject.name
        );

        formData.append(
          "grade",
          String(
            selectedGrade.grade
          )
        );

        formData.append(
          "chapters",
          JSON.stringify(
            chapters
          )
        );

        if (isRetry) {
          formData.append(
            "lessonCodes",
            JSON.stringify(
              retryLessonCodes
            )
          );
        }

        const response =
          await fetch(
            "/api/curriculum/normalize-book",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${bookUpload.token}` },
              body: formData,
            }
          );

        const raw =
          await response.text();

        let result:
          NormalizeBookApiResponse;

        try {
          result =
            JSON.parse(
              raw
            ) as NormalizeBookApiResponse;
        } catch {
          throw new Error(
            `API chuẩn hóa toàn bộ SGK không trả về JSON hợp lệ. HTTP ${response.status}.`
          );
        }

        if (
          !response.ok ||
          result.success === false
        ) {
          throw new Error(
            result.error ||
              `Không thể chuẩn hóa toàn bộ SGK. HTTP ${response.status}.`
          );
        }

        const results =
          Array.isArray(
            result.results
          )
            ? result.results
            : [];

        /*
         * API chỉ chuẩn hóa bằng AI.
         * Firestore được ghi ở phía client để không đưa Firebase client service
         * vào Next.js API route.
         */
        const finalResults:
          NormalizeBookLessonResult[] = [];

        let savedCount =
          0;

        let failedCount =
          0;

        for (
          const item of
          results
        ) {
          if (
            item.status ===
              "failed" ||
            !item.data
          ) {
            failedCount +=
              1;

            finalResults.push(
              item
            );

            continue;
          }

          try {
            await saveKnowledgeRepository({
              lessonCode:
                item.lessonCode,

              lessonTitle:
                item.title,

              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              chapterTitle:
                item.chapterTitle,

              objectives:
                item.data.objectives,

              knowledgeUnits:
                item.data.knowledgeUnits,

              keywords:
                item.data.keywords,

              activities:
                item.data.activities,

              exercises:
                item.data.exercises,
            });

            try {
              await updateLessonStatus(
                selectedSubject.code,
                selectedGrade.grade,
                item.lessonCode,
                "reviewed"
              );
            } catch (
              statusError
            ) {
              console.warn(
                `Đã lưu ${item.lessonCode} nhưng chưa cập nhật được trạng thái Curriculum:`,
                statusError
              );
            }

            savedCount +=
              1;

            finalResults.push({
              ...item,

              status:
                "success",

              message:
                `Đã chuẩn hóa trang ${item.startPage}-${item.endPage} và lưu vào Thư viện tri thức.`,
            });
          } catch (
            saveError
          ) {
            failedCount +=
              1;

            const message =
              saveError instanceof
              Error
                ? saveError.message
                : "Không thể lưu học liệu vào Firestore.";

            console.error(
              `Lỗi lưu ${item.lessonCode}:`,
              saveError
            );

            finalResults.push({
              ...item,

              status:
                "failed",

              message:
                `AI đã chuẩn hóa nhưng lưu Firestore thất bại: ${message}`,
            });
          }
        }

        if (isRetry) {
          const retryCodes =
            new Set(
              retryLessonCodes
            );

          const mergedResults = [
            ...normalizeResults.filter(
              (item) =>
                !retryCodes.has(
                  item.lessonCode
                )
            ),
            ...finalResults,
          ];

          const mergedCompleted =
            mergedResults.filter(
              (item) =>
                item.status ===
                "success"
            ).length;

          const mergedFailed =
            mergedResults.filter(
              (item) =>
                item.status ===
                "failed"
            ).length;

          setNormalizeResults(
            mergedResults
          );

          setNormalizeProgress({
            total:
              totalLessons,
            completed:
              mergedCompleted,
            failed:
              mergedFailed,
          });

          if (
            mergedFailed >
            0
          ) {
            setSuccessMessage(
              `Đã thử lại ${retryLessonCodes!.length} bài. Hiện có ${mergedCompleted}/${totalLessons} bài thành công; ${mergedFailed} bài vẫn lỗi.`
            );
          } else {
            setSuccessMessage(
              `Đã thử lại thành công. Toàn bộ ${mergedCompleted}/${totalLessons} bài đã được chuẩn hóa và lưu vào Thư viện tri thức.`
            );
          }
        } else {
          const total =
            typeof result.total ===
            "number"
              ? result.total
              : totalLessons;

          setNormalizeResults(
            finalResults
          );

          setNormalizeProgress({
            total,
            completed:
              savedCount,
            failed:
              failedCount,
          });

          if (
            failedCount >
            0
          ) {
            setSuccessMessage(
              `Đã chuẩn hóa và lưu ${savedCount}/${total} bài; ${failedCount} bài cần kiểm tra hoặc thử lại.`
            );
          } else {
            setSuccessMessage(
              `Đã chuẩn hóa toàn bộ ${savedCount}/${total} bài và lưu vào Thư viện tri thức.`
            );
          }
        }
      } catch (error) {
        console.error(
          "Lỗi chuẩn hóa toàn bộ SGK:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể chuẩn hóa toàn bộ SGK."
        );
      } finally {
        setIsNormalizingBook(false);
      }
    };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* HEADER */}
      <div>
        <p className="text-sm font-semibold text-blue-700">
          Quản trị / Học liệu
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Nhập SGK & xây Curriculum
        </h1>

        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Upload SGK PDF, dùng AI nhận diện chương và bài, kiểm tra lại kết quả rồi lưu Curriculum vào Firestore.
        </p>
      </div>

      {/* MESSAGE */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2
            size={18}
          />

          {successMessage}
        </div>
      )}

      {/* CONFIG */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <BookOpen
            size={21}
            className="text-blue-700"
          />

          <h2 className="text-lg font-bold text-slate-900">
            1. Thông tin SGK
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* SUBJECT */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
              Môn học
            </span>

            <select
              value={
                selectedSubject?.id ??
                ""
              }
              onChange={(event) =>
                handleSubjectChange(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
            >
              {curriculumData.map(
                (subject) => (
                  <option
                    key={
                      subject.id
                    }
                    value={
                      subject.id
                    }
                  >
                    {
                      subject.name
                    }
                  </option>
                )
              )}
            </select>
          </label>

          {/* GRADE */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
              Khối lớp
            </span>

            <select
              value={
                selectedGrade?.id ??
                ""
              }
              onChange={(event) =>
                handleGradeChange(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
            >
              {selectedSubject?.grades.map(
                (grade) => (
                  <option
                    key={
                      grade.id
                    }
                    value={
                      grade.id
                    }
                  >
                    Lớp{" "}
                    {
                      grade.grade
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </section>

      {/* UPLOAD */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          2. Upload SGK
        </h2>

        <div className="mt-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Upload
              size={27}
            />
          </div>

          <p className="mt-4 font-bold text-slate-900">
            Chọn file SGK PDF
          </p>

          <p className="mt-1 text-sm text-slate-500">
            AI sẽ đọc cấu trúc sách và nhận diện chương, bài, số trang.
          </p>

          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-300 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">
            <FileText
              size={18}
            />

            Duyệt tệp PDF

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={
                handleFileChange
              }
              className="hidden"
            />
          </label>

          {selectedFile && (
            <div className="mx-auto mt-5 flex max-w-xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">
                  {
                    selectedFile.name
                  }
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {(
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(
                    2
                  )}{" "}
                  MB
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedFile(
                    null
                  );

                  setChapters(
                    []
                  );
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X
                  size={18}
                />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={
              handleAnalyzeBook
            }
            disabled={
              !selectedFile ||
              isAnalyzing
            }
            className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2
                size={18}
                className="animate-spin"
              />
            ) : (
              <Sparkles
                size={18}
              />
            )}

            {isAnalyzing
              ? "AI đang phân tích SGK..."
              : "AI phân tích SGK"}
          </button>
        </div>
      </section>

      {/* WARNINGS */}
      {warnings.length >
        0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 font-bold text-amber-700">
            <AlertTriangle
              size={19}
            />

            Có {warnings.length} nội dung cần kiểm tra
          </div>

          <div className="mt-3 space-y-1 text-sm text-amber-700">
            {warnings.map(
              (
                warning,
                index
              ) => (
                <p
                  key={index}
                >
                  • {warning}
                </p>
              )
            )}
          </div>
        </section>
      )}

      {/* CURRICULUM PREVIEW */}
      {chapters.length >
        0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                3. Kiểm tra Curriculum
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {
                  selectedSubject?.name
                }{" "}
                – Lớp{" "}
                {
                  selectedGrade?.grade
                } •{" "}
                {
                  chapters.length
                }{" "}
                chương •{" "}
                {
                  totalLessons
                }{" "}
                bài
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleAddChapter
              }
              className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
            >
              <Plus
                size={17}
              />

              Thêm chương
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {chapters.map(
              (
                chapter,
                chapterIndex
              ) => {
                const isCollapsed =
                  collapsedChapterIds.includes(
                    chapter.id
                  );

                return (
                  <div
                    key={
                      chapter.id
                    }
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    {/* CHAPTER HEADER */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4">
                      <button
                        type="button"
                        onClick={() =>
                          toggleChapter(
                            chapter.id
                          )
                        }
                        className="rounded-lg p-1 text-slate-500 hover:bg-white"
                      >
                        {isCollapsed ? (
                          <ChevronDown
                            size={18}
                          />
                        ) : (
                          <ChevronUp
                            size={18}
                          />
                        )}
                      </button>

                      <div className="w-20">
                        <input
                          type="number"
                          min={1}
                          value={
                            chapter.chapterNo
                          }
                          onChange={(event) =>
                            updateChapter(
                              chapterIndex,
                              {
                                chapterNo:
                                  Number(
                                    event.target.value
                                  ) ||
                                  1,
                              }
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                        />
                      </div>

                      <input
                        value={
                          chapter.title
                        }
                        onChange={(event) =>
                          updateChapter(
                            chapterIndex,
                            {
                              title:
                                event.target.value,
                            }
                          )
                        }
                        className="min-w-60 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                      />

                      <span className="text-xs font-semibold text-slate-500">
                        {
                          chapter.lessons
                            .length
                        }{" "}
                        bài
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveChapter(
                            chapterIndex
                          )
                        }
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2
                          size={17}
                        />
                      </button>
                    </div>

                    {/* LESSONS */}
                    {!isCollapsed && (
                      <div className="space-y-3 p-4">
                        {chapter.lessons.map(
                          (
                            lesson,
                            lessonIndex
                          ) => (
                            <div
                              key={
                                lesson.id
                              }
                              className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[90px_150px_1fr_90px_90px_45px]"
                            >
                              {/* LESSON NO */}
                              <input
                                type="number"
                                min={1}
                                value={
                                  lesson.lessonNo
                                }
                                onChange={(event) =>
                                  updateLesson(
                                    chapterIndex,
                                    lessonIndex,
                                    {
                                      lessonNo:
                                        Number(
                                          event.target.value
                                        ) ||
                                        1,
                                    }
                                  )
                                }
                                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />

                              {/* CODE */}
                              <input
                                value={
                                  lesson.lessonCode
                                }
                                onChange={(event) =>
                                  updateLesson(
                                    chapterIndex,
                                    lessonIndex,
                                    {
                                      lessonCode:
                                        event.target.value.toUpperCase(),
                                    }
                                  )
                                }
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
                              />

                              {/* TITLE */}
                              <input
                                value={
                                  lesson.title
                                }
                                onChange={(event) =>
                                  updateLesson(
                                    chapterIndex,
                                    lessonIndex,
                                    {
                                      title:
                                        event.target.value,
                                    }
                                  )
                                }
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />

                              {/* START PAGE */}
                              <input
                                type="number"
                                min={1}
                                placeholder="Từ trang"
                                value={
                                  lesson.startPage ??
                                  ""
                                }
                                onChange={(event) =>
                                  updateLesson(
                                    chapterIndex,
                                    lessonIndex,
                                    {
                                      startPage:
                                        event.target.value
                                          ? Number(
                                              event.target.value
                                            )
                                          : undefined,
                                    }
                                  )
                                }
                                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />

                              {/* END PAGE */}
                              <input
                                type="number"
                                min={1}
                                placeholder="Đến trang"
                                value={
                                  lesson.endPage ??
                                  ""
                                }
                                onChange={(event) =>
                                  updateLesson(
                                    chapterIndex,
                                    lessonIndex,
                                    {
                                      endPage:
                                        event.target.value
                                          ? Number(
                                              event.target.value
                                            )
                                          : undefined,
                                    }
                                  )
                                }
                                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveLesson(
                                    chapterIndex,
                                    lessonIndex
                                  )
                                }
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2
                                  size={17}
                                />
                              </button>
                            </div>
                          )
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleAddLesson(
                              chapterIndex
                            )
                          }
                          className="flex items-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                        >
                          <Plus
                            size={15}
                          />

                          Thêm bài
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>

          {/* ACTIONS */}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={
                handleSaveCurriculum
              }
              disabled={
                isSaving ||
                isNormalizingBook
              }
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={18}
                />
              )}

              {isSaving
                ? "Đang lưu..."
                : savedCurriculumId
                  ? "Lưu lại Curriculum"
                  : "Xác nhận & lưu Curriculum"}
            </button>

            <button
              type="button"
              onClick={() =>
                void handleNormalizeWholeBook()
              }
              disabled={
                !savedCurriculumId ||
                !selectedFile ||
                isSaving ||
                isNormalizingBook
              }
              className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isNormalizingBook ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Sparkles
                  size={18}
                />
              )}

              {isNormalizingBook
                ? "Đang chuẩn hóa toàn bộ SGK..."
                : "Chuẩn hóa toàn bộ SGK"}
            </button>
          </div>

          {/* NORMALIZE PROGRESS */}
          {(savedCurriculumId ||
            normalizeProgress.total > 0) && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">
                    4. Chuẩn hóa toàn bộ SGK
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {isNormalizingBook
                      ? failedNormalizeResults.length > 0
                        ? "Hệ thống đang xử lý các bài cần thử lại. Các bài đã thành công được giữ nguyên."
                        : "Hệ thống đang xử lý lần lượt từng bài theo phạm vi trang đã xác nhận."
                      : normalizeProgress.completed > 0 || normalizeProgress.failed > 0
                        ? `${normalizeProgress.completed}/${normalizeProgress.total} bài chuẩn hóa thành công.`
                        : "Curriculum đã lưu. Có thể bắt đầu chuẩn hóa toàn bộ sách."}
                  </p>
                </div>

                {normalizeProgress.failed > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                      {normalizeProgress.failed} bài lỗi
                    </span>

                    <button
                      type="button"
                      disabled={
                        isNormalizingBook ||
                        failedNormalizeResults.length === 0 ||
                        !selectedFile ||
                        !savedCurriculumId
                      }
                      onClick={() =>
                        void handleNormalizeWholeBook(
                          failedNormalizeResults.map(
                            (item) =>
                              item.lessonCode
                          )
                        )
                      }
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isNormalizingBook
                        ? "Đang thử lại..."
                        : `Thử lại ${failedNormalizeResults.length} bài lỗi`}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width:
                      normalizeProgress.total > 0
                        ? `${Math.min(
                            100,
                            ((normalizeProgress.completed + normalizeProgress.failed) /
                              normalizeProgress.total) *
                              100
                          )}%`
                        : "0%",
                  }}
                />
              </div>

              {normalizeResults.length > 0 && (
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {normalizeResults.map(
                    (item) => (
                      <div
                        key={
                          item.lessonCode
                        }
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.lessonCode} – {item.title}
                          </p>

                          {item.message && (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.message}
                            </p>
                          )}
                        </div>

                        <span
                          className={
                            item.status === "success"
                              ? "shrink-0 text-sm font-bold text-emerald-700"
                              : "shrink-0 text-sm font-bold text-red-600"
                          }
                        >
                          {item.status === "success"
                            ? "✓ Xong"
                            : "Lỗi"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
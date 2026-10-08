import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BookOpen,
  CheckCircle,
  CloudDownload,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import {
  curriculumData,
} from "@/lib/curriculumData";

import {
  getAllCurriculums,
  updateLessonStatus,
  type CurriculumDocument,
} from "@/services/curriculumService";

import {
  analyzeLesson,
  type AnalyzedLesson,
} from "@/services/aiImporterService";

import {
  getKnowledgeRepositoryByLessonCode,
  saveKnowledgeRepository,
  type KnowledgeRepositoryData,
} from "@/services/firestoreKnowledgeService";

/* =====================================================
   TYPES
===================================================== */

interface FileInfo {
  fileName: string;
  characterCount: number;
}

interface SubjectOption {
  id: string;
  code: string;
  name: string;
}

/* =====================================================
   HELPERS
===================================================== */

function convertFirestoreData(
  data: KnowledgeRepositoryData
): AnalyzedLesson {
  return {
    objectives: Array.isArray(
      data.objectives
    )
      ? (data.objectives as
          AnalyzedLesson["objectives"])
      : [],

    knowledgeUnits:
      Array.isArray(
        data.knowledgeUnits
      )
        ? (data.knowledgeUnits as
            AnalyzedLesson["knowledgeUnits"])
        : [],

    keywords: Array.isArray(
      data.keywords
    )
      ? (data.keywords as
          AnalyzedLesson["keywords"])
      : [],

    activities: Array.isArray(
      data.activities
    )
      ? (data.activities as
          AnalyzedLesson["activities"])
      : [],

    exercises: Array.isArray(
      data.exercises
    )
      ? (data.exercises as
          AnalyzedLesson["exercises"])
      : [],
  };
}

/* =====================================================
   COMPONENT
===================================================== */

export default function KnowledgeRepositoryManager() {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    curriculums,
    setCurriculums,
  ] = useState<
    CurriculumDocument[]
  >([]);

  const [
    isLoadingCurriculum,
    setIsLoadingCurriculum,
  ] = useState(false);

  const [
    subjectCode,
    setSubjectCode,
  ] = useState("");

  const [
    grade,
    setGrade,
  ] = useState<
    number | null
  >(null);

  const [
    chapterId,
    setChapterId,
  ] = useState("");

  const [
    lessonCode,
    setLessonCode,
  ] = useState("");

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<
    File | null
  >(null);

  const [
    analyzedLesson,
    setAnalyzedLesson,
  ] = useState<
    AnalyzedLesson | null
  >(null);

  const [
    fileInfo,
    setFileInfo,
  ] = useState<
    FileInfo | null
  >(null);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isLoadingLesson,
    setIsLoadingLesson,
  ] = useState(false);

  const [
    hasStoredLesson,
    setHasStoredLesson,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* =====================================================
     SUBJECT OPTIONS
     Môn học vẫn lấy từ curriculumData để luôn hiện đủ môn.
     Chương / bài sẽ lấy từ Firestore.
  ===================================================== */

  const subjectOptions =
    useMemo<
      SubjectOption[]
    >(() => {
      return curriculumData.map(
        (subject) => ({
          id: subject.id,
          code: subject.code,
          name: subject.name,
        })
      );
    }, []);

  /* =====================================================
     SELECTED SUBJECT
  ===================================================== */

  const selectedSubject =
    useMemo(() => {
      if (!subjectCode) {
        return (
          subjectOptions[0] ??
          null
        );
      }

      return (
        subjectOptions.find(
          (subject) =>
            subject.code ===
            subjectCode
        ) ??
        subjectOptions[0] ??
        null
      );
    }, [
      subjectOptions,
      subjectCode,
    ]);

  /* =====================================================
     CURRICULUMS OF SUBJECT
  ===================================================== */

  const subjectCurriculums =
    useMemo(() => {
      if (
        !selectedSubject
      ) {
        return [];
      }

      return curriculums
        .filter(
          (curriculum) =>
            curriculum.subjectCode ===
            selectedSubject.code
        )
        .sort(
          (a, b) =>
            a.grade -
            b.grade
        );
    }, [
      curriculums,
      selectedSubject,
    ]);

  /* =====================================================
     SELECTED CURRICULUM
  ===================================================== */

  const selectedCurriculum =
    useMemo(() => {
      if (
        !selectedSubject ||
        grade === null
      ) {
        return null;
      }

      return (
        curriculums.find(
          (curriculum) =>
            curriculum.subjectCode ===
              selectedSubject.code &&
            curriculum.grade ===
              grade
        ) ?? null
      );
    }, [
      curriculums,
      selectedSubject,
      grade,
    ]);

  /* =====================================================
     SELECTED CHAPTER
  ===================================================== */

  const selectedChapter =
    useMemo(() => {
      if (
        !selectedCurriculum
      ) {
        return null;
      }

      return (
        selectedCurriculum.chapters.find(
          (chapter) =>
            chapter.id ===
            chapterId
        ) ??
        selectedCurriculum
          .chapters[0] ??
        null
      );
    }, [
      selectedCurriculum,
      chapterId,
    ]);

  /* =====================================================
     SELECTED LESSON
  ===================================================== */

  const selectedLesson =
    useMemo(() => {
      if (
        !selectedChapter
      ) {
        return null;
      }

      return (
        selectedChapter.lessons.find(
          (lesson) =>
            lesson.lessonCode ===
            lessonCode
        ) ??
        selectedChapter
          .lessons[0] ??
        null
      );
    }, [
      selectedChapter,
      lessonCode,
    ]);

  /* =====================================================
     CLEAR FILE
  ===================================================== */

  const clearSelectedFile =
    () => {
      setSelectedFile(
        null
      );

      setFileInfo(
        null
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  /* =====================================================
     CLEAR MESSAGES
  ===================================================== */

  const clearMessages =
    () => {
      setErrorMessage(
        ""
      );

      setSuccessMessage(
        ""
      );
    };

  /* =====================================================
     SET FIRST LESSON OF CURRICULUM
  ===================================================== */

  const selectFirstLessonOfCurriculum =
    (
      curriculum:
        CurriculumDocument | null
    ) => {
      const firstChapter =
        curriculum
          ?.chapters?.[0];

      const firstLesson =
        firstChapter
          ?.lessons?.[0];

      setChapterId(
        firstChapter?.id ??
          ""
      );

      setLessonCode(
        firstLesson?.lessonCode ??
          ""
      );
    };

  /* =====================================================
     LOAD CURRICULUMS FROM FIRESTORE
  ===================================================== */

  const loadCurriculums =
    async () => {
      setIsLoadingCurriculum(
        true
      );

      setErrorMessage(
        ""
      );

      try {
        const data =
          await getAllCurriculums();

        const sorted =
          [...data].sort(
            (a, b) => {
              const subjectCompare =
                a.subjectName.localeCompare(
                  b.subjectName,
                  "vi"
                );

              if (
                subjectCompare !==
                0
              ) {
                return subjectCompare;
              }

              return (
                a.grade -
                b.grade
              );
            }
          );

        setCurriculums(
          sorted
        );

        /*
         * Nếu chưa chọn môn, ưu tiên curriculum đầu tiên đã có.
         */
        if (
          !subjectCode
        ) {
          const firstCurriculum =
            sorted[0];

          if (
            firstCurriculum
          ) {
            setSubjectCode(
              firstCurriculum.subjectCode
            );

            setGrade(
              firstCurriculum.grade
            );

            selectFirstLessonOfCurriculum(
              firstCurriculum
            );
          } else {
            setSubjectCode(
              subjectOptions[0]
                ?.code ??
                ""
            );

            setGrade(
              null
            );

            setChapterId(
              ""
            );

            setLessonCode(
              ""
            );
          }

          return;
        }

        /*
         * Nếu đang chọn một môn thì giữ lại lựa chọn nếu curriculum còn tồn tại.
         */
        const availableForSubject =
          sorted
            .filter(
              (curriculum) =>
                curriculum.subjectCode ===
                subjectCode
            )
            .sort(
              (a, b) =>
                a.grade -
                b.grade
            );

        if (
          availableForSubject.length ===
          0
        ) {
          setGrade(
            null
          );

          setChapterId(
            ""
          );

          setLessonCode(
            ""
          );

          return;
        }

        const current =
          grade !== null
            ? availableForSubject.find(
                (curriculum) =>
                  curriculum.grade ===
                  grade
              )
            : null;

        const nextCurriculum =
          current ??
          availableForSubject[0];

        setGrade(
          nextCurriculum.grade
        );

        const currentChapter =
          nextCurriculum.chapters.find(
            (chapter) =>
              chapter.id ===
              chapterId
          );

        const nextChapter =
          currentChapter ??
          nextCurriculum
            .chapters[0];

        setChapterId(
          nextChapter?.id ??
            ""
        );

        const currentLesson =
          nextChapter?.lessons.find(
            (lesson) =>
              lesson.lessonCode ===
              lessonCode
          );

        const nextLesson =
          currentLesson ??
          nextChapter
            ?.lessons?.[0];

        setLessonCode(
          nextLesson?.lessonCode ??
            ""
        );
      } catch (
        error
      ) {
        console.error(
          "Lỗi tải Curriculum từ Firestore:",
          error
        );

        setErrorMessage(
          error instanceof
          Error
            ? error.message
            : "Không thể tải Curriculum từ Firestore."
        );
      } finally {
        setIsLoadingCurriculum(
          false
        );
      }
    };

  /* =====================================================
     LOAD CURRICULUM ON MOUNT
  ===================================================== */

  useEffect(() => {
    void loadCurriculums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =====================================================
     LOAD LESSON KNOWLEDGE FROM FIRESTORE
  ===================================================== */

  const loadLessonFromFirestore =
    async (
      code: string
    ) => {
      if (!code) {
        setAnalyzedLesson(
          null
        );

        setHasStoredLesson(
          false
        );

        return;
      }

      setIsLoadingLesson(
        true
      );

      setAnalyzedLesson(
        null
      );

      setHasStoredLesson(
        false
      );

      setFileInfo(
        null
      );

      clearMessages();

      try {
        const storedLesson =
          await getKnowledgeRepositoryByLessonCode(
            code
          );

        if (
          !storedLesson
        ) {
          setAnalyzedLesson(
            null
          );

          setHasStoredLesson(
            false
          );

          return;
        }

        setAnalyzedLesson(
          convertFirestoreData(
            storedLesson
          )
        );

        setHasStoredLesson(
          true
        );

        setSuccessMessage(
          `Đã tải học liệu ${code} từ Firestore.`
        );
      } catch (
        error
      ) {
        console.error(
          "Lỗi đọc học liệu từ Firestore:",
          error
        );

        setErrorMessage(
          error instanceof
          Error
            ? error.message
            : "Không thể đọc học liệu từ Firestore."
        );
      } finally {
        setIsLoadingLesson(
          false
        );
      }
    };

  /* =====================================================
     AUTO LOAD WHEN LESSON CHANGES
  ===================================================== */

  useEffect(() => {
    const code =
      selectedLesson
        ?.lessonCode;

    if (!code) {
      setAnalyzedLesson(
        null
      );

      setHasStoredLesson(
        false
      );

      clearSelectedFile();

      return;
    }

    clearSelectedFile();

    void loadLessonFromFirestore(
      code
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedLesson
      ?.lessonCode,
  ]);

  /* =====================================================
     CHANGE SUBJECT
  ===================================================== */

  const handleSubjectChange =
    (
      event:
        ChangeEvent<HTMLSelectElement>
    ) => {
      const newCode =
        event.target.value;

      setSubjectCode(
        newCode
      );

      clearSelectedFile();

      setAnalyzedLesson(
        null
      );

      setHasStoredLesson(
        false
      );

      const firstCurriculum =
        curriculums
          .filter(
            (curriculum) =>
              curriculum.subjectCode ===
              newCode
          )
          .sort(
            (a, b) =>
              a.grade -
              b.grade
          )[0];

      if (
        !firstCurriculum
      ) {
        setGrade(
          null
        );

        setChapterId(
          ""
        );

        setLessonCode(
          ""
        );

        setErrorMessage(
          "Môn này chưa có Curriculum trên Firestore. Hãy nhập SGK và lưu Curriculum trước."
        );

        setSuccessMessage(
          ""
        );

        return;
      }

      setGrade(
        firstCurriculum.grade
      );

      selectFirstLessonOfCurriculum(
        firstCurriculum
      );

      clearMessages();
    };

  /* =====================================================
     CHANGE GRADE
  ===================================================== */

  const handleGradeChange =
    (
      event:
        ChangeEvent<HTMLSelectElement>
    ) => {
      const newGrade =
        Number(
          event.target.value
        );

      if (
        !Number.isFinite(
          newGrade
        )
      ) {
        setGrade(
          null
        );

        setChapterId(
          ""
        );

        setLessonCode(
          ""
        );

        return;
      }

      setGrade(
        newGrade
      );

      const curriculum =
        curriculums.find(
          (item) =>
            item.subjectCode ===
              subjectCode &&
            item.grade ===
              newGrade
        ) ??
        null;

      selectFirstLessonOfCurriculum(
        curriculum
      );

      clearSelectedFile();

      clearMessages();
    };

  /* =====================================================
     CHANGE CHAPTER
  ===================================================== */

  const handleChapterChange =
    (
      event:
        ChangeEvent<HTMLSelectElement>
    ) => {
      const newChapterId =
        event.target.value;

      setChapterId(
        newChapterId
      );

      const chapter =
        selectedCurriculum
          ?.chapters.find(
            (item) =>
              item.id ===
              newChapterId
          );

      setLessonCode(
        chapter
          ?.lessons?.[0]
          ?.lessonCode ??
          ""
      );

      clearSelectedFile();

      clearMessages();
    };

  /* =====================================================
     CHANGE LESSON
  ===================================================== */

  const handleLessonChange =
    (
      event:
        ChangeEvent<HTMLSelectElement>
    ) => {
      setLessonCode(
        event.target.value
      );

      clearSelectedFile();

      clearMessages();
    };

  /* =====================================================
     FILE HANDLERS
  ===================================================== */

  const handleChooseFile =
    () => {
      fileInputRef.current?.click();
    };

  const handleFileChange =
    (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0] ??
        null;

      setSelectedFile(
        file
      );

      setFileInfo(
        null
      );

      clearMessages();
    };

  const handleRemoveFile =
    () => {
      clearSelectedFile();

      clearMessages();
    };

  /* =====================================================
     ANALYZE LESSON
  ===================================================== */

  const handleAnalyze =
    async () => {
      if (
        !selectedFile
      ) {
        setErrorMessage(
          "Vui lòng chọn TXT, PDF hoặc hình ảnh trước."
        );

        setSuccessMessage(
          ""
        );

        return;
      }

      if (
        !selectedSubject ||
        !selectedCurriculum ||
        !selectedChapter ||
        !selectedLesson
      ) {
        setErrorMessage(
          "Thông tin môn, lớp, chương hoặc bài học chưa đầy đủ."
        );

        setSuccessMessage(
          ""
        );

        return;
      }

      setIsAnalyzing(
        true
      );

      setErrorMessage(
        ""
      );

      setSuccessMessage(
        ""
      );

      setFileInfo(
        null
      );

      try {
        const result =
          await analyzeLesson({
            file:
              selectedFile,

            lessonCode:
              selectedLesson.lessonCode,

            lessonTitle:
              selectedLesson.title,

            subject:
              selectedSubject.name,

            grade:
              selectedCurriculum.grade,

            chapterTitle:
              selectedChapter.title,
          });

        if (
          !result.data
        ) {
          throw new Error(
            "API không trả về dữ liệu học liệu."
          );
        }

        setAnalyzedLesson(
          result.data
        );

        if (
          result.fileInfo
        ) {
          setFileInfo({
            fileName:
              result
                .fileInfo
                .fileName,

            characterCount:
              result
                .fileInfo
                .characterCount,
          });
        }

        setSuccessMessage(
          hasStoredLesson
            ? "AI đã chuẩn hóa lại học liệu. Bấm lưu để cập nhật Firestore."
            : "AI đã chuẩn hóa học liệu. Hãy kiểm tra trước khi lưu."
        );
      } catch (
        error
      ) {
        console.error(
          "Lỗi AI chuẩn hóa:",
          error
        );

        setErrorMessage(
          error instanceof
          Error
            ? error.message
            : "Không thể chuẩn hóa học liệu."
        );
      } finally {
        setIsAnalyzing(
          false
        );
      }
    };

  /* =====================================================
     SAVE KNOWLEDGE
  ===================================================== */

  const handleSave =
    async () => {
      if (
        !analyzedLesson
      ) {
        setErrorMessage(
          "Chưa có dữ liệu học liệu để lưu."
        );

        setSuccessMessage(
          ""
        );

        return;
      }

      if (
        !selectedSubject ||
        !selectedCurriculum ||
        !selectedChapter ||
        !selectedLesson
      ) {
        setErrorMessage(
          "Thông tin bài học chưa đầy đủ."
        );

        setSuccessMessage(
          ""
        );

        return;
      }

      setIsSaving(
        true
      );

      setErrorMessage(
        ""
      );

      setSuccessMessage(
        ""
      );

      try {
        await saveKnowledgeRepository({
          lessonCode:
            selectedLesson
              .lessonCode,

          lessonTitle:
            selectedLesson
              .title,

          subject:
            selectedSubject.name,

          grade:
            selectedCurriculum.grade,

          chapterTitle:
            selectedChapter.title,

          objectives:
            analyzedLesson.objectives,

          knowledgeUnits:
            analyzedLesson
              .knowledgeUnits,

          keywords:
            analyzedLesson.keywords,

          activities:
            analyzedLesson.activities,

          exercises:
            analyzedLesson.exercises,
        });

        /*
         * Cập nhật trạng thái bài trong Curriculum.
         * Nếu cập nhật trạng thái lỗi thì học liệu vẫn đã được lưu,
         * vì vậy chỉ cảnh báo console, không báo lưu thất bại.
         */
        try {
          await updateLessonStatus(
            selectedCurriculum.subjectCode,
            selectedCurriculum.grade,
            selectedLesson.lessonCode,
            "reviewed"
          );

          const refreshed =
            await getAllCurriculums();

          setCurriculums(
            refreshed
          );
        } catch (
          statusError
        ) {
          console.warn(
            "Đã lưu học liệu nhưng chưa cập nhật được trạng thái Curriculum:",
            statusError
          );
        }

        setHasStoredLesson(
          true
        );

        setSuccessMessage(
          `Đã lưu ${selectedLesson.lessonCode} vào Firestore thành công.`
        );
      } catch (
        error
      ) {
        console.error(
          "Lỗi lưu học liệu vào Firestore:",
          error
        );

        setErrorMessage(
          error instanceof
          Error
            ? error.message
            : "Không thể lưu học liệu vào Firestore."
        );
      } finally {
        setIsSaving(
          false
        );
      }
    };

  /* =====================================================
     RELOAD FIRESTORE
  ===================================================== */

  const handleReload =
    async () => {
      clearMessages();

      await loadCurriculums();

      if (
        selectedLesson
          ?.lessonCode
      ) {
        clearSelectedFile();

        await loadLessonFromFirestore(
          selectedLesson.lessonCode
        );
      }
    };

  /* =====================================================
     FLAGS
  ===================================================== */

  const isBusy =
    isAnalyzing ||
    isSaving ||
    isLoadingLesson ||
    isLoadingCurriculum;

  const hasCurriculum =
    Boolean(
      selectedCurriculum
    );

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="min-h-[calc(100vh-130px)]">
      {/* HEADER */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-700">
            Học liệu / Thư viện tri thức
          </p>

          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Biên soạn và chuẩn hóa học liệu
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Chương và bài được tải từ Curriculum trên Firestore. Học liệu đã lưu sẽ tự động được tải khi chọn bài học.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={
              handleReload
            }
            disabled={
              isBusy
            }
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={18}
              className={
                isLoadingLesson ||
                isLoadingCurriculum
                  ? "animate-spin"
                  : ""
              }
            />

            Tải lại Firestore
          </button>

          <button
            type="button"
            onClick={
              handleAnalyze
            }
            disabled={
              isBusy ||
              !hasCurriculum ||
              !selectedLesson
            }
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Sparkles
                size={18}
              />
            )}

            {isAnalyzing
              ? "Đang chuẩn hóa..."
              : hasStoredLesson
              ? "AI chuẩn hóa lại"
              : "AI chuẩn hóa"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {/* SUCCESS */}
      {successMessage && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle
            size={18}
          />

          {successMessage}
        </div>
      )}

      {/* MAIN */}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* LEFT */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2 font-bold text-slate-800">
            <BookOpen
              size={20}
              className="text-blue-700"
            />

            Cấu hình học liệu
          </div>

          <div className="space-y-4">
            {/* SUBJECT */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Môn học
              </span>

              <select
                value={
                  selectedSubject
                    ?.code ??
                  ""
                }
                onChange={
                  handleSubjectChange
                }
                disabled={
                  isBusy
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                {subjectOptions.map(
                  (subject) => (
                    <option
                      key={
                        subject.code
                      }
                      value={
                        subject.code
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
                  grade ?? ""
                }
                onChange={
                  handleGradeChange
                }
                disabled={
                  isBusy ||
                  subjectCurriculums.length ===
                    0
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                {subjectCurriculums.length ===
                0 ? (
                  <option value="">
                    Chưa có Curriculum
                  </option>
                ) : (
                  subjectCurriculums.map(
                    (curriculum) => (
                      <option
                        key={
                          curriculum.id ??
                          `${curriculum.subjectCode}-${curriculum.grade}`
                        }
                        value={
                          curriculum.grade
                        }
                      >
                        Lớp{" "}
                        {
                          curriculum.grade
                        }
                      </option>
                    )
                  )
                )}
              </select>
            </label>

            {/* CHAPTER */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Chương
              </span>

              <select
                value={
                  selectedChapter
                    ?.id ??
                  ""
                }
                onChange={
                  handleChapterChange
                }
                disabled={
                  isBusy ||
                  !selectedCurriculum ||
                  selectedCurriculum
                    .chapters.length ===
                    0
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                {!selectedCurriculum ||
                selectedCurriculum
                  .chapters.length ===
                  0 ? (
                  <option value="">
                    Chưa có chương
                  </option>
                ) : (
                  selectedCurriculum.chapters.map(
                    (chapter) => (
                      <option
                        key={
                          chapter.id
                        }
                        value={
                          chapter.id
                        }
                      >
                        Chương{" "}
                        {
                          chapter.chapterNo
                        }
                        :{" "}
                        {
                          chapter.title
                        }
                      </option>
                    )
                  )
                )}
              </select>
            </label>

            {/* LESSON */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Bài học
              </span>

              <select
                value={
                  selectedLesson
                    ?.lessonCode ??
                  ""
                }
                onChange={
                  handleLessonChange
                }
                disabled={
                  isBusy ||
                  !selectedChapter ||
                  selectedChapter
                    .lessons.length ===
                    0
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                {!selectedChapter ||
                selectedChapter
                  .lessons.length ===
                  0 ? (
                  <option value="">
                    Chưa có bài học
                  </option>
                ) : (
                  selectedChapter.lessons.map(
                    (lesson) => (
                      <option
                        key={
                          lesson.id
                        }
                        value={
                          lesson.lessonCode
                        }
                      >
                        Bài{" "}
                        {
                          lesson.lessonNo
                        }
                        .{" "}
                        {
                          lesson.title
                        }
                      </option>
                    )
                  )
                )}
              </select>
            </label>
          </div>

          {/* STATUS */}
          <div
            className={`mt-5 rounded-lg border p-4 ${
              hasStoredLesson
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase ${
                hasStoredLesson
                  ? "text-emerald-800"
                  : "text-amber-800"
              }`}
            >
              Trạng thái học liệu
            </p>

            {!hasCurriculum ? (
              <>
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  Chưa có Curriculum cho môn/lớp này.
                </p>

                <p className="mt-2 text-xs text-amber-700">
                  Hãy vào chức năng Nhập SGK & xây Curriculum trước.
                </p>
              </>
            ) : !selectedLesson ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">
                Curriculum chưa có bài học.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Bài{" "}
                  {
                    selectedLesson.lessonNo
                  }
                  .{" "}
                  {
                    selectedLesson.title
                  }
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  Mã bài:{" "}
                  <strong>
                    {
                      selectedLesson.lessonCode
                    }
                  </strong>
                </p>

                <p
                  className={`mt-3 text-sm font-semibold ${
                    hasStoredLesson
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {isLoadingLesson
                    ? "Đang kiểm tra Firestore..."
                    : hasStoredLesson
                    ? "Đã có học liệu trên Firestore"
                    : "Chưa có học liệu trên Firestore"}
                </p>
              </>
            )}
          </div>
        </section>

        {/* RIGHT */}
        <div className="space-y-5">
          {/* UPLOAD */}
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <input
              ref={
                fileInputRef
              }
              type="file"
              accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
              onChange={
                handleFileChange
              }
              className="hidden"
            />

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Upload
                size={28}
              />
            </div>

            <h3 className="mt-4 font-bold text-slate-800">
              {hasStoredLesson
                ? "Tải tài liệu mới để chuẩn hóa lại"
                : "Tải lên tài liệu học liệu"}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Hỗ trợ TXT, PDF, PDF scan, JPG, JPEG, PNG và WEBP.
            </p>

            <button
              type="button"
              onClick={
                handleChooseFile
              }
              disabled={
                isBusy ||
                !selectedLesson
              }
              className="mt-4 rounded-lg border border-blue-600 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Duyệt tệp tin
            </button>

            {selectedFile && (
              <div className="mx-auto mt-4 flex max-w-lg items-center justify-between rounded-lg bg-slate-100 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText
                    size={18}
                    className="shrink-0 text-blue-700"
                  />

                  <span className="truncate text-sm font-medium text-slate-700">
                    {
                      selectedFile.name
                    }
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    handleRemoveFile
                  }
                  disabled={
                    isBusy
                  }
                  className="text-slate-500 hover:text-red-600 disabled:opacity-50"
                  aria-label="Xóa tệp"
                >
                  <X
                    size={18}
                  />
                </button>
              </div>
            )}

            {fileInfo && (
              <p className="mt-3 text-xs font-medium text-emerald-700">
                Đã xử lý{" "}
                {
                  fileInfo.fileName
                }
                {fileInfo.characterCount >
                0
                  ? `, ${fileInfo.characterCount.toLocaleString()} ký tự`
                  : ""}
                .
              </p>
            )}
          </section>

          {/* RESULT */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                {hasStoredLesson ? (
                  <CloudDownload
                    size={18}
                    className="text-emerald-700"
                  />
                ) : (
                  <Sparkles
                    size={18}
                    className="text-blue-700"
                  />
                )}

                {hasStoredLesson
                  ? "Học liệu từ Firestore"
                  : "Kết quả chuẩn hóa"}
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {
                  selectedLesson
                    ?.lessonCode ??
                  "—"
                }
              </span>
            </div>

            {isLoadingLesson ? (
              <div className="flex items-center justify-center gap-3 p-12 text-sm font-medium text-slate-500">
                <LoaderCircle
                  size={22}
                  className="animate-spin"
                />

                Đang tải học liệu từ Firestore...
              </div>
            ) : !selectedLesson ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Hãy chọn môn/lớp đã có Curriculum.
              </div>
            ) : !analyzedLesson ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Bài học này chưa có dữ liệu. Hãy chọn tệp và nhấn{" "}
                <strong>
                  AI chuẩn hóa
                </strong>
                .
              </div>
            ) : (
              <div className="space-y-7 p-6">
                {/* OBJECTIVES */}
                <section>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">
                    Yêu cầu cần đạt
                  </h3>

                  {analyzedLesson.objectives.length >
                  0 ? (
                    <ul className="list-disc space-y-2 pl-6 text-slate-700">
                      {analyzedLesson.objectives.map(
                        (
                          item
                        ) => (
                          <li
                            key={
                              item.id
                            }
                          >
                            {
                              item.content
                            }
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có yêu cầu cần đạt.
                    </p>
                  )}
                </section>

                {/* KNOWLEDGE */}
                <section>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">
                    Kiến thức trọng tâm
                  </h3>

                  {analyzedLesson
                    .knowledgeUnits
                    .length >
                  0 ? (
                    <div className="space-y-3">
                      {analyzedLesson.knowledgeUnits.map(
                        (
                          item
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                          >
                            <h4 className="font-semibold text-blue-700">
                              {
                                item.title
                              }
                            </h4>

                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                              {
                                item.content
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có kiến thức trọng tâm.
                    </p>
                  )}
                </section>

                {/* KEYWORDS */}
                <section>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">
                    Thuật ngữ và từ khóa
                  </h3>

                  {analyzedLesson.keywords.length >
                  0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analyzedLesson.keywords.map(
                        (
                          item
                        ) => (
                          <span
                            key={
                              item.id
                            }
                            title={
                              item.meaning
                            }
                            className="rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700"
                          >
                            {
                              item.word
                            }
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có thuật ngữ.
                    </p>
                  )}
                </section>

                {/* ACTIVITIES */}
                <section>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">
                    Hoạt động học tập
                  </h3>

                  {analyzedLesson.activities.length >
                  0 ? (
                    <div className="space-y-3">
                      {analyzedLesson.activities.map(
                        (
                          item
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            className="rounded-lg border border-slate-200 p-4"
                          >
                            <h4 className="font-semibold text-slate-800">
                              {
                                item.title
                              }
                            </h4>

                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                              {
                                item.description
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có hoạt động học tập.
                    </p>
                  )}
                </section>

                {/* EXERCISES */}
                <section>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">
                    Câu hỏi luyện tập
                  </h3>

                  {analyzedLesson.exercises.length >
                  0 ? (
                    <div className="space-y-3">
                      {analyzedLesson.exercises.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            className="rounded-lg border border-slate-200 p-4"
                          >
                            <p className="font-medium text-slate-800">
                              Câu{" "}
                              {
                                index +
                                1
                              }
                              :{" "}
                              {
                                item.question
                              }
                            </p>

                            <p className="mt-2 whitespace-pre-line text-sm text-emerald-700">
                              Đáp án:{" "}
                              {
                                item.answer
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có câu hỏi luyện tập.
                    </p>
                  )}
                </section>
              </div>
            )}

            {/* SAVE BUTTON */}
            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={
                  handleSave
                }
                disabled={
                  !analyzedLesson ||
                  isBusy ||
                  !selectedLesson
                }
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? (
                  <LoaderCircle
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
                  : hasStoredLesson
                  ? "Cập nhật học liệu"
                  : "Lưu vào Thư viện tri thức"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

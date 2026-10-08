import RoleGuard from "@/components/auth/RoleGuard";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Ban,
  BookOpen,
  CheckCircle,
  Edit3,
  FileQuestion,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";

import {
  getAllCurriculums,
  type CurriculumDocument,
} from "@/services/curriculumService";

import useUserScope from "@/lib/useUserScope";

import {
  buildQuestionBankStatistics,
  getQuestionBank,
  type QuestionBankItem,
  type QuestionBankStatus,
  type QuestionSourceType,
} from "@/services/questionBankReadService";

import {
  deactivateQuestionBankItem,
  restoreQuestionBankItem,
  updateQuestionBankItem,
} from "@/services/questionBankManageService";

import type {
  QuestionLevel,
  QuestionType,
} from "@/services/questionGeneratorService";

/* =====================================================
   NHÃN HIỂN THỊ
===================================================== */

const questionTypeLabels: Record<
  QuestionType,
  string
> = {
  multiple_choice:
    "Trắc nghiệm 4 lựa chọn",

  true_false:
    "Đúng / Sai",

  short_answer:
    "Trả lời ngắn",

  essay:
    "Tự luận",
};

const questionLevelLabels: Record<
  QuestionLevel,
  string
> = {
  recognition:
    "Nhận biết",

  understanding:
    "Thông hiểu",

  application:
    "Vận dụng",

  high_application:
    "Vận dụng cao",
};

const sourceLabels: Record<
  QuestionSourceType,
  string
> = {
  ai:
    "AI",

  teacher_upload:
    "Word/PDF",

  manual:
    "Thủ công",
};

/* =====================================================
   KIỂU DỮ LIỆU CHỈNH SỬA
===================================================== */

interface EditQuestionData {
  id: string;

  type: QuestionType;
  level: QuestionLevel;

  question: string;

  options?: string[];

  correctAnswer: string;

  explanation: string;

  sourceKnowledgeIds: string[];

  sourceType: QuestionSourceType;
}

/* =====================================================
   COMPONENT
===================================================== */

function TeacherQuestionBankContent() {
  const {
    canAccessSubject,
    canAccessGrade,
    isLoading: isLoadingUserScope,
    error: userScopeError,
  } = useUserScope();

  const [
    curriculums,
    setCurriculums,
  ] = useState<CurriculumDocument[]>([]);

  const [
    isLoadingCurriculums,
    setIsLoadingCurriculums,
  ] = useState(true);

  const [
    subjectId,
    setSubjectId,
  ] = useState("");

  const [
    gradeId,
    setGradeId,
  ] = useState("");

  const [
    chapterId,
    setChapterId,
  ] = useState("");

  const [
    lessonCode,
    setLessonCode,
  ] = useState("");

  const [
    selectedType,
    setSelectedType,
  ] = useState<
    QuestionType | ""
  >("");

  const [
    selectedLevel,
    setSelectedLevel,
  ] = useState<
    QuestionLevel | ""
  >("");

  const [
    selectedSource,
    setSelectedSource,
  ] = useState<
    QuestionSourceType | ""
  >("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState<QuestionBankStatus>(
    "approved"
  );

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    questions,
    setQuestions,
  ] = useState<
    QuestionBankItem[]
  >([]);

  const [
    editingQuestion,
    setEditingQuestion,
  ] = useState<
    EditQuestionData | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    processingId,
    setProcessingId,
  ] = useState<
    string | null
  >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* =====================================================
     CURRICULUM TỪ FIRESTORE
  ===================================================== */

  const curriculumSubjects =
    useMemo(() => {
      const subjectMap =
        new Map<
          string,
          {
            id: string;
            code: string;
            name: string;
            curriculums: CurriculumDocument[];
          }
        >();

      curriculums.forEach(
        (curriculum) => {
          if (
            !canAccessSubject(
              curriculum.subjectCode,
              curriculum.subjectName
            ) ||
            !canAccessGrade(
              curriculum.grade
            )
          ) {
            return;
          }

          const code =
            curriculum.subjectCode
              .trim()
              .toUpperCase();

          if (!code) {
            return;
          }

          const existing =
            subjectMap.get(code);

          if (existing) {
            existing.curriculums.push(
              curriculum
            );
          } else {
            subjectMap.set(code, {
              id: code,
              code,
              name:
                curriculum.subjectName ||
                code,
              curriculums: [
                curriculum,
              ],
            });
          }
        }
      );

      return Array.from(
        subjectMap.values()
      )
        .map((subject) => ({
          ...subject,
          curriculums:
            [...subject.curriculums].sort(
              (a, b) =>
                a.grade - b.grade
            ),
        }))
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            "vi"
          )
        );
    }, [
      curriculums,
      canAccessSubject,
      canAccessGrade,
    ]);

  const selectedSubject =
    useMemo(
      () =>
        curriculumSubjects.find(
          (subject) =>
            subject.id ===
            subjectId
        ) ??
        curriculumSubjects[0],
      [
        curriculumSubjects,
        subjectId,
      ]
    );

  const selectedGrade =
    useMemo(
      () =>
        selectedSubject?.curriculums.find(
          (curriculum) =>
            (curriculum.id ??
              `${curriculum.subjectCode}-${curriculum.grade}`) ===
            gradeId
        ) ??
        selectedSubject?.curriculums[0],
      [
        selectedSubject,
        gradeId,
      ]
    );

  const selectedChapter =
    useMemo(
      () =>
        selectedGrade?.chapters.find(
          (chapter) =>
            chapter.id ===
            chapterId
        ),
      [
        selectedGrade,
        chapterId,
      ]
    );

  const selectedLesson =
    useMemo(
      () =>
        selectedChapter?.lessons.find(
          (lesson) =>
            lesson.lessonCode ===
            lessonCode
        ),
      [
        selectedChapter,
        lessonCode,
      ]
    );

  useEffect(() => {
    let isMounted = true;

    const loadCurriculums =
      async () => {
        setIsLoadingCurriculums(
          true
        );

        try {
          const data =
            await getAllCurriculums();

          if (!isMounted) {
            return;
          }

          const valid =
            data.filter(
              (item) =>
                item.subjectCode &&
                item.subjectName &&
                Number.isInteger(
                  item.grade
                ) &&
                Array.isArray(
                  item.chapters
                )
            );

          setCurriculums(valid);
        } catch (error) {
          console.error(
            "Lỗi tải Curriculum:",
            error
          );

          if (isMounted) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Không thể tải Curriculum từ Firestore."
            );
          }
        } finally {
          if (isMounted) {
            setIsLoadingCurriculums(
              false
            );
          }
        }
      };

    void loadCurriculums();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingUserScope) {
      return;
    }

    if (userScopeError) {
      setErrorMessage(
        userScopeError
      );
      return;
    }

    if (
      !isLoadingCurriculums &&
      curriculums.length > 0 &&
      curriculumSubjects.length === 0
    ) {
      setErrorMessage(
        "Tài khoản chưa được phân công môn hoặc khối lớp phù hợp."
      );
    }
  }, [
    isLoadingUserScope,
    userScopeError,
    isLoadingCurriculums,
    curriculums.length,
    curriculumSubjects.length,
  ]);

  useEffect(() => {
    if (
      isLoadingCurriculums ||
      curriculumSubjects.length ===
        0
    ) {
      return;
    }

    const subjectExists =
      curriculumSubjects.some(
        (subject) =>
          subject.id ===
          subjectId
      );

    if (subjectExists) {
      return;
    }

    const firstSubject =
      curriculumSubjects[0];

    const firstGrade =
      firstSubject
        ?.curriculums?.[0];

    const firstChapter =
      firstGrade
        ?.chapters?.[0];

    const firstLesson =
      firstChapter
        ?.lessons?.[0];

    setSubjectId(
      firstSubject?.id ?? ""
    );

    setGradeId(
      firstGrade
        ? firstGrade.id ??
            `${firstGrade.subjectCode}-${firstGrade.grade}`
        : ""
    );

    setChapterId("");
    setLessonCode("");
  }, [
    curriculumSubjects,
    isLoadingCurriculums,
    subjectId,
  ]);

  /* =====================================================
     TÌM KIẾM PHÍA CLIENT
  ===================================================== */

  const visibleQuestions =
    useMemo(() => {
      const keyword =
        searchText
          .trim()
          .toLowerCase();

      if (!keyword) {
        return questions;
      }

      return questions.filter(
        (item) =>
          item.question
            .toLowerCase()
            .includes(keyword) ||
          item.correctAnswer
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      questions,
      searchText,
    ]);

  const statistics =
    useMemo(
      () =>
        buildQuestionBankStatistics(
          visibleQuestions
        ),
      [visibleQuestions]
    );

  /* =====================================================
     ĐỌC FIRESTORE
  ===================================================== */

  const bankSubjectName = selectedSubject?.name;
  const bankGrade = selectedGrade?.grade;
  const bankChapterTitle = selectedLesson ? undefined : selectedChapter?.title;
  const bankLessonCode = selectedLesson?.lessonCode;
  const questionLoadVersion = useRef(0);

  const invalidateQuestionLoad = useCallback(() => { ++questionLoadVersion.current; }, []);
  const loadQuestions =
    useCallback(async () => {
      const version = ++questionLoadVersion.current;
      if (
        isLoadingUserScope ||
        isLoadingCurriculums ||
        !bankSubjectName ||
        !bankGrade
      ) {
        setQuestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const result =
          await getQuestionBank({
            subject:
              bankSubjectName,

            grade:
              bankGrade,

            // Mã bài đã xác định bài học; tránh lọc thêm tên chương cũ.
            chapterTitle:
              bankChapterTitle,

            lessonCode:
              bankLessonCode,

            type:
              selectedType ||
              undefined,

            level:
              selectedLevel ||
              undefined,

            sourceType:
              selectedSource ||
              undefined,

            status:
              selectedStatus,

            maxResults:
              500,
          });

        if (version !== questionLoadVersion.current) return;
        setQuestions(result);
      } catch (error) {
        if (version !== questionLoadVersion.current) return;
        console.error(
          "Lỗi đọc ngân hàng:",
          error
        );

        setQuestions([]);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể đọc ngân hàng câu hỏi."
        );
      } finally {
        if (version === questionLoadVersion.current) setIsLoading(false);
      }
    }, [
    selectedType, selectedLevel, selectedSource, selectedStatus,
    isLoadingUserScope, isLoadingCurriculums,
    bankSubjectName, bankGrade, bankChapterTitle, bankLessonCode,
  ]);

  useEffect(() => {
    void loadQuestions();
    return invalidateQuestionLoad;
  }, [loadQuestions, invalidateQuestionLoad]);

  /* =====================================================
     THAY ĐỔI MÔN / LỚP / CHƯƠNG
  ===================================================== */

  const handleSubjectChange = (
    value: string
  ) => {
    const subject =
      curriculumSubjects.find(
        (item) =>
          item.id === value
      );

    const grade =
      subject?.curriculums[0];

    const chapter =
      grade?.chapters[0];

    const lesson =
      chapter?.lessons[0];

    setSubjectId(value);

    setGradeId(
      grade
        ? grade.id ??
            `${grade.subjectCode}-${grade.grade}`
        : ""
    );

    setChapterId("");
    setLessonCode("");
  };

  const handleGradeChange = (
    value: string
  ) => {
    const grade =
      selectedSubject?.curriculums.find(
        (item) =>
          (item.id ??
            `${item.subjectCode}-${item.grade}`) ===
          value
      );

    const chapter =
      grade?.chapters[0];

    const lesson =
      chapter?.lessons[0];

    setGradeId(value);

    setChapterId("");
    setLessonCode("");
  };

  const handleChapterChange = (
    value: string
  ) => {
    const chapter =
      selectedGrade?.chapters.find(
        (item) =>
          item.id === value
      );

    const lesson =
      chapter?.lessons[0];

    setChapterId(value);

    setLessonCode("");
  };

  /* =====================================================
     BẮT ĐẦU CHỈNH SỬA
  ===================================================== */

  const handleStartEdit = (
    item: QuestionBankItem
  ) => {
    setEditingQuestion({
      id:
        item.id,

      type:
        item.type,

      level:
        item.level,

      question:
        item.question,

      options:
        item.options
          ? [
              ...item.options,
            ]
          : undefined,

      correctAnswer:
        item.correctAnswer,

      explanation:
        item.explanation,

      sourceKnowledgeIds: [
        ...item.sourceKnowledgeIds,
      ],

      sourceType:
        item.sourceType,
    });

    setErrorMessage("");
    setSuccessMessage("");
  };

  /* =====================================================
     ĐỔI DẠNG CÂU
  ===================================================== */

  const handleEditTypeChange = (
    type: QuestionType
  ) => {
    if (
      !editingQuestion
    ) {
      return;
    }

    if (
      type ===
      "multiple_choice"
    ) {
      setEditingQuestion({
        ...editingQuestion,

        type,

        options: [
          "Phương án A",
          "Phương án B",
          "Phương án C",
          "Phương án D",
        ],

        correctAnswer:
          "Phương án A",
      });

      return;
    }

    if (
      type ===
      "true_false"
    ) {
      setEditingQuestion({
        ...editingQuestion,

        type,

        options: [
          "Đúng",
          "Sai",
        ],

        correctAnswer:
          "Đúng",
      });

      return;
    }

    setEditingQuestion({
      ...editingQuestion,

      type,

      options:
        undefined,

      correctAnswer:
        "",
    });
  };

  /* =====================================================
     SỬA PHƯƠNG ÁN
  ===================================================== */

  const handleEditOption = (
    optionIndex: number,
    value: string
  ) => {
    if (
      !editingQuestion ||
      !editingQuestion.options
    ) {
      return;
    }

    const oldOption =
      editingQuestion.options[
        optionIndex
      ];

    const newOptions =
      editingQuestion.options.map(
        (
          option,
          index
        ) =>
          index ===
          optionIndex
            ? value
            : option
      );

    setEditingQuestion({
      ...editingQuestion,

      options:
        newOptions,

      correctAnswer:
        editingQuestion.correctAnswer ===
        oldOption
          ? value
          : editingQuestion.correctAnswer,
    });
  };

  /* =====================================================
     LƯU CHỈNH SỬA
  ===================================================== */

  const handleSaveEdit =
    async () => {
      if (
        !editingQuestion
      ) {
        return;
      }

      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      try {
        await updateQuestionBankItem(
          editingQuestion
        );

        setEditingQuestion(
          null
        );

        setSuccessMessage(
          "Đã cập nhật câu hỏi trong ngân hàng."
        );

        await loadQuestions();
      } catch (error) {
        console.error(
          "Lỗi cập nhật câu hỏi:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể cập nhật câu hỏi."
        );
      } finally {
        setIsSaving(false);
      }
    };

  /* =====================================================
     VÔ HIỆU HÓA
  ===================================================== */

  const handleDeactivate =
    async (
      item: QuestionBankItem
    ) => {
      const confirmed =
        window.confirm(
          "Vô hiệu hóa câu hỏi này? Câu hỏi sẽ không còn được dùng để tạo đề."
        );

      if (!confirmed) {
        return;
      }

      setProcessingId(
        item.id
      );

      setErrorMessage("");
      setSuccessMessage("");

      try {
        await deactivateQuestionBankItem(
          item.id
        );

        setSuccessMessage(
          "Đã vô hiệu hóa câu hỏi."
        );

        await loadQuestions();
      } catch (error) {
        console.error(
          "Lỗi vô hiệu hóa:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể vô hiệu hóa câu hỏi."
        );
      } finally {
        setProcessingId(
          null
        );
      }
    };

  /* =====================================================
     KHÔI PHỤC
  ===================================================== */

  const handleRestore =
    async (
      item: QuestionBankItem
    ) => {
      const confirmed =
        window.confirm(
          "Khôi phục câu hỏi này vào ngân hàng đang hoạt động?"
        );

      if (!confirmed) {
        return;
      }

      setProcessingId(
        item.id
      );

      setErrorMessage("");
      setSuccessMessage("");

      try {
        await restoreQuestionBankItem(
          item.id
        );

        setSuccessMessage(
          "Đã khôi phục câu hỏi."
        );

        await loadQuestions();
      } catch (error) {
        console.error(
          "Lỗi khôi phục:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể khôi phục câu hỏi."
        );
      } finally {
        setProcessingId(
          null
        );
      }
    };

  /* =====================================================
     GIAO DIỆN
  ===================================================== */

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      {/* HEADER */}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Giáo viên / Ngân hàng câu hỏi
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Ngân hàng câu hỏi
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Quản lý, chỉnh sửa và vô hiệu hóa các câu hỏi đã được thẩm định.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadQuestions()
          }
          disabled={
            isLoading
          }
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              isLoading
                ? "animate-spin"
                : ""
            }
          />

          Tải lại
        </button>
      </div>

      {!isLoadingCurriculums &&
        curriculumSubjects.length === 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            Chưa có Curriculum trong Firestore.
          </div>
        )}

      {/* THÔNG BÁO */}

      {errorMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          {successMessage}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* =================================================
            BỘ LỌC
        ================================================= */}

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2 font-bold text-slate-800">
            <BookOpen
              size={20}
              className="text-blue-700"
            />

            Bộ lọc
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Môn học
              </span>

              <select
                value={
                  selectedSubject?.id ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  handleSubjectChange(
                    event.target.value
                  )
                }
                disabled={
                  isLoadingCurriculums ||
                  curriculumSubjects.length === 0
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
              >
                {isLoadingCurriculums && (
                  <option value="">
                    Đang tải Curriculum...
                  </option>
                )}

                {!isLoadingCurriculums &&
                  curriculumSubjects.length === 0 && (
                    <option value="">
                      Chưa có Curriculum
                    </option>
                  )}

                {curriculumSubjects.map(
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

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Khối lớp
              </span>

              <select
                value={
                  gradeId
                }
                onChange={(
                  event
                ) =>
                  handleGradeChange(
                    event.target.value
                  )
                }
                disabled={
                  isLoadingCurriculums ||
                  !selectedSubject
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
              >
                {selectedSubject?.curriculums.map(
                  (grade) => (
                    <option
                      key={
                        grade.id ??
                        `${grade.subjectCode}-${grade.grade}`
                      }
                      value={
                        grade.id ??
                        `${grade.subjectCode}-${grade.grade}`
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

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Chương
              </span>

              <select
                value={
                  selectedChapter?.id ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  handleChapterChange(
                    event.target.value
                  )
                }
                disabled={
                  isLoadingCurriculums ||
                  !selectedGrade ||
                  selectedGrade.chapters.length === 0
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
              >
                <option value="">Tất cả chương</option>
                {selectedGrade?.chapters.map(
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
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Bài học
              </span>

              <select
                value={
                  selectedLesson?.lessonCode ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  setLessonCode(
                    event.target.value
                  )
                }
                disabled={
                  isLoadingCurriculums ||
                  !selectedChapter ||
                  selectedChapter.lessons.length === 0
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
              >
                <option value="">Tất cả bài học</option>
                {selectedChapter?.lessons.map(
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
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Trạng thái
              </span>

              <select
                value={
                  selectedStatus
                }
                onChange={(
                  event
                ) =>
                  setSelectedStatus(
                    event.target
                      .value as QuestionBankStatus
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="approved">
                  Đang hoạt động
                </option>

                <option value="inactive">
                  Đã vô hiệu hóa
                </option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Dạng câu
              </span>

              <select
                value={
                  selectedType
                }
                onChange={(
                  event
                ) =>
                  setSelectedType(
                    event.target
                      .value as
                      | QuestionType
                      | ""
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">
                  Tất cả
                </option>

                <option value="multiple_choice">
                  Trắc nghiệm
                </option>

                <option value="true_false">
                  Đúng / Sai
                </option>

                <option value="short_answer">
                  Trả lời ngắn
                </option>

                <option value="essay">
                  Tự luận
                </option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Mức độ
              </span>

              <select
                value={
                  selectedLevel
                }
                onChange={(
                  event
                ) =>
                  setSelectedLevel(
                    event.target
                      .value as
                      | QuestionLevel
                      | ""
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">
                  Tất cả
                </option>

                <option value="recognition">
                  Nhận biết
                </option>

                <option value="understanding">
                  Thông hiểu
                </option>

                <option value="application">
                  Vận dụng
                </option>

                <option value="high_application">
                  Vận dụng cao
                </option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                Nguồn
              </span>

              <select
                value={
                  selectedSource
                }
                onChange={(
                  event
                ) =>
                  setSelectedSource(
                    event.target
                      .value as
                      | QuestionSourceType
                      | ""
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">
                  Tất cả
                </option>

                <option value="ai">
                  AI
                </option>

                <option value="teacher_upload">
                  Word/PDF
                </option>

                <option value="manual">
                  Thủ công
                </option>
              </select>
            </label>
          </div>
        </aside>

        {/* =================================================
            NỘI DUNG
        ================================================= */}

        <section className="space-y-5">
          {/* THỐNG KÊ */}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Tổng câu
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {statistics.total}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Nhận biết
              </p>

              <p className="mt-2 text-2xl font-bold">
                {
                  statistics
                    .byLevel
                    .recognition
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Thông hiểu
              </p>

              <p className="mt-2 text-2xl font-bold">
                {
                  statistics
                    .byLevel
                    .understanding
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Vận dụng
              </p>

              <p className="mt-2 text-2xl font-bold">
                {statistics.byLevel.application +
                  statistics.byLevel.high_application}
              </p>
            </div>
          </div>

          {/* DANH SÁCH */}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileQuestion
                  size={20}
                  className="text-blue-700"
                />

                <h2 className="font-bold text-slate-900">
                  Danh sách câu hỏi
                </h2>
              </div>

              <div className="relative w-full max-w-sm">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={
                    searchText
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchText(
                      event.target.value
                    )
                  }
                  placeholder="Tìm nội dung câu hỏi..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-3 p-14 text-sm font-semibold text-slate-500">
                <LoaderCircle
                  size={24}
                  className="animate-spin"
                />

                Đang đọc ngân hàng câu hỏi...
              </div>
            ) : visibleQuestions.length ===
              0 ? (
              <div className="p-12 text-center">
                <FileQuestion
                  size={44}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-4 font-semibold text-slate-700">
                  Không có câu hỏi phù hợp
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                {visibleQuestions.map(
                  (
                    item,
                    index
                  ) => {
                    const isEditing =
                      editingQuestion?.id ===
                      item.id;

                    const isProcessing =
                      processingId ===
                      item.id;

                    return (
                      <article
                        key={
                          item.id
                        }
                        className={`rounded-xl border p-5 ${
                          item.status ===
                          "inactive"
                            ? "border-slate-300 bg-slate-50 opacity-80"
                            : "border-slate-200"
                        }`}
                      >
                        {/* HEADER CÂU */}

                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                              Câu{" "}
                              {index + 1}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                              {
                                questionTypeLabels[
                                  item.type
                                ]
                              }
                            </span>

                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              {
                                questionLevelLabels[
                                  item.level
                                ]
                              }
                            </span>

                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                              {
                                sourceLabels[
                                  item.sourceType
                                ]
                              }
                            </span>

                            {item.status ===
                              "inactive" && (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                Đã vô hiệu hóa
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {!item.canEdit && <span className="text-xs text-slate-500">Câu hỏi dùng chung · Chỉ đọc</span>}
                            {item.canEdit && item.status ===
                              "approved" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStartEdit(
                                      item
                                    )
                                  }
                                  className="flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                                >
                                  <Edit3
                                    size={
                                      15
                                    }
                                  />
                                  Chỉnh sửa
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDeactivate(
                                      item
                                    )
                                  }
                                  disabled={
                                    isProcessing
                                  }
                                  className="flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {isProcessing ? (
                                    <LoaderCircle
                                      size={
                                        15
                                      }
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Ban
                                      size={
                                        15
                                      }
                                    />
                                  )}

                                  Vô hiệu hóa
                                </button>
                              </>
                            )}

                            {item.canEdit && item.status ===
                              "inactive" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleRestore(
                                    item
                                  )
                                }
                                disabled={
                                  isProcessing
                                }
                                className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <LoaderCircle
                                    size={
                                      15
                                    }
                                    className="animate-spin"
                                  />
                                ) : (
                                  <RotateCcw
                                    size={
                                      15
                                    }
                                  />
                                )}

                                Khôi phục
                              </button>
                            )}
                          </div>
                        </div>

                        {/* CHỈNH SỬA */}

                        {isEditing &&
                        editingQuestion ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <label>
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                  Dạng câu
                                </span>

                                <select
                                  value={
                                    editingQuestion.type
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleEditTypeChange(
                                      event
                                        .target
                                        .value as QuestionType
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                >
                                  {Object.entries(
                                    questionTypeLabels
                                  ).map(
                                    ([
                                      value,
                                      label,
                                    ]) => (
                                      <option
                                        key={
                                          value
                                        }
                                        value={
                                          value
                                        }
                                      >
                                        {
                                          label
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>

                              <label>
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                  Mức độ
                                </span>

                                <select
                                  value={
                                    editingQuestion.level
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditingQuestion(
                                      {
                                        ...editingQuestion,

                                        level:
                                          event
                                            .target
                                            .value as QuestionLevel,
                                      }
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                >
                                  {Object.entries(
                                    questionLevelLabels
                                  ).map(
                                    ([
                                      value,
                                      label,
                                    ]) => (
                                      <option
                                        key={
                                          value
                                        }
                                        value={
                                          value
                                        }
                                      >
                                        {
                                          label
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>
                            </div>

                            <textarea
                              value={
                                editingQuestion.question
                              }
                              onChange={(
                                event
                              ) =>
                                setEditingQuestion(
                                  {
                                    ...editingQuestion,

                                    question:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              rows={3}
                              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                            />

                            {editingQuestion.options && (
                              <div className="space-y-2">
                                {editingQuestion.options.map(
                                  (
                                    option,
                                    optionIndex
                                  ) => (
                                    <div
                                      key={
                                        optionIndex
                                      }
                                      className="flex gap-3"
                                    >
                                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold">
                                        {String.fromCharCode(
                                          65 +
                                            optionIndex
                                        )}
                                      </span>

                                      <input
                                        value={
                                          option
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          handleEditOption(
                                            optionIndex,
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 text-sm"
                                      />
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {editingQuestion.options ? (
                              <select
                                value={
                                  editingQuestion.correctAnswer
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditingQuestion(
                                    {
                                      ...editingQuestion,

                                      correctAnswer:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                              >
                                {editingQuestion.options.map(
                                  (
                                    option,
                                    optionIndex
                                  ) => (
                                    <option
                                      key={
                                        optionIndex
                                      }
                                      value={
                                        option
                                      }
                                    >
                                      {String.fromCharCode(
                                        65 +
                                          optionIndex
                                      )}
                                      .{" "}
                                      {
                                        option
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            ) : (
                              <textarea
                                value={
                                  editingQuestion.correctAnswer
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditingQuestion(
                                    {
                                      ...editingQuestion,

                                      correctAnswer:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                rows={2}
                                className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                              />
                            )}

                            <textarea
                              value={
                                editingQuestion.explanation
                              }
                              onChange={(
                                event
                              ) =>
                                setEditingQuestion(
                                  {
                                    ...editingQuestion,

                                    explanation:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              rows={3}
                              placeholder="Giải thích đáp án"
                              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                            />

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSaveEdit()
                                }
                                disabled={
                                  isSaving
                                }
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                              >
                                {isSaving ? (
                                  <LoaderCircle
                                    size={
                                      16
                                    }
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Save
                                    size={
                                      16
                                    }
                                  />
                                )}

                                Lưu thay đổi
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingQuestion(
                                    null
                                  )
                                }
                                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold"
                              >
                                <X
                                  size={
                                    16
                                  }
                                />

                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* CHẾ ĐỘ XEM */
                          <>
                            <h3 className="text-base font-bold leading-7 text-slate-900">
                              {
                                item.question
                              }
                            </h3>

                            {item.options &&
                              item.options
                                .length > 0 && (
                                <div className="mt-4 grid gap-2 md:grid-cols-2">
                                  {item.options.map(
                                    (
                                      option,
                                      optionIndex
                                    ) => {
                                      const correct =
                                        option ===
                                        item.correctAnswer;

                                      return (
                                        <div
                                          key={
                                            optionIndex
                                          }
                                          className={`rounded-lg border px-4 py-3 text-sm ${
                                            correct
                                              ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                                              : "border-slate-200 bg-slate-50"
                                          }`}
                                        >
                                          {String.fromCharCode(
                                            65 +
                                              optionIndex
                                          )}
                                          .{" "}
                                          {
                                            option
                                          }
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}

                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                              <p className="text-sm font-bold text-emerald-800">
                                Đáp án
                              </p>

                              <p className="mt-1 text-sm text-emerald-700">
                                {
                                  item.correctAnswer
                                }
                              </p>
                            </div>

                            {item.explanation && (
                              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <p className="text-sm font-bold text-blue-800">
                                  Giải thích
                                </p>

                                <p className="mt-1 text-sm leading-6 text-blue-700">
                                  {
                                    item.explanation
                                  }
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function TeacherQuestionBankPage() {
  return <RoleGuard requiredRole="teacher"><TeacherQuestionBankContent /></RoleGuard>;
}

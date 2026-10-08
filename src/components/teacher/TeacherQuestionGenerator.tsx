import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  checkQuestionsDuplicateBatch,
  summarizeDuplicateResults,
} from "@/services/questionDuplicateService";

import {
  saveApprovedQuestions,
} from "@/services/questionBankService";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Edit3,
  FilePlus2,
  FileQuestion,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import type { CurriculumDocument } from "@/services/curriculumService";
import { getAllCurriculums, getKnowledgeRepositoryByLessonCode } from "@/services/teacherKnowledgeReadService";

import useUserScope from "@/lib/useUserScope";

import type { KnowledgeRepositoryData } from "@/services/firestoreKnowledgeService";

import {
  generateQuestionsFromKnowledge,
  type GeneratedQuestion,
  type KnowledgeData,
  type QuestionLevel,
  type QuestionSpecification,
  type QuestionType,
} from "@/services/questionGeneratorService";

/* =====================================================
   KIỂU DỮ LIỆU
===================================================== */

interface EditableQuestion
  extends Omit<GeneratedQuestion, "status"> {
  sourceType:
    | "ai"
    | "teacher_upload"
    | "manual";

  status:
    | "draft"
    | "reviewed"
    | "approved";
}
   
interface QuestionTypeOption {
  value: QuestionType;
  label: string;
}

interface QuestionLevelOption {
  value: QuestionLevel;
  label: string;
}

/* =====================================================
   CẤU HÌNH
===================================================== */

const questionTypes: QuestionTypeOption[] = [
  {
    value: "multiple_choice",
    label: "Trắc nghiệm 4 lựa chọn",
  },
  {
    value: "true_false",
    label: "Đúng / Sai",
  },
  {
    value: "short_answer",
    label: "Trả lời ngắn",
  },
  {
    value: "essay",
    label: "Tự luận",
  },
];

const questionLevels: QuestionLevelOption[] = [
  {
    value: "recognition",
    label: "Nhận biết",
  },
  {
    value: "understanding",
    label: "Thông hiểu",
  },
  {
    value: "application",
    label: "Vận dụng",
  },
  {
    value: "high_application",
    label: "Vận dụng cao",
  },
];

/* =====================================================
   HÀM TIỆN ÍCH
===================================================== */

function createInitialSpecifications(): QuestionSpecification[] {
  const result: QuestionSpecification[] = [];

  questionTypes.forEach((type) => {
    questionLevels.forEach((level) => {
      result.push({
        type: type.value,
        level: level.value,
        count: 0,
      });
    });
  });

  return result;
}

function convertFirestoreKnowledge(
  data: KnowledgeRepositoryData
): KnowledgeData {
  return {
    objectives: Array.isArray(data.objectives)
      ? (data.objectives as KnowledgeData["objectives"])
      : [],

    knowledgeUnits: Array.isArray(data.knowledgeUnits)
      ? (data.knowledgeUnits as KnowledgeData["knowledgeUnits"])
      : [],

    keywords: Array.isArray(data.keywords)
      ? (data.keywords as KnowledgeData["keywords"])
      : [],

    activities: Array.isArray(data.activities)
      ? (data.activities as KnowledgeData["activities"])
      : [],

    exercises: Array.isArray(data.exercises)
      ? (data.exercises as KnowledgeData["exercises"])
      : [],
  };
}

function createQuestionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getQuestionTypeLabel(type: QuestionType): string {
  return (
    questionTypes.find((item) => item.value === type)?.label ??
    type
  );
}

function getQuestionLevelLabel(level: QuestionLevel): string {
  return (
    questionLevels.find((item) => item.value === level)?.label ??
    level
  );
}

function getLevelBadgeClass(level: QuestionLevel): string {
  switch (level) {
    case "recognition":
      return "bg-slate-100 text-slate-700";

    case "understanding":
      return "bg-blue-100 text-blue-700";

    case "application":
      return "bg-amber-100 text-amber-700";

    case "high_application":
      return "bg-rose-100 text-rose-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getSourceLabel(
  sourceType: EditableQuestion["sourceType"]
): string {
  switch (sourceType) {
    case "ai":
      return "AI";

    case "teacher_upload":
      return "Upload";

    case "manual":
      return "Thủ công";

    default:
      return "Nháp";
  }
}

function getSourceBadgeClass(
  sourceType: EditableQuestion["sourceType"]
): string {
  switch (sourceType) {
    case "ai":
      return "bg-violet-100 text-violet-700";

    case "teacher_upload":
      return "bg-cyan-100 text-cyan-700";

    case "manual":
      return "bg-amber-100 text-amber-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function createBlankQuestion(input: {
  lessonCode: string;
  lessonTitle: string;
}): EditableQuestion {
  return {
    id: createQuestionId(input.lessonCode || "question"),

    lessonCode: input.lessonCode,
    lessonTitle: input.lessonTitle,

    type: "multiple_choice",
    level: "recognition",

    question: "",

    options: [
      "Phương án A",
      "Phương án B",
      "Phương án C",
      "Phương án D",
    ],

    correctAnswer: "Phương án A",
    explanation: "",

    sourceKnowledgeIds: [],

    status: "draft",
    sourceType: "manual",
  };
}

/* =====================================================
   XỬ LÝ FILE JSON
===================================================== */

function normalizeUploadedQuestion(
  value: unknown,
  index: number,
  lessonCode: string,
  lessonTitle: string
): EditableQuestion | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const item = value as Partial<EditableQuestion>;

  if (
    typeof item.question !== "string" ||
    !item.question.trim()
  ) {
    return null;
  }

  const isValidType = questionTypes.some(
    (option) => option.value === item.type
  );

  const isValidLevel = questionLevels.some(
    (option) => option.value === item.level
  );

  const type: QuestionType = isValidType
    ? (item.type as QuestionType)
    : "multiple_choice";

  const level: QuestionLevel = isValidLevel
    ? (item.level as QuestionLevel)
    : "recognition";

  let options: string[] | undefined;

  if (type === "multiple_choice") {
    const uploadedOptions = Array.isArray(item.options)
      ? item.options
          .filter(
            (option): option is string =>
              typeof option === "string"
          )
          .map((option) => option.trim())
          .filter(Boolean)
      : [];

    options =
      uploadedOptions.length === 4
        ? uploadedOptions
        : [
            "Phương án A",
            "Phương án B",
            "Phương án C",
            "Phương án D",
          ];
  }

  if (type === "true_false") {
    options = ["Đúng", "Sai"];
  }

  let correctAnswer =
    typeof item.correctAnswer === "string"
      ? item.correctAnswer.trim()
      : "";

  if (!correctAnswer && options?.length) {
    correctAnswer = options[0];
  }

  return {
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : createQuestionId(
            `${lessonCode}-upload-${index + 1}`
          ),

    lessonCode,
    lessonTitle,

    type,
    level,

    question: item.question.trim(),

    ...(options ? { options } : {}),

    correctAnswer,

    explanation:
      typeof item.explanation === "string"
        ? item.explanation.trim()
        : "",

    sourceKnowledgeIds: Array.isArray(
      item.sourceKnowledgeIds
    )
      ? item.sourceKnowledgeIds
          .filter(
            (sourceId): sourceId is string =>
              typeof sourceId === "string"
          )
          .map((sourceId) => sourceId.trim())
          .filter(Boolean)
      : [],

    status: "draft",
    sourceType: "teacher_upload",
  };
}

/* =====================================================
   XỬ LÝ FILE TXT

   Mẫu:

   Câu 1: Thông tin là gì?
   A. Phương án 1
   B. Phương án 2
   C. Phương án 3
   D. Phương án 4
   Đáp án: Phương án 1
   Giải thích: Nội dung giải thích

===================================================== */

function parseTextQuestions(
  content: string,
  lessonCode: string,
  lessonTitle: string
): EditableQuestion[] {
  const normalizedContent = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalizedContent) {
    return [];
  }

  const blocks = normalizedContent
    .split(
      /(?=^(?:Câu|Cau)\s*\d+\s*[:.)-])/gim
    )
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block, index): EditableQuestion | null => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        return null;
      }

      const questionLine = lines[0]
        .replace(
          /^(?:Câu|Cau)\s*\d+\s*[:.)-]?\s*/i,
          ""
        )
        .trim();

      if (!questionLine) {
        return null;
      }

      const optionLines = lines.filter((line) =>
        /^[A-D][.)]\s*/i.test(line)
      );

      const options = optionLines.map((line) =>
        line
          .replace(/^[A-D][.)]\s*/i, "")
          .trim()
      );

      const answerLine = lines.find((line) =>
        /^(?:Đáp án|Dap an|ĐA|DA)\s*:/i.test(
          line
        )
      );

      const explanationLine = lines.find((line) =>
        /^(?:Giải thích|Giai thich|Lời giải|Loi giai)\s*:/i.test(
          line
        )
      );

      const answerText =
        answerLine
          ?.replace(
            /^(?:Đáp án|Dap an|ĐA|DA)\s*:/i,
            ""
          )
          .trim() ?? "";

      const explanation =
        explanationLine
          ?.replace(
            /^(?:Giải thích|Giai thich|Lời giải|Loi giai)\s*:/i,
            ""
          )
          .trim() ?? "";

      const type: QuestionType =
        options.length === 4
          ? "multiple_choice"
          : "short_answer";

      let correctAnswer = answerText;

      /*
       * Nếu đáp án chỉ là A, B, C hoặc D
       * thì chuyển thành nội dung phương án tương ứng.
       */
      if (
        type === "multiple_choice" &&
        /^[A-D]$/i.test(answerText)
      ) {
        const answerIndex =
          answerText.toUpperCase().charCodeAt(0) -
          65;

        correctAnswer =
          options[answerIndex] ?? answerText;
      }

      if (
        type === "multiple_choice" &&
        !correctAnswer
      ) {
        correctAnswer = options[0] ?? "";
      }

      return {
        id: createQuestionId(
          `${lessonCode}-txt-${index + 1}`
        ),

        lessonCode,
        lessonTitle,

        type,
        level: "recognition",

        question: questionLine,

        ...(type === "multiple_choice"
          ? { options }
          : {}),

        correctAnswer,
        explanation,

        sourceKnowledgeIds: [],

        status: "draft",
        sourceType: "teacher_upload",
      } satisfies EditableQuestion;
    })
    .filter(
      (
        item
      ): item is EditableQuestion =>item !== null
    );
}

/* =====================================================
   COMPONENT
===================================================== */

export default function TeacherQuestionGenerator() {
  const uploadInputRef =
    useRef<HTMLInputElement>(null);

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

  const [subjectId, setSubjectId] =
    useState<string>("");

  const [gradeId, setGradeId] =
    useState<string>("");

  const [chapterId, setChapterId] =
    useState<string>("");

  const [lessonCode, setLessonCode] =
    useState<string>("");

  const [knowledge, setKnowledge] =
    useState<KnowledgeData | null>(null);

  const [specifications, setSpecifications] =
    useState<QuestionSpecification[]>(
      createInitialSpecifications()
    );

  const [
    generatedQuestions,
    setGeneratedQuestions,
  ] = useState<EditableQuestion[]>([]);

  const [
    editingQuestionId,
    setEditingQuestionId,
  ] = useState<string | null>(null);

  const [
    editingBackup,
    setEditingBackup,
  ] = useState<EditableQuestion | null>(null);

  const [
    isLoadingKnowledge,
    setIsLoadingKnowledge,
  ] = useState(false);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [isUploading, setIsUploading] =
    useState(false);
  const [
  isSavingBank,
  setIsSavingBank,
      ] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [usedModel, setUsedModel] =
    useState("");
  
  /* =====================================================
     DỮ LIỆU ĐANG CHỌN
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
            subject.id === subjectId
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
            chapter.id === chapterId
        ) ??
        selectedGrade?.chapters[0],
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
        ) ??
        selectedChapter?.lessons[0],
      [
        selectedChapter,
        lessonCode,
      ]
    );

  const totalQuestionCount = useMemo(
    () =>
      specifications.reduce(
        (total, item) =>
          total + item.count,
        0
      ),
    [specifications]
  );

  const hasKnowledge =
    knowledge !== null &&
    (knowledge.objectives.length > 0 ||
      knowledge.knowledgeUnits.length > 0 ||
      knowledge.keywords.length > 0 ||
      knowledge.activities.length > 0 ||
      knowledge.exercises.length > 0);

  const isBusy =
    isLoadingUserScope ||
    isLoadingCurriculums ||
    isLoadingKnowledge ||
    isGenerating ||
    isUploading ||
    isSavingBank;
  /* =====================================================
     TẢI HỌC LIỆU
  ===================================================== */

  const clearMessages = useCallback(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, []);

  const resetQuestionDrafts = useCallback(() => {
    setGeneratedQuestions([]);
    setEditingQuestionId(null);
    setEditingBackup(null);
    setUsedModel("");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurriculums =
      async () => {
        setIsLoadingCurriculums(true);
        setErrorMessage("");

        try {
          const data =
            await getAllCurriculums();

          if (!isMounted) {
            return;
          }

          const validCurriculums =
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

          setCurriculums(
            validCurriculums
          );

          if (
            validCurriculums.length ===
            0
          ) {
            setSubjectId("");
            setGradeId("");
            setChapterId("");
            setLessonCode("");
            setKnowledge(null);

            setErrorMessage(
              "Chưa có Curriculum phù hợp với môn/khối được phân công. Nhờ quản trị kiểm tra phân công và Curriculum."
            );

            return;
          }

          const first =
            [...validCurriculums].sort(
              (a, b) => {
                const subjectCompare =
                  a.subjectName.localeCompare(
                    b.subjectName,
                    "vi"
                  );

                return subjectCompare !== 0
                  ? subjectCompare
                  : a.grade - b.grade;
              }
            )[0];

          const firstChapter =
            first.chapters[0];

          const firstLesson =
            firstChapter?.lessons[0];

          setSubjectId(
            first.subjectCode
              .trim()
              .toUpperCase()
          );

          setGradeId(
            first.id ??
              `${first.subjectCode}-${first.grade}`
          );

          setChapterId(
            firstChapter?.id ?? ""
          );

          setLessonCode(
            firstLesson?.lessonCode ??
              ""
          );
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

  const knowledgeRequest = useRef(0);

  const invalidateKnowledge = useCallback(() => { ++knowledgeRequest.current; }, []);
  const loadKnowledge = useCallback(async (
    code: string
  ) => {
    const request = ++knowledgeRequest.current;
    if (!code) {
      setKnowledge(null);
      return;
    }

    setIsLoadingKnowledge(true);
    setKnowledge(null);
    clearMessages();
    resetQuestionDrafts();

    try {
      const storedKnowledge =
        await getKnowledgeRepositoryByLessonCode(
          code
        );

      if (request !== knowledgeRequest.current) return;

      if (!storedKnowledge) {
        setErrorMessage(
          `Bài ${code} chưa có học liệu trong Thư viện tri thức.`
        );

        return;
      }

      setKnowledge(
        convertFirestoreKnowledge(
          storedKnowledge
        )
      );

      setSuccessMessage(
        `Đã tải học liệu ${code} từ Firestore.`
      );
    } catch (error) {
      if (request !== knowledgeRequest.current) return;
      console.error(
        "Lỗi tải học liệu:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải học liệu từ Firestore."
      );
    } finally {
      if (request === knowledgeRequest.current) setIsLoadingKnowledge(false);
    }
  }, [clearMessages, resetQuestionDrafts]);

  useEffect(() => {
    const code =
      selectedLesson?.lessonCode;

    if (code) {
      void loadKnowledge(code);
    } else {
      ++knowledgeRequest.current;
      setIsLoadingKnowledge(false);
      setKnowledge(null);
    }
    return invalidateKnowledge;
  }, [selectedLesson?.lessonCode, loadKnowledge, invalidateKnowledge]);

  /* =====================================================
     THAY ĐỔI MÔN, LỚP, CHƯƠNG, BÀI
  ===================================================== */

  const handleSubjectChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const newSubjectId =
      event.target.value;

    const newSubject =
      curriculumSubjects.find(
        (subject) =>
          subject.id === newSubjectId
      );

    const newGrade =
      newSubject?.curriculums[0];

    const newChapter =
      newGrade?.chapters[0];

    const newLesson =
      newChapter?.lessons[0];

    setSubjectId(newSubjectId);

    setGradeId(
      newGrade
        ? newGrade.id ??
            `${newGrade.subjectCode}-${newGrade.grade}`
        : ""
    );

    setChapterId(
      newChapter?.id ?? ""
    );

    setLessonCode(
      newLesson?.lessonCode ??
        ""
    );

    setKnowledge(null);
    resetQuestionDrafts();
    clearMessages();
  };

  const handleGradeChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const newGradeId =
      event.target.value;

    const newGrade =
      selectedSubject?.curriculums.find(
        (curriculum) =>
          (curriculum.id ??
            `${curriculum.subjectCode}-${curriculum.grade}`) ===
          newGradeId
      );

    const newChapter =
      newGrade?.chapters[0];

    const newLesson =
      newChapter?.lessons[0];

    setGradeId(newGradeId);

    setChapterId(
      newChapter?.id ?? ""
    );

    setLessonCode(
      newLesson?.lessonCode ??
        ""
    );

    setKnowledge(null);
    resetQuestionDrafts();
    clearMessages();
  };

  const handleChapterChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const newChapterId =
      event.target.value;

    const newChapter =
      selectedGrade?.chapters.find(
        (chapter) =>
          chapter.id ===
          newChapterId
      );

    const newLesson =
      newChapter?.lessons[0];

    setChapterId(
      newChapterId
    );

    setLessonCode(
      newLesson?.lessonCode ??
        ""
    );

    setKnowledge(null);
    resetQuestionDrafts();
    clearMessages();
  };

  const handleLessonChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setLessonCode(
      event.target.value
    );

    setKnowledge(null);
    resetQuestionDrafts();
    clearMessages();
  };

  /* =====================================================
     MA TRẬN CÂU HỎI
  ===================================================== */

  const handleCountChange = (
    type: QuestionType,
    level: QuestionLevel,
    value: string
  ) => {
    const numberValue = Number(value);

    const safeValue =
      Number.isInteger(numberValue) &&
      numberValue >= 0
        ? Math.min(numberValue, 20)
        : 0;

    setSpecifications((current) =>
      current.map((item) =>
        item.type === type &&
        item.level === level
          ? {
              ...item,
              count: safeValue,
            }
          : item
      )
    );
  };

  const handleResetMatrix = () => {
    setSpecifications(
      createInitialSpecifications()
    );

    setSuccessMessage(
      "Đã đặt lại ma trận câu hỏi."
    );

    setErrorMessage("");
  };

  /* =====================================================
     SINH CÂU HỎI BẰNG AI
  ===================================================== */

  const handleGenerateQuestions =
    async () => {
      if (
        !selectedSubject ||
        !selectedGrade ||
        !selectedChapter ||
        !selectedLesson
      ) {
        setErrorMessage(
          "Thông tin bài học chưa đầy đủ."
        );
        return;
      }

      if (!knowledge || !hasKnowledge) {
        setErrorMessage(
          "Bài học chưa có học liệu chuẩn để sinh câu hỏi."
        );
        return;
      }

      if (totalQuestionCount <= 0) {
        setErrorMessage(
          "Hãy nhập số lượng cho ít nhất một dạng câu hỏi."
        );
        return;
      }

      if (totalQuestionCount > 50) {
        setErrorMessage(
          "Mỗi lần chỉ được sinh tối đa 50 câu hỏi."
        );
        return;
      }

      setIsGenerating(true);
      setErrorMessage("");
      setSuccessMessage("");
      setEditingQuestionId(null);
      setEditingBackup(null);

      try {
        const result =
          await generateQuestionsFromKnowledge(
            {
              lessonCode:
                selectedLesson.lessonCode,

              lessonTitle:
                selectedLesson.title,

              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              chapterTitle:
                selectedChapter.title,

              knowledge,
              specifications,
            }
          );

        const aiQuestions: EditableQuestion[] =
          result.questions.map(
            (question) => ({
              ...question,
              sourceType: "ai",
            })
          );

        /*
         * Nối câu AI mới vào đầu danh sách,
         * không xóa câu upload hoặc câu thủ công.
         */
        setGeneratedQuestions(
          (current) => [
            ...aiQuestions,
            ...current,
          ]
        );

        setUsedModel(
          result.model ?? ""
        );

        setSuccessMessage(
          `AI đã sinh ${aiQuestions.length} câu hỏi. Giáo viên có thể chỉnh sửa trước khi lưu vào ngân hàng.`
        );
      } catch (error) {
        console.error(
          "Lỗi sinh câu hỏi:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể sinh câu hỏi."
        );
      } finally {
        setIsGenerating(false);
      }
    };

  /* =====================================================
     CẬP NHẬT CÂU HỎI TRONG STATE
  ===================================================== */

  const updateQuestion = (
    questionId: string,
    patch: Partial<EditableQuestion>
  ) => {
    setGeneratedQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              ...patch,
            }
          : question
      )
    );
  };

  const handleStartEditing = (
    question: EditableQuestion
  ) => {
    setEditingQuestionId(question.id);

    setEditingBackup({
      ...question,
      options: question.options
        ? [...question.options]
        : undefined,

      sourceKnowledgeIds: [
        ...question.sourceKnowledgeIds,
      ],
    });

    clearMessages();
  };

  const handleCancelEditing = () => {
    if (
      editingQuestionId &&
      editingBackup
    ) {
      setGeneratedQuestions(
        (current) =>
          current.map((question) =>
            question.id ===
            editingQuestionId
              ? editingBackup
              : question
          )
      );
    }

    setEditingQuestionId(null);
    setEditingBackup(null);
    setErrorMessage("");
  };

  const validateQuestion = (
    question: EditableQuestion
  ): string | null => {
    if (!question.question.trim()) {
      return "Nội dung câu hỏi không được để trống.";
    }

    if (!question.correctAnswer.trim()) {
      return "Đáp án không được để trống.";
    }

    if (
      question.type ===
        "multiple_choice" &&
      (!question.options ||
        question.options.length !== 4)
    ) {
      return "Câu trắc nghiệm phải có đúng 4 phương án.";
    }

    if (
      question.options?.some(
        (option) => !option.trim()
      )
    ) {
      return "Các phương án không được để trống.";
    }

    if (
      question.options &&
      !question.options.includes(
        question.correctAnswer
      )
    ) {
      return "Đáp án đúng phải khớp với một phương án.";
    }

    return null;
  };
  const handleReviewQuestion = (
  questionId: string
) => {
  const question =
    generatedQuestions.find(
      (item) => item.id === questionId
    );

  if (!question) {
    return;
  }

  const validationMessage =
    validateQuestion(question);

  if (validationMessage) {
    setErrorMessage(
      validationMessage
    );

    return;
  }

  setGeneratedQuestions(
    (current) =>
      current.map((item) =>
        item.id === questionId
          ? {
              ...item,
              status:
                "reviewed" as const,
            }
          : item
      )
  );

  setErrorMessage("");

  setSuccessMessage(
    "Câu hỏi đã được giáo viên thẩm định."
  );
};

const handleSaveToQuestionBank =
  async () => {console.log(
  "=== ĐÃ BẤM GỬI NGÂN HÀNG ==="
);
    if (
      !selectedSubject ||
      !selectedGrade ||
      !selectedChapter ||
      !selectedLesson
    ) {
      setErrorMessage(
        "Thông tin bài học chưa đầy đủ."
      );

      return;
    }    const reviewedQuestions =
      generatedQuestions.filter(
        (question) =>
          question.status === "reviewed"
      );

    if (reviewedQuestions.length === 0) {
      setErrorMessage(
        "Chưa có câu hỏi nào được thẩm định."
      );
      return;
    }

    setIsSavingBank(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      console.log(
        "=== BẮT ĐẦU KIỂM TRA TRÙNG ==="
      );

      const duplicateResults =
        await checkQuestionsDuplicateBatch(
          reviewedQuestions.map(
            (question) => ({
              id: question.id,
              lessonCode:
                selectedLesson.lessonCode,
              question:
                question.question,
            })
          )
        );

      const duplicateSummary =
        summarizeDuplicateResults(
          duplicateResults
        );

      console.log(
        "KẾT QUẢ KIỂM TRA TRÙNG:",
        duplicateSummary
      );

      const exactDuplicateIds =
        new Set(
          duplicateSummary
            .exactDuplicateIds
        );

      const questionsToSave =
        reviewedQuestions.filter(
          (question) =>
            !exactDuplicateIds.has(
              question.id
            )
        );

      /* CÓ CÂU TRÙNG */
      if (
        duplicateSummary.exactCount > 0
      ) {
        window.alert(
          `Phát hiện ${duplicateSummary.exactCount} câu hỏi trùng chính xác với ngân hàng.\n\n` +
          `Các câu trùng sẽ KHÔNG được lưu thêm.`
        );
      }

      /* TẤT CẢ ĐỀU TRÙNG */
      if (
        questionsToSave.length === 0
      ) {
        setErrorMessage(
          "Tất cả câu hỏi đã tồn tại trong ngân hàng."
        );
        return;
      }

      /* LƯU CÂU KHÔNG TRÙNG */
      const result =
        await saveApprovedQuestions(
          questionsToSave.map(
            (question) => ({
              id: question.id,

              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              chapterTitle:
                selectedChapter.title,

              lessonCode:
                selectedLesson.lessonCode,

              lessonTitle:
                selectedLesson.title,

              type:
                question.type,

              level:
                question.level,

              question:
                question.question,

              options:
                question.options,

              correctAnswer:
                question.correctAnswer,

              explanation:
                question.explanation,

              sourceKnowledgeIds:
                question.sourceKnowledgeIds,

              sourceType:
                question.sourceType,

              createdBy:
                "teacher",
            })
          )
        );

      const savedSourceIds =
        new Set(
          result.savedItems.map(
            (item) =>
              item.sourceQuestionId
          )
        );

      setGeneratedQuestions(
        (current) =>
          current.map(
            (question) =>
              savedSourceIds.has(
                question.id
              )
                ? {
                    ...question,
                    status:
                      "approved" as const,
                  }
                : question
          )
      );

      setSuccessMessage(
        `Đã lưu ${result.total} câu hỏi mới vào ngân hàng.`
      );
    } catch (error) {
      console.error(
        "Lỗi gửi ngân hàng:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể gửi câu hỏi vào ngân hàng."
      );
    } finally {
      setIsSavingBank(false);
    }
  };

    const handleFinishEditing = (
    questionId: string
  ) => {
    const question =
      generatedQuestions.find(
        (item) =>
          item.id === questionId
      );

    if (!question) {
      return;
    }

    const validationMessage =
      validateQuestion(question);

    if (validationMessage) {
      setErrorMessage(
        validationMessage
      );
      return;
    }

    setEditingQuestionId(null);
    setEditingBackup(null);
    setErrorMessage("");

    setSuccessMessage(
      "Đã cập nhật câu hỏi trong danh sách nháp."
    );
  };

  const handleQuestionTypeChange = (
    questionId: string,
    type: QuestionType
  ) => {
    if (
      type === "multiple_choice"
    ) {
      updateQuestion(questionId, {
        type,
        options: [
          "Phương án A",
          "Phương án B",
          "Phương án C",
          "Phương án D",
        ],
        correctAnswer: "Phương án A",
      });

      return;
    }

    if (type === "true_false") {
      updateQuestion(questionId, {
        type,
        options: ["Đúng", "Sai"],
        correctAnswer: "Đúng",
      });

      return;
    }

    updateQuestion(questionId, {
      type,
      options: undefined,
      correctAnswer: "",
    });
  };

  const handleOptionChange = (
    questionId: string,
    optionIndex: number,
    value: string
  ) => {
    setGeneratedQuestions(
      (current) =>
        current.map((question) => {
          if (
            question.id !== questionId
          ) {
            return question;
          }

          const oldOptions =
            question.options ?? [];

          const oldOption =
            oldOptions[optionIndex] ??
            "";

          const newOptions =
            oldOptions.map(
              (option, index) =>
                index === optionIndex
                  ? value
                  : option
            );

          return {
            ...question,
            options: newOptions,

            correctAnswer:
              question.correctAnswer ===
              oldOption
                ? value
                : question.correctAnswer,
          };
        })
    );
  };

  /* =====================================================
     THÊM VÀ XÓA CÂU HỎI
  ===================================================== */

  const handleAddManualQuestion = () => {
    if (!selectedLesson) {
      setErrorMessage(
        "Chưa chọn bài học."
      );
      return;
    }

    const newQuestion =
      createBlankQuestion({
        lessonCode:
          selectedLesson.lessonCode,

        lessonTitle:
          selectedLesson.title,
      });

    setGeneratedQuestions(
      (current) => [
        newQuestion,
        ...current,
      ]
    );

    setEditingQuestionId(
      newQuestion.id
    );

    setEditingBackup(null);
    setErrorMessage("");

    setSuccessMessage(
      "Đã thêm câu hỏi thủ công. Hãy nhập nội dung và đáp án."
    );
  };

  const handleDeleteQuestion = (
    questionId: string
  ) => {
    const confirmed =
      window.confirm(
        "Bạn có chắc muốn xóa câu hỏi này?"
      );

    if (!confirmed) {
      return;
    }

    setGeneratedQuestions(
      (current) =>
        current.filter(
          (question) =>
            question.id !==
            questionId
        )
    );

    if (
      editingQuestionId ===
      questionId
    ) {
      setEditingQuestionId(null);
      setEditingBackup(null);
    }

    setSuccessMessage(
      "Đã xóa câu hỏi khỏi danh sách nháp."
    );

    setErrorMessage("");
  };

  /* =====================================================
     UPLOAD FILE CÂU HỎI
  ===================================================== */

  const handleChooseUploadFile =
    () => {
      uploadInputRef.current?.click();
    };

  const handleUploadFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!selectedLesson) {
      setErrorMessage(
        "Chưa chọn bài học."
      );
      return;
    }

    setIsUploading(true);
    clearMessages();

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() ?? "";

      const content =
        await file.text();

      let uploadedQuestions:
        EditableQuestion[] = [];

      if (extension === "json") {
        const parsed =
          JSON.parse(content);

        const rawQuestions =
          Array.isArray(parsed)
            ? parsed
            : typeof parsed ===
                  "object" &&
                parsed !== null &&
                Array.isArray(
                  (
                    parsed as {
                      questions?: unknown[];
                    }
                  ).questions
                )
              ? (
                  parsed as {
                    questions: unknown[];
                  }
                ).questions
              : [];

        uploadedQuestions =
          rawQuestions
            .map((item, index) =>
              normalizeUploadedQuestion(
                item,
                index,
                selectedLesson.lessonCode,
                selectedLesson.title
              )
            )
            .filter(
              (
                item
              ): item is EditableQuestion =>
                item !== null
            );
      } else if (
        extension === "txt"
      ) {
        uploadedQuestions =
          parseTextQuestions(
            content,
            selectedLesson.lessonCode,
            selectedLesson.title
          );
      } else {
        throw new Error(
          "Hiện chỉ hỗ trợ file TXT và JSON."
        );
      }

      if (
        uploadedQuestions.length === 0
      ) {
        throw new Error(
          "Không tìm thấy câu hỏi hợp lệ trong file."
        );
      }

      setGeneratedQuestions(
        (current) => [
          ...uploadedQuestions,
          ...current,
        ]
      );

      setSuccessMessage(
        `Đã nhập ${uploadedQuestions.length} câu hỏi từ file ${file.name}.`
      );
    } catch (error) {
      console.error(
        "Lỗi upload câu hỏi:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đọc file câu hỏi."
      );
    } finally {
      setIsUploading(false);

      if (
        uploadInputRef.current
      ) {
        uploadInputRef.current.value =
          "";
      }
    }
  };

  /* =====================================================
     GIAO DIỆN
  ===================================================== */

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-50">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".txt,.json"
        onChange={handleUploadFile}
        className="hidden"
      />

      {/* TIÊU ĐỀ VÀ CÁC NÚT CHÍNH */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Giáo viên / Ngân hàng câu hỏi
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Sinh và biên tập câu hỏi
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Chọn Curriculum và học liệu chuẩn từ Firestore,
            sinh câu hỏi bằng AI, upload câu hỏi của giáo viên
            hoặc thêm thủ công trước khi đưa vào ngân hàng.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* NÚT UPLOAD */}
          <button
            type="button"
            onClick={
              handleChooseUploadFile
            }
            disabled={isBusy}
            className="flex items-center gap-2 rounded-xl border border-blue-600 bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? (
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
            ) : (
              <Upload size={19} />
            )}

            {isUploading
              ? "Đang đọc file..."
              : "Upload câu hỏi"}
          </button>

          {/* NÚT THÊM THỦ CÔNG */}
          <button
            type="button"
            onClick={
              handleAddManualQuestion
            }
            disabled={isBusy}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilePlus2 size={19} />
            Thêm thủ công
          </button>

          {/* NÚT SINH BẰNG AI */}
          <button
            type="button"
            onClick={
              handleGenerateQuestions
            }
            disabled={
              isBusy || !hasKnowledge
            }
            className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
            ) : (
              <Sparkles size={19} />
            )}

            {isGenerating
              ? "Đang sinh câu hỏi..."
              : `Sinh ${totalQuestionCount} câu hỏi`}
          </button>
        </div>
      </div>

      {/* THÔNG BÁO LỖI */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span>{errorMessage}</span>
        </div>
      )}

      {/* THÔNG BÁO THÀNH CÔNG */}
      {successMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span>
            {successMessage}
          </span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* CỘT CHỌN HỌC LIỆU */}
        <aside>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2 font-bold text-slate-800">
              <BookOpen
                size={20}
                className="text-blue-700"
              />

              Chọn học liệu
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
                  onChange={
                    handleSubjectChange
                  }
                  disabled={isBusy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
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
                        key={subject.id}
                        value={subject.id}
                      >
                        {subject.name}
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
                    selectedGrade?.id ??
                    ""
                  }
                  onChange={
                    handleGradeChange
                  }
                  disabled={isBusy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
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
                        Lớp {grade.grade}
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
                  onChange={
                    handleChapterChange
                  }
                  disabled={isBusy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                >
                  {selectedGrade?.chapters.map(
                    (chapter) => (
                      <option
                        key={chapter.id}
                        value={chapter.id}
                      >
                        Chương{" "}
                        {
                          chapter.chapterNo
                        }
                        : {chapter.title}
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
                  onChange={
                    handleLessonChange
                  }
                  disabled={isBusy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                >
                  {selectedChapter?.lessons.map(
                    (lesson) => (
                      <option
                        key={lesson.id}
                        value={
                          lesson.lessonCode
                        }
                      >
                        Bài{" "}
                        {
                          lesson.lessonNo
                        }
                        . {lesson.title}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div
              className={`mt-5 rounded-lg border p-4 ${
                hasKnowledge
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <p className="text-xs font-bold uppercase text-slate-600">
                Trạng thái học liệu
              </p>

              <p className="mt-2 text-sm font-bold text-slate-900">
                {selectedLesson?.lessonCode}
              </p>

              <p
                className={`mt-1 text-sm font-semibold ${
                  hasKnowledge
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {isLoadingKnowledge
                  ? "Đang tải từ Firestore..."
                  : hasKnowledge
                    ? "Đã có học liệu chuẩn"
                    : "Chưa có học liệu chuẩn"}
              </p>

              {hasKnowledge && knowledge && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-md bg-white/70 px-2 py-1.5">
                    <strong>
                      {knowledge.knowledgeUnits.length}
                    </strong>{" "}
                    đơn vị kiến thức
                  </div>

                  <div className="rounded-md bg-white/70 px-2 py-1.5">
                    <strong>
                      {knowledge.objectives.length}
                    </strong>{" "}
                    mục tiêu
                  </div>

                  <div className="rounded-md bg-white/70 px-2 py-1.5">
                    <strong>
                      {knowledge.keywords.length}
                    </strong>{" "}
                    từ khóa
                  </div>

                  <div className="rounded-md bg-white/70 px-2 py-1.5">
                    <strong>
                      {knowledge.activities.length}
                    </strong>{" "}
                    hoạt động
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (
                    selectedLesson?.lessonCode
                  ) {
                    void loadKnowledge(
                      selectedLesson.lessonCode
                    );
                  }
                }}
                disabled={isBusy}
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    isLoadingKnowledge
                      ? "animate-spin"
                      : ""
                  }
                />

                Tải lại học liệu
              </button>
            </div>
          </section>
        </aside>

        {/* CỘT NỘI DUNG */}
        <main className="space-y-5">
          {/* MA TRẬN */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ma trận cấu hình câu hỏi
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Nhập số lượng câu theo
                  dạng và mức độ.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleResetMatrix
                }
                disabled={isBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Đặt lại
              </button>
            </div>

            <div className="overflow-x-auto p-6">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700">
                      Dạng câu hỏi
                    </th>

                    {questionLevels.map(
                      (level) => (
                        <th
                          key={
                            level.value
                          }
                          className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700"
                        >
                          {level.label}
                        </th>
                      )
                    )}

                    <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700">
                      Tổng
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {questionTypes.map(
                    (type) => {
                      const rowTotal =
                        specifications
                          .filter(
                            (item) =>
                              item.type ===
                              type.value
                          )
                          .reduce(
                            (
                              total,
                              item
                            ) =>
                              total +
                              item.count,
                            0
                          );

                      return (
                        <tr
                          key={
                            type.value
                          }
                        >
                          <td className="border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
                            {type.label}
                          </td>

                          {questionLevels.map(
                            (level) => {
                              const specification =
                                specifications.find(
                                  (
                                    item
                                  ) =>
                                    item.type ===
                                      type.value &&
                                    item.level ===
                                      level.value
                                );

                              return (
                                <td
                                  key={
                                    level.value
                                  }
                                  className="border border-slate-200 px-3 py-3 text-center"
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={
                                      specification?.count ??
                                      0
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      handleCountChange(
                                        type.value,
                                        level.value,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    disabled={
                                      isBusy
                                    }
                                    className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold outline-none focus:border-blue-500 disabled:bg-slate-100"
                                  />
                                </td>
                              );
                            }
                          )}

                          <td className="border border-slate-200 px-4 py-3 text-center text-lg font-bold text-blue-700">
                            {rowTotal}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <td
                      colSpan={5}
                      className="border border-slate-200 bg-blue-50 px-4 py-3 text-right text-sm font-bold text-blue-900"
                    >
                      Tổng số câu hỏi
                    </td>

                    <td className="border border-slate-200 bg-blue-50 px-4 py-3 text-center text-xl font-bold text-blue-700">
                      {
                        totalQuestionCount
                      }
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* DANH SÁCH CÂU HỎI */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileQuestion
                  size={20}
                  className="text-blue-700"
                />

                <div>
                  <h2 className="font-bold text-slate-900">
                    Danh sách câu hỏi
                    nháp
                  </h2>

                  <p className="text-sm text-slate-500">
                    Giáo viên có thể chỉnh
                    sửa, xóa hoặc bổ sung câu
                    hỏi.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">
                  {
                    generatedQuestions.length
                  }{" "}
                  câu
                </span>

                {usedModel && (
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {usedModel}
                  </span>
                )}
              </div>
            </div>

            {isGenerating ? (
              <div className="flex items-center justify-center gap-3 p-14 text-sm font-semibold text-slate-500">
                <LoaderCircle
                  size={24}
                  className="animate-spin"
                />

                AI đang sinh câu hỏi...
              </div>
            ) : generatedQuestions.length ===0 ? (
              <div className="p-12 text-center">
                <FileQuestion
                  size={44}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-4 font-semibold text-slate-700">
                  Chưa có câu hỏi
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Sinh bằng AI, upload file
                  TXT/JSON hoặc thêm thủ công.
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                {generatedQuestions.map(
                  (item, index) => {
                    const isEditing =
                      editingQuestionId ===
                      item.id;

                    return (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-5 ${
                          isEditing
                            ? "border-blue-300 bg-blue-50/30"
                            : "border-slate-200"
                        }`}
                      >
                        {/* NHÃN VÀ NÚT */}
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                              Câu{" "}
                              {index + 1}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getLevelBadgeClass(
                                item.level
                              )}`}
                            >
                              {getQuestionLevelLabel(
                                item.level
                              )}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {getQuestionTypeLabel(
                                item.type
                              )}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getSourceBadgeClass(
                                item.sourceType
                              )}`}
                            >
                              {getSourceLabel(
                                item.sourceType
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleFinishEditing(
                                      item.id
                                    )
                                  }
                                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                                >
                                  <Save
                                    size={
                                      15
                                    }
                                  />
                                  Hoàn tất
                                </button>

                                <button
                                  type="button"
                                  onClick={
                                    handleCancelEditing
                                  }
                                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                >
                                  <X
                                    size={
                                      15
                                    }
                                  />
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartEditing(
                                    item
                                  )
                                }
                                className="flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                              >
                                <Edit3
                                  size={15}
                                />
                                Chỉnh sửa
                              </button>
                              
                            )}
                             {item.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleReviewQuestion(item.id)
                              }
                              className={
                                item.status === "reviewed"
                                  ? "flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                                  : "flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                              }
                            >
                              <CheckCircle size={15} />

                              {item.status === "reviewed"
                                ? "Đã thẩm định"
                                : "Xác nhận đạt"}
                            </button>
                          )}

                          {item.status === "approved" && (
                            <span className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold text-blue-700">
                              ✓ Đã vào ngân hàng
                            </span>
                          )} 
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteQuestion(
                                  item.id
                                )
                              }
                              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                            >
                              <Trash2
                                size={15}
                              />
                              Xóa
                            </button>
                          </div>
                        </div>

                        {/* CHẾ ĐỘ CHỈNH SỬA */}
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                                  Dạng câu
                                </span>

                                <select
                                  value={
                                    item.type
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleQuestionTypeChange(
                                      item.id,
                                      event
                                        .target
                                        .value as QuestionType
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                  {questionTypes.map(
                                    (
                                      option
                                    ) => (
                                      <option
                                        key={
                                          option.value
                                        }
                                        value={
                                          option.value
                                        }
                                      >
                                        {
                                          option.label
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                                  Mức độ
                                </span>

                                <select
                                  value={
                                    item.level
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateQuestion(
                                      item.id,
                                      {
                                        level:
                                          event
                                            .target
                                            .value as QuestionLevel,
                                      }
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                  {questionLevels.map(
                                    (
                                      option
                                    ) => (
                                      <option
                                        key={
                                          option.value
                                        }
                                        value={
                                          option.value
                                        }
                                      >
                                        {
                                          option.label
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>
                            </div>

                            <label className="block">
                              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                                Nội dung câu hỏi
                              </span>

                              <textarea
                                value={
                                  item.question
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateQuestion(
                                    item.id,
                                    {
                                      question:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-500"
                              />
                            </label>

                            {/* PHƯƠNG ÁN */}
                            {item.options && (
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                                  Các phương án
                                </p>

                                <div className="space-y-2">
                                  {item.options.map(
                                    (
                                      option,
                                      optionIndex
                                    ) => (
                                      <div
                                        key={
                                          optionIndex
                                        }
                                        className="flex items-center gap-3"
                                      >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
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
                                            handleOptionChange(
                                              item.id,
                                              optionIndex,
                                              event
                                                .target
                                                .value
                                            )
                                          }
                                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                        />
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ĐÁP ÁN */}
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                                Đáp án đúng
                              </span>

                              {item.options ? (
                                <select
                                  value={
                                    item.correctAnswer
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateQuestion(
                                      item.id,
                                      {
                                        correctAnswer:
                                          event
                                            .target
                                            .value,
                                      }
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                  <option value="">
                                    Chọn đáp án
                                  </option>

                                  {item.options.map(
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
                                        {option}
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                <textarea
                                  value={
                                    item.correctAnswer
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateQuestion(
                                      item.id,
                                      {
                                        correctAnswer:
                                          event
                                            .target
                                            .value,
                                      }
                                    )
                                  }
                                  rows={2}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                />
                              )}
                            </label>

                            {/* GIẢI THÍCH */}
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                                Giải thích đáp án
                              </span>

                              <textarea
                                value={
                                  item.explanation
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateQuestion(
                                    item.id,
                                    {
                                      explanation:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                rows={3}
                                placeholder="Nhập giải thích hoặc căn cứ kiến thức..."
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-500"
                              />
                            </label>
                          </div>
                        ) : (
                          /* CHẾ ĐỘ XEM */
                          <>
                            <h3 className="text-base font-bold leading-7 text-slate-900">
                              {item.question ||
                                "Chưa nhập nội dung câu hỏi"}
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
                                      const isCorrect =
                                        option ===
                                        item.correctAnswer;

                                      return (
                                        <div
                                          key={
                                            optionIndex
                                          }
                                          className={`rounded-lg border px-4 py-3 text-sm ${
                                            isCorrect
                                              ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                                              : "border-slate-200 bg-slate-50 text-slate-700"
                                          }`}
                                        >
                                          <strong>
                                            {String.fromCharCode(
                                              65 +
                                                optionIndex
                                            )}
                                            .
                                          </strong>{" "}
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

                              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-emerald-700">
                                {item.correctAnswer ||
                                  "Chưa nhập đáp án"}
                              </p>
                            </div>

                            {item.explanation && (
                              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <p className="text-sm font-bold text-blue-800">
                                  Giải thích
                                </p>

                                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-blue-700">
                                  {
                                    item.explanation
                                  }
                                </p>
                              </div>
                            )}

                            {item
                              .sourceKnowledgeIds
                              .length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-bold uppercase text-slate-500">
                                  Nguồn kiến thức
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {item.sourceKnowledgeIds.map(
                                    (
                                      sourceId
                                    ) => (
                                      <span
                                        key={`${item.id}-${sourceId}`}
                                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                                      >
                                        {
                                          sourceId
                                        }
                                      </span>
                                    )
                                  )}
                                </div>
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

            {/* NÚT THÊM Ở CUỐI DANH SÁCH */}
            {generatedQuestions.length > 0 && (
  <div className="flex justify-center border-t border-slate-200 px-6 py-5">
    <button
      type="button"
      onClick={handleSaveToQuestionBank}
      disabled={
        isSavingBank ||
        !generatedQuestions.some(
          (question) =>
            question.status === "reviewed"
        )
      }
      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {isSavingBank ? (
        <LoaderCircle
          size={18}
          className="animate-spin"
        />
      ) : (
        <Save size={18} />
      )}
      {isSavingBank
        ? "Đang gửi vào ngân hàng..."
        : "Gửi câu đã thẩm định vào ngân hàng"}
    </button>
  </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

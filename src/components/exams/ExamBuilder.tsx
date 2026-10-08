import { useEffect, useMemo, useState } from "react";
import {
  saveExam,
  type SavedExam,
} from "@/services/examService";
import {
  downloadExamDocx,
  downloadExamPdf,
  downloadAnswerDocx,
  downloadAnswerPdf,
  type ExamExportData,
} from "@/services/examExportService";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  getAllCurriculums,
  type CurriculumDocument,
} from "@/services/curriculumService";
import useUserScope from "@/lib/useUserScope";
import { parseSpecificationFile } from "@/services/examSpecificationFileService";

import {
  checkExamMatrixAvailability,
  checkExamSpecificationAvailability,
  generateExamQuestions,
  generateExamQuestionsFromSpecification,
  generateExamQuestionsKeepingLocked,
  getReplacementExamQuestion,
  type ExamBankQuestion,
  type ExamMatrixCheckResult,
  type ExamSpecificationRequirement,
} from "@/services/examQuestionService";

type ExamType =
  | "15_minutes"
  | "midterm"
  | "final";

type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay";

type QuestionLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

interface MatrixCell {
  type: QuestionType;
  level: QuestionLevel;

  count: number;

  // Điểm của MỖI câu trong ô ma trận
  scorePerQuestion: number;
}

const questionTypeRows: Array<{
  value: QuestionType;
  label: string;
}> = [
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

const questionLevels: Array<{
  value: QuestionLevel;
  label: string;
}> = [
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

function createInitialMatrix(): MatrixCell[] {
  const result: MatrixCell[] = [];

  questionTypeRows.forEach((type) => {
    questionLevels.forEach((level) => {
      result.push({
      type: type.value,
      level: level.value,
      count: 0,
      scorePerQuestion: 0,
      });
    });
  });

  return result;
}


function createSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededShuffle<T>(
  items: T[],
  seed: number
): T[] {
  const result = [...items];
  let state = seed || 1;

  const random = () => {
    state =
      Math.imul(
        state ^ (state >>> 15),
        1 | state
      ) >>> 0;

    state =
      (state +
        Math.imul(
          state ^ (state >>> 7),
          61 | state
        )) >>> 0;

    return (
      ((state ^ (state >>> 14)) >>> 0) /
      4294967296
    );
  };

  for (
    let index = result.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      Math.floor(
        random() * (index + 1)
      );

    [
      result[index],
      result[swapIndex],
    ] = [
      result[swapIndex],
      result[index],
    ];
  }

  return result;
}

function createExamVariant(
  questions: ExamBankQuestion[],
  examCode: string
): ExamBankQuestion[] {
  const questionTypes: QuestionType[] = [
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
  ];

  return questionTypes.flatMap(
    (type) => {
      const typeQuestions =
        questions.filter(
          (question) =>
            question.type === type
        );

      const shuffledQuestions =
        seededShuffle(
          typeQuestions,
          createSeed(
            `${examCode}-${type}`
          )
        );

      return shuffledQuestions.map(
        (question) => {
          if (
            question.type !==
              "multiple_choice" ||
            !Array.isArray(
              question.options
            )
          ) {
            return question;
          }

          return {
            ...question,

            options:
              seededShuffle(
                question.options,
                createSeed(
                  `${examCode}-${question.id}-options`
                )
              ),
          };
        }
      );
    }
  );
}

interface ExamCurriculumLesson {
  id: string;
  code: string;
  lessonCode: string;
  lessonNo: number;
  title: string;
  startPage?: number;
  endPage?: number;
  status:
    | "empty"
    | "imported"
    | "reviewed"
    | "published";
}

interface ExamCurriculumChapter {
  id: string;
  chapterNo: number;
  title: string;
  lessons: ExamCurriculumLesson[];
}

interface ExamCurriculumGrade {
  id: string;
  grade: number;
  chapters: ExamCurriculumChapter[];
}

interface ExamCurriculumSubject {
  id: string;
  code: string;
  name: string;
  grades: ExamCurriculumGrade[];
}

interface ExamBuilderProps {
  mode: "teacher" | "admin";
  initialExam?: SavedExam;
  copyExam?: boolean;
}
export default function ExamBuilder({
  mode,
  initialExam,
  copyExam = false,
}: ExamBuilderProps) {
  const [restored, setRestored] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | undefined>(undefined);
  const [savedGuides, setSavedGuides] = useState<Record<string, SavedExam["questions"][number]["markingGuide"]>>({});
  const isAdmin =
    mode === "admin";
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
    isLoadingCurriculum,
    setIsLoadingCurriculum,
  ] = useState(true);

  const [subjectId, setSubjectId] =
    useState("");

  const [gradeId, setGradeId] =
    useState("");

  const [
    selectedChapterId,
    setSelectedChapterId,
  ] = useState("");

  const [examName, setExamName] = useState(
    "Kiểm tra giữa học kỳ I"
  );

  const [examType, setExamType] =
    useState<ExamType>("midterm");
  const [examSemester, setExamSemester] = useState<"1" | "2">("1");
  const [
  duration,
  setDuration,
    ] = useState(90);
  const [
    numberOfExamCodes,
    setNumberOfExamCodes,
  ] = useState(1);

  const [
    selectedExamCode,
    setSelectedExamCode,
  ] = useState("101");

  const [restoredExamCodes, setRestoredExamCodes] = useState<string[] | null>(null);
  const examCodes = useMemo(
    () =>
      restoredExamCodes ?? Array.from(
        {
          length:
            numberOfExamCodes,
        },
        (_, index) =>
          String(101 + index)
      ),
    [numberOfExamCodes, restoredExamCodes]
  );

  const [
    selectedLessonCodes,
    setSelectedLessonCodes,
  ] = useState<string[]>([]);

  const [matrix, setMatrix] =
    useState<MatrixCell[]>(
      createInitialMatrix()
    );
  const [importedRows, setImportedRows] = useState<ExamSpecificationRequirement[]>([]);
  const [importedName, setImportedName] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const [
    isCheckingBank,
    setIsCheckingBank,
  ] = useState(false);

  const [
    bankCheckResult,
    setBankCheckResult,
  ] =
    useState<ExamMatrixCheckResult | null>(
      null
    );
  const [
    generatedExam,
    setGeneratedExam,
  ] = useState<ExamBankQuestion[]>([]);

  const [
    isGeneratingExam,
    setIsGeneratingExam,
  ] = useState(false);
  const [
    replacingQuestionId,
    setReplacingQuestionId,
  ] = useState<string | null>(
    null
  );
  const [
  replacementWarning,
  setReplacementWarning,
] = useState<{
  questionId: string;
  message: string;
} | null>(null);
  const [
    lockedQuestionIds,
    setLockedQuestionIds,
  ] = useState<string[]>([]);

  const [
    warningMessage,
    setWarningMessage,
  ] = useState("");

  const [
  isSavingExam,
  setIsSavingExam,
  ] = useState(false);

const [
  savedExamId,
  setSavedExamId,
] = useState<string | null>(
  null
);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /**
   * Chuẩn hóa Curriculum từ Firestore.
   *
   * Dữ liệu cũ/mới có thể lưu chapters ở các vị trí khác nhau
   * (chapters, structure.chapters, curriculum.chapters, data.chapters...).
   * Vì vậy ExamBuilder không nên phụ thuộc duy nhất curriculum.chapters.
   */
  const curriculumTree =
    useMemo<ExamCurriculumSubject[]>(
      () => {
        const subjectMap =
          new Map<string, ExamCurriculumSubject>();

        const asRecord = (value: unknown): Record<string, unknown> =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown> : {};
        const asArray = (value: unknown): Record<string, unknown>[] =>
          Array.isArray(value) ? value.map(asRecord) : [];

        const firstArray = (
          source: unknown,
          keys: string[]
        ): Record<string, unknown>[] => {
          for (const key of keys) {
            const value = asRecord(source)[key];
            if (Array.isArray(value)) {
              return asArray(value);
            }
          }
          return [];
        };

        const getRawChapters = (curriculum: Record<string, unknown>): Record<string, unknown>[] => {
          const direct = firstArray(curriculum, [
            "chapters",
            "topics",
            "units",
          ]);
          if (direct.length > 0) return direct;

          const containers = [
            curriculum?.structure,
            curriculum?.curriculum,
            curriculum?.data,
            curriculum?.content,
            curriculum?.book,
          ];

          for (const container of containers) {
            const nested = firstArray(container, [
              "chapters",
              "topics",
              "units",
            ]);
            if (nested.length > 0) return nested;
          }

          return [];
        };

        const getRawLessons = (chapter: Record<string, unknown>): Record<string, unknown>[] => {
          const direct = firstArray(chapter, [
            "lessons",
            "lessonList",
            "items",
            "contents",
          ]);
          if (direct.length > 0) return direct;

          const containers = [
            chapter?.structure,
            chapter?.data,
            chapter?.content,
          ];

          for (const container of containers) {
            const nested = firstArray(container, [
              "lessons",
              "lessonList",
              "items",
              "contents",
            ]);
            if (nested.length > 0) return nested;
          }

          return [];
        };

        curriculums.forEach((rawCurriculum) => {
          const curriculum = rawCurriculum as unknown as Record<string, unknown>;

          const subjectCode = String(
            curriculum?.subjectCode ??
            curriculum?.subjectId ??
            curriculum?.subject ??
            ""
          )
            .trim()
            .toUpperCase();

          const subjectName = String(
            curriculum?.subjectName ??
            curriculum?.subjectTitle ??
            curriculum?.subject ??
            subjectCode
          ).trim();

          const gradeNumber = Number(
            curriculum?.grade ??
            curriculum?.gradeNumber ??
            curriculum?.classLevel
          );

          if (!subjectCode || !Number.isFinite(gradeNumber)) {
            return;
          }
          if (
            isLoadingUserScope ||
            userScopeError ||
            !canAccessSubject(subjectCode, subjectName) ||
            !canAccessGrade(gradeNumber)
          ) {
            return;
          }

          const rawChapters = getRawChapters(curriculum);

          const chapters: ExamCurriculumChapter[] =
            rawChapters.map((rawChapter: Record<string, unknown>, chapterIndex: number) => {
              const chapterNo = Number(
                rawChapter?.chapterNo ??
                rawChapter?.number ??
                rawChapter?.order ??
                chapterIndex + 1
              );

              const chapterTitle = String(
                rawChapter?.title ??
                rawChapter?.name ??
                rawChapter?.chapterName ??
                rawChapter?.topicName ??
                `Chương ${chapterIndex + 1}`
              ).trim();

              const chapterId = String(
                rawChapter?.id ??
                rawChapter?.chapterId ??
                rawChapter?.code ??
                `${subjectCode}-${gradeNumber}-chapter-${chapterNo}`
              );

              const rawLessons = getRawLessons(rawChapter);

              const lessons: ExamCurriculumLesson[] =
                rawLessons.map((rawLesson: Record<string, unknown>, lessonIndex: number) => {
                  const lessonNo = Number(
                    rawLesson?.lessonNo ??
                    rawLesson?.number ??
                    rawLesson?.order ??
                    lessonIndex + 1
                  );

                  const lessonCode = String(
                    rawLesson?.lessonCode ??
                    rawLesson?.code ??
                    rawLesson?.id ??
                    `${subjectCode}-${gradeNumber}-${chapterNo}-${lessonNo}`
                  ).trim();

                  return {
                    id: String(
                      rawLesson?.id ??
                      lessonCode
                    ),
                    code: lessonCode,
                    lessonCode,
                    lessonNo,
                    title: String(
                      rawLesson?.title ??
                      rawLesson?.name ??
                      rawLesson?.lessonName ??
                      `Bài ${lessonNo}`
                    ).trim(),
                    startPage:
                      typeof rawLesson?.startPage === "number"
                        ? rawLesson.startPage
                        : undefined,
                    endPage:
                      typeof rawLesson?.endPage === "number"
                        ? rawLesson.endPage
                        : undefined,
                    status:
                      rawLesson?.status === "imported" ||
                      rawLesson?.status === "reviewed" ||
                      rawLesson?.status === "published"
                        ? rawLesson.status
                        : "empty",
                  };
                });

              return {
                id: chapterId,
                chapterNo,
                title: chapterTitle,
                lessons,
              };
            });

          const gradeIdValue = String(
            curriculum?.id ??
            `${subjectCode}-${gradeNumber}`
          );

          const grade: ExamCurriculumGrade = {
            id: gradeIdValue,
            grade: gradeNumber,
            chapters,
          };

          const existing = subjectMap.get(subjectCode);

          if (existing) {
            const sameGradeIndex =
              existing.grades.findIndex(
                (item) => item.grade === gradeNumber
              );

            if (sameGradeIndex >= 0) {
              // Nếu có nhiều document cùng môn/khối, gộp chương thay vì ghi đè.
              const currentGrade =
                existing.grades[sameGradeIndex];

              const chapterMap =
                new Map<string, ExamCurriculumChapter>();

              [
                ...currentGrade.chapters,
                ...grade.chapters,
              ].forEach((chapter) => {
                const key =
                  chapter.id ||
                  `${chapter.chapterNo}-${chapter.title}`;

                const oldChapter = chapterMap.get(key);

                if (!oldChapter) {
                  chapterMap.set(key, chapter);
                  return;
                }

                const lessonMap =
                  new Map<string, ExamCurriculumLesson>();

                [
                  ...oldChapter.lessons,
                  ...chapter.lessons,
                ].forEach((lesson) => {
                  lessonMap.set(
                    lesson.lessonCode || lesson.id,
                    lesson
                  );
                });

                chapterMap.set(key, {
                  ...oldChapter,
                  lessons: Array.from(
                    lessonMap.values()
                  ),
                });
              });

              existing.grades[sameGradeIndex] = {
                ...currentGrade,
                chapters: Array.from(
                  chapterMap.values()
                ).sort(
                  (a, b) =>
                    a.chapterNo - b.chapterNo
                ),
              };
            } else {
              existing.grades.push(grade);
            }
          } else {
            subjectMap.set(subjectCode, {
              id: subjectCode,
              code: subjectCode,
              name: subjectName || subjectCode,
              grades: [grade],
            });
          }
        });

        return Array.from(subjectMap.values())
          .map((subject) => ({
            ...subject,
            grades: [...subject.grades]
              .map((grade) => ({
                ...grade,
                chapters: [...grade.chapters].sort(
                  (a, b) =>
                    a.chapterNo - b.chapterNo
                ),
              }))
              .sort(
                (a, b) =>
                  a.grade - b.grade
              ),
          }))
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
                "vi"
              )
          );
      },
      [curriculums, isLoadingUserScope, userScopeError, canAccessSubject, canAccessGrade]
    );

  useEffect(() => {
    let isMounted = true;

    const loadCurriculum =
      async () => {
        setIsLoadingCurriculum(
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
                )
            );

          setCurriculums(
            valid
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
            setIsLoadingCurriculum(
              false
            );
          }
        }
      };

    void loadCurriculum();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingUserScope) return;
    if (userScopeError || curriculumTree.length === 0) {
      setSubjectId("");
      setGradeId("");
      setSelectedChapterId("");
      setSelectedLessonCodes([]);
      setGeneratedExam([]);
      setImportedRows([]);
      setImportedName("");
      setBankCheckResult(null);
      setSavedExamId(null);
      return;
    }
    const currentSubject = curriculumTree.find(
      (subject) => subject.id === subjectId
    );
    const currentGrade = currentSubject?.grades.find(
      (grade) => grade.id === gradeId
    );

    if (currentGrade) {
      return;
    }

    const firstSubject =
      currentSubject ?? curriculumTree[0];

    const firstGrade =
      firstSubject
        ?.grades?.[0];

    const firstChapter =
      firstGrade
        ?.chapters?.[0];

    setSubjectId(
      firstSubject?.id ?? ""
    );

    setGradeId(
      firstGrade?.id ?? ""
    );

    setSelectedChapterId(
      firstChapter?.id ?? ""
    );

    setSelectedLessonCodes(
      []
    );
    setImportedRows([]);
    setImportedName("");
    setGeneratedExam([]);
    setBankCheckResult(null);
    setSavedExamId(null);
  }, [
    curriculumTree,
    subjectId,
    gradeId,
    isLoadingUserScope,
    userScopeError,
  ]);

  useEffect(() => {
    if(!initialExam || restored || isLoadingCurriculum || isLoadingUserScope || userScopeError || !curriculumTree.length) return;
    const subject=curriculumTree.find(s=>s.name===initialExam.subjectName);
    const grade=subject?.grades.find(g=>g.grade===initialExam.grade);
    if(!subject || !grade) {setErrorMessage("Không còn Curriculum hoặc quyền truy cập môn/khối của đề này.");return;}
    setSubjectId(subject.id);setGradeId(grade.id);
    setSelectedChapterId(grade.chapters.find(c=>c.lessons.some(l=>initialExam.lessonCodes.includes(l.code)))?.id??grade.chapters[0]?.id??"");
    setSelectedLessonCodes(initialExam.lessonCodes);
    setImportedRows(initialExam.specification??[]);setImportedName(initialExam.specificationName??"");
    setExamName(copyExam?`${initialExam.examName} (bản mới)`:initialExam.examName);
    setExamType(initialExam.examType);setExamSemester(initialExam.examSemester??"1");setDuration(initialExam.duration);
    setNumberOfExamCodes(initialExam.examCodes?.length??1);
    setRestoredExamCodes(initialExam.examCodes?.length ? initialExam.examCodes : null);
    setSelectedExamCode(initialExam.examCodes?.[0]??"101");
    setMatrix(createInitialMatrix().map(cell=>({...cell,...initialExam.matrix.find(c=>c.type===cell.type&&c.level===cell.level)})));
    setGeneratedExam(initialExam.questions.map(q=>({id:q.questionId,subject:initialExam.subjectName,grade:initialExam.grade,chapterTitle:"",lessonCode:q.lessonCode,lessonTitle:grade.chapters.flatMap(c=>c.lessons).find(l=>l.code===q.lessonCode)?.title??q.lessonCode,type:q.type,level:q.level,question:q.question,options:q.options,correctAnswer:q.correctAnswer,explanation:q.explanation,sourceKnowledgeIds:[],sourceType:"manual",status:"approved"})));
    setSavedGuides(Object.fromEntries(initialExam.questions.map(q=>[q.questionId,q.markingGuide])));
    setEditingExamId(copyExam?undefined:initialExam.id);setSavedExamId(copyExam?null:initialExam.id);setRestored(true);
    setSuccessMessage(copyExam?"Đã mở bản sao. Lưu sẽ tạo đề mới.":"Đã mở đề đã lưu. Lưu sẽ cập nhật bản nháp này.");
  },[initialExam,copyExam,restored,isLoadingCurriculum,isLoadingUserScope,userScopeError,curriculumTree]);

  const selectedSubject = useMemo(() => {
    return (
      curriculumTree.find(
        (subject) =>
          subject.id === subjectId
      ) ??
      curriculumTree[0]
    );
  }, [
    curriculumTree,
    subjectId,
  ]);

  const selectedGrade = useMemo(() => {
    return (
      selectedSubject?.grades.find(
        (grade) =>
          grade.id === gradeId
      ) ??
      selectedSubject?.grades[0]
    );
  }, [
    selectedSubject,
    gradeId,
  ]);

  const availableChapters =
    useMemo(() => {
      return (
        selectedGrade?.chapters ?? []
      );
    }, [selectedGrade]);

  const selectedChapter =
    useMemo(() => {
      return (
        availableChapters.find(
          (chapter) =>
            chapter.id ===
            selectedChapterId
        ) ??
        availableChapters[0]
      );
    }, [
      availableChapters,
      selectedChapterId,
    ]);

  const availableLessons =
    useMemo(() => {
      if (!selectedChapter) {
        return [];
      }

      return selectedChapter.lessons.map(
        (lesson) => ({
          ...lesson,
          chapterTitle:
            selectedChapter.title,
          chapterNo:
            selectedChapter.chapterNo,
        })
      );
    }, [selectedChapter]);

  const totalQuestions = useMemo(() => {
    return matrix.reduce(
      (total, item) => total + item.count,
      0
    );
  }, [matrix]);

  const totalScore = useMemo(() => {
    return matrix.reduce(
      (total, item) =>
        total + item.count * item.scorePerQuestion,
      0
    );
  }, [matrix]);

  const mappedRows = useMemo(() => importedRows.filter((row) => row.count > 0), [importedRows]);
  const mappingComplete = mappedRows.length > 0 && mappedRows.every((row) =>
    row.lessonCode && selectedLessonCodes.includes(row.lessonCode)
  );
  const allLessons = useMemo(() => selectedGrade?.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({ code: lesson.code, title: lesson.title, chapter: chapter.title }))
  ) ?? [], [selectedGrade]);

  const handleImportMatrix = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setErrorMessage("");
    try {
      if (!selectedSubject || !selectedGrade) throw new Error("Hãy chọn môn và khối lớp trước khi tải ma trận.");
      const parsed = await parseSpecificationFile(file);
      if (!parsed.rows.length) throw new Error("File không có số câu hợp lệ.");
      // Không suy đoán lessonCode; giáo viên xác nhận từng nội dung ở bảng bên dưới.
      const rows = parsed.rows.map((row) => ({ ...row, lessonCode: "" }));
      setImportedRows(rows);
      setImportedName(parsed.fileName);
      setImportWarnings(parsed.warnings);
      setMatrix((current) => current.map((cell) => {
        const matching = rows.filter((row) => row.type === cell.type && row.level === cell.level);
        return { ...cell, count: matching.reduce((sum, row) => sum + row.count, 0),
          scorePerQuestion: matching[0]?.scorePerQuestion ?? 0 };
      }));
      setGeneratedExam([]);
      setLockedQuestionIds([]);
      clearCheckResult();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không đọc được file ma trận.");
    } finally { setImporting(false); }
  };

  const previewExam = useMemo(
    () =>
      createExamVariant(
        generatedExam,
        selectedExamCode
      ),
    [
      generatedExam,
      selectedExamCode,
    ]
  );

  const totalLessons =
    selectedLessonCodes.length;

  const clearCheckResult = () => {
    setBankCheckResult(null);
    setErrorMessage("");
    setSuccessMessage("");
    setWarningMessage("");
  };

  const handleSubjectChange = (
    value: string
  ) => {
    const newSubject =
      curriculumTree.find(
        (subject) =>
          subject.id === value
      );

    const newGrade =
      newSubject?.grades[0];

    const newChapter =
      newGrade?.chapters[0];

    setSubjectId(value);
    setGradeId(
      newGrade?.id ?? ""
    );
    setSelectedChapterId(
      newChapter?.id ?? ""
    );
    setSelectedLessonCodes([]);
    setImportedRows([]);
    setImportedName("");

    clearCheckResult();
  };

  const handleGradeChange = (
    value: string
  ) => {
    const newGrade =
      selectedSubject?.grades.find(
        (grade) =>
          grade.id === value
      );

    const newChapter =
      newGrade?.chapters[0];

    setGradeId(value);
    setSelectedChapterId(
      newChapter?.id ?? ""
    );
    setSelectedLessonCodes([]);
    setImportedRows([]);
    setImportedName("");

    clearCheckResult();
  };

  const handleChapterChange = (
    value: string
  ) => {
    setSelectedChapterId(value);
    clearCheckResult();
  };

  const handleToggleLesson = (
    code: string
  ) => {
    setSelectedLessonCodes(
      (current) =>
        current.includes(code)
          ? current.filter(
              (lessonCode) =>
                lessonCode !== code
            )
          : [
              ...current,
              code,
            ]
    );

    clearCheckResult();
  };

  const handleSelectAllLessonsInChapter =
    () => {
      const currentChapterCodes =
        availableLessons.map(
          (lesson) =>
            lesson.code
        );

      setSelectedLessonCodes(
        (current) =>
          Array.from(
            new Set([
              ...current,
              ...currentChapterCodes,
            ])
          )
      );

      clearCheckResult();
    };

  const handleClearLessonsInChapter =
    () => {
      const currentChapterCodes =
        new Set(
          availableLessons.map(
            (lesson) =>
              lesson.code
          )
        );

      setSelectedLessonCodes(
        (current) =>
          current.filter(
            (code) =>
              !currentChapterCodes.has(
                code
              )
          )
      );

      clearCheckResult();
    };

  const handleMatrixChange = (
    type: QuestionType,
    level: QuestionLevel,
    value: string
  ) => {
    if (importedRows.length) { setErrorMessage("Hãy bỏ file ma trận trước khi chỉnh số câu thủ công."); return; }
    const numberValue = Number(value);

    const safeValue =
      Number.isInteger(numberValue) && numberValue >= 0
        ? Math.min(numberValue, 50)
        : 0;

    setMatrix((current) =>
      current.map((item) =>
        item.type === type && item.level === level
          ? {
              ...item,
              count: safeValue,
            }
          : item
      )
    );

    clearCheckResult();
  };

  const handleMatrixScoreChange = (
    type: QuestionType,
    level: QuestionLevel,
    value: string
  ) => {
    if (importedRows.length) { setErrorMessage("Hãy bỏ file ma trận trước khi chỉnh điểm thủ công."); return; }
    const numberValue = Number(value);

    const safeValue =
      Number.isFinite(numberValue) && numberValue >= 0
        ? Math.min(numberValue, 10)
        : 0;

    setMatrix((current) =>
      current.map((item) =>
        item.type === type && item.level === level
          ? {
              ...item,
              scorePerQuestion: safeValue,
            }
          : item
      )
    );

    clearCheckResult();
  };

  const handleResetMatrix =
    () => {
      setImportedRows([]);
      setImportedName("");
      setMatrix(
        createInitialMatrix()
      );

      setBankCheckResult(null);
      setErrorMessage("");
      setWarningMessage("");
      setLockedQuestionIds([]);
      setSuccessMessage(
        "Đã đặt lại ma trận đề."
      );
    };

  const getRowTotal = (
    type: QuestionType
  ): number => {
    return matrix
      .filter(
        (item) =>
          item.type === type
      )
      .reduce(
        (total, item) =>
          total + item.count,
        0
      );
  };

  const getColumnTotal = (
    level: QuestionLevel
  ): number => {
    return matrix
      .filter(
        (item) =>
          item.level === level
      )
      .reduce(
        (total, item) =>
          total + item.count,
        0
      );
  };

  const handleCheckQuestionBank = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setBankCheckResult(null);

    if (importedRows.length && !mappingComplete) {
      setErrorMessage("Hãy gắn mọi nội dung trong file ma trận với bài học đã chọn.");
      return;
    }

    if (!examName.trim()) {
      setErrorMessage("Hãy nhập tên đề kiểm tra.");
      return;
    }

    if (!selectedSubject || !selectedGrade) {
      setErrorMessage(
        "Thông tin môn học hoặc khối lớp chưa đầy đủ."
      );
      return;
    }

    if (selectedLessonCodes.length === 0) {
      setErrorMessage("Hãy chọn ít nhất một bài học.");
      return;
    }

    if (totalQuestions === 0) {
      setErrorMessage("Ma trận chưa có câu hỏi.");
      return;
    }

    if (Math.abs(totalScore - 10) > 0.001) {
      setErrorMessage(
        `Tổng điểm hiện tại là ${totalScore.toFixed(
          2
        )}. Đề kiểm tra phải đủ 10,00 điểm.`
      );
      return;
    }

    setIsCheckingBank(true);

    try {
      const result = importedRows.length
        ? await checkExamSpecificationAvailability({
            subject: selectedSubject.name,
            grade: selectedGrade.grade,
            specification: mappedRows,
          }).then((check) => ({
            ...check,
            details: check.details.map((item) => ({
              type: item.type, level: item.level, required: item.count,
              available: item.available, missing: item.missing, isEnough: item.isEnough,
            })),
          }))
        : await checkExamMatrixAvailability({
        lessonCodes: selectedLessonCodes,
        subject: selectedSubject.name,
        grade: selectedGrade.grade,
        matrix: matrix.map((item) => ({
          type: item.type,
          level: item.level,
          count: item.count,
        })),
      });

      setBankCheckResult(result);

      if (result.isEnough) {
        setSuccessMessage(
          `Ngân hàng đủ câu hỏi để tạo đề ${totalQuestions} câu.`
        );
      } else {
        setErrorMessage(
          `Ngân hàng còn thiếu ${result.totalMissing} câu so với ma trận.`
        );
      }
    } catch (error) {
      console.error("Lỗi kiểm tra ngân hàng:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra ngân hàng câu hỏi."
      );
    } finally {
      setIsCheckingBank(false);
    }
  };

  const handleGenerateExam =
  async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (
      !bankCheckResult ||
      !bankCheckResult.isEnough
    ) {
      setErrorMessage(
        "Ngân hàng chưa đủ câu hỏi theo ma trận."
      );
      return;
    }

    if (importedRows.length && !mappingComplete) {
      setErrorMessage("Ma trận còn nội dung chưa được gắn bài học.");
      return;
    }
    if (importedRows.length && lockedQuestionIds.length) {
      setErrorMessage("Hãy mở khóa các câu trước khi tạo lại đề từ file ma trận.");
      return;
    }

    if (
      !selectedSubject ||
      !selectedGrade
    ) {
      setErrorMessage(
        "Thông tin môn học hoặc khối lớp chưa đầy đủ."
      );
      return;
    }

    if (
      selectedLessonCodes.length === 0
    ) {
      setErrorMessage(
        "Hãy chọn ít nhất một bài học."
      );
      return;
    }

    setIsGeneratingExam(true);

    try {
      const lockedQuestions =
        generatedExam.filter(
          (question) =>
            lockedQuestionIds.includes(
              question.id
            )
        );

      const questions = importedRows.length
          ? await generateExamQuestionsFromSpecification({
              subject: selectedSubject.name,
              grade: selectedGrade.grade,
              specification: mappedRows,
            })
          : lockedQuestions.length > 0
          ? await generateExamQuestionsKeepingLocked(
              {
                lessonCodes:
                  selectedLessonCodes,

                subject:
                  selectedSubject.name,

                grade:
                  selectedGrade.grade,

                matrix:
                  matrix.map(
                    (item) => ({
                      type:
                        item.type,

                      level:
                        item.level,

                      count:
                        item.count,
                    })
                  ),

                lockedQuestions,
              }
            )
          : await generateExamQuestions({
              lessonCodes:
                selectedLessonCodes,

              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              matrix:
                matrix.map(
                  (item) => ({
                    type:
                      item.type,

                    level:
                      item.level,

                    count:
                      item.count,
                  })
                ),
            });

      setGeneratedExam(
        questions
      );

      setSuccessMessage(
        lockedQuestionIds.length > 0
          ? `Đã tạo lại đề và giữ ${lockedQuestionIds.length} câu đã khóa.`
          : `Đã tạo đề gồm ${questions.length} câu hỏi.`
      );
    } catch (error) {
      console.error(
        "Lỗi tạo đề:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo đề kiểm tra."
      );
    } finally {
      setIsGeneratingExam(false);
    }
  };
  const handleDownloadExam = () => {
  if (generatedExam.length === 0) {
    setErrorMessage(
      "Chưa có đề kiểm tra để tải xuống."
    );
    return;
  }

  const escapeHtml = (
    value: string
  ) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const multipleChoice =
    generatedExam.filter(
      (question) =>
        question.type ===
        "multiple_choice"
    );

  const trueFalse =
    generatedExam.filter(
      (question) =>
        question.type ===
        "true_false"
    );

  const shortAnswer =
    generatedExam.filter(
      (question) =>
        question.type ===
        "short_answer"
    );

  const essay =
    generatedExam.filter(
      (question) =>
        question.type ===
        "essay"
    );

  const renderMultipleChoice =
    multipleChoice
      .map(
        (question, index) => {
          const options =
            question.options ?? [];

          return `
            <div class="question">
              <p>
                <b>Câu ${index + 1}.</b>
                ${escapeHtml(
                  question.question
                )}
              </p>

              <table class="options">
                <tr>
                  ${options
                    .slice(0, 2)
                    .map(
                      (
                        option,
                        optionIndex
                      ) => `
                        <td>
                          <b>${String.fromCharCode(
                            65 +
                              optionIndex
                          )}.</b>
                          ${escapeHtml(
                            option
                          )}
                        </td>
                      `
                    )
                    .join("")}
                </tr>

                <tr>
                  ${options
                    .slice(2, 4)
                    .map(
                      (
                        option,
                        optionIndex
                      ) => `
                        <td>
                          <b>${String.fromCharCode(
                            67 +
                              optionIndex
                          )}.</b>
                          ${escapeHtml(
                            option
                          )}
                        </td>
                      `
                    )
                    .join("")}
                </tr>
              </table>
            </div>
          `;
        }
      )
      .join("");

  const renderTrueFalse =
    trueFalse
      .map(
        (question, index) => `
          <div class="question">
            <p>
              <b>Câu ${index + 1}.</b>
              ${escapeHtml(
                question.question
              )}
            </p>

            <p>
              ☐ Đúng
              &nbsp;&nbsp;&nbsp;&nbsp;
              ☐ Sai
            </p>
          </div>
        `
      )
      .join("");

  const renderShortAnswer =
    shortAnswer
      .map(
        (question, index) => `
          <div class="question">
            <p>
              <b>Câu ${index + 1}.</b>
              ${escapeHtml(
                question.question
              )}
            </p>

            <p>
              Trả lời:
              ........................................................................
            </p>
          </div>
        `
      )
      .join("");

  const renderEssay =
    essay
      .map(
        (question, index) => `
          <div class="question essay">
            <p>
              <b>Câu ${index + 1}.</b>
              ${escapeHtml(
                question.question
              )}
            </p>
          </div>
        `
      )
      .join("");

  const examTitle =
    examType === "midterm"
      ? `ĐỀ KIỂM TRA GIỮA HỌC KỲ ${examSemester === "1" ? "I" : "II"}`
      : examType === "final"
      ? `ĐỀ KIỂM TRA CUỐI HỌC KỲ ${examSemester === "1" ? "I" : "II"}`
      : "ĐỀ KIỂM TRA THƯỜNG XUYÊN";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />

        <style>
  @page {
    size: 21cm 29.7cm;
    margin:
      1.5cm
      1.5cm
      1.5cm
      2cm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;

    font-family:
      "Times New Roman",
      Times,
      serif;

    font-size: 13pt;
    line-height: 1.3;

    color: #000;

    text-align: justify;
  }

  /* =========================
     ĐẦU ĐỀ
  ========================= */

  .header {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;

    margin-bottom: 20px;
  }

  .header td {
    width: 50%;
    vertical-align: top;
    text-align: center;

    padding: 0 8px;
  }

  .school {
    font-size: 13pt;
    font-weight: normal;
    text-transform: uppercase;
  }

  .school-name {
    margin-top: 3px;

    font-size: 13pt;
    font-weight: bold;
    text-transform: uppercase;
  }

  .exam-title {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
  }

  .subject {
    margin-top: 3px;

    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
  }

  .time {
    margin-top: 5px;

    font-size: 13pt;
    font-weight: bold;
    font-style: italic;
  }

  .note {
    margin-top: 2px;

    font-size: 13pt;
    font-style: italic;
  }

  /* =========================
     MÃ ĐỀ
  ========================= */

  .exam-code {
    display: inline-block;

    min-width: 115px;

    margin-top: 22px;
    padding: 5px 15px;

    border: 1px solid #000;

    font-size: 14pt;
    font-weight: bold;

    text-align: center;
  }

  /* =========================
     THÔNG TIN HỌC SINH
  ========================= */

  .student-info {
    width: 100%;

    margin-top: 25px;
    margin-bottom: 5px;

    font-size: 13pt;
  }

  .student-info td {
    padding: 5px 0;
  }

  .student-name {
    width: 55%;
  }

  .student-number {
    width: 45%;
  }

  .line {
    display: inline-block;

    border-bottom:
      1px dotted #000;

    min-width: 220px;
  }

  .divider {
    margin:
      5px
      0
      15px
      0;

    border: 0;
    border-top:
      1px solid #000;
  }

  /* =========================
     PHẦN
  ========================= */

  .section-title {
    margin-top: 15px;
    margin-bottom: 8px;

    font-size: 13pt;
    font-weight: bold;

    text-transform: uppercase;

    page-break-after: avoid;
  }

  .subsection-title {
    margin-top: 10px;
    margin-bottom: 4px;

    font-size: 13pt;
    font-weight: bold;

    page-break-after: avoid;
  }

  .instruction {
    margin-bottom: 7px;

    font-size: 13pt;
    font-style: italic;

    page-break-after: avoid;
  }

  /* =========================
     CÂU HỎI
  ========================= */

  .question {
    margin:
      0
      0
      8px
      0;

    font-size: 13pt;

    page-break-inside: avoid;
  }

  .question p {
    margin:
      3px
      0;

    text-align: justify;
  }

  .question-number {
    font-weight: bold;
  }

  /* =========================
     PHƯƠNG ÁN
  ========================= */

  .options {
    width: 100%;

    border-collapse: collapse;

    margin:
      3px
      0
      7px
      0;

    table-layout: fixed;
  }

  .options td {
    width: 50%;

    padding:
      2px
      8px
      2px
      0;

    vertical-align: top;

    font-size: 13pt;

    text-align: left;
  }

  /* =========================
     ĐÚNG / SAI
  ========================= */

  .true-false {
    margin-top: 4px;
    margin-left: 20px;
  }

  /* =========================
     TRẢ LỜI NGẮN
  ========================= */

  .short-answer-line {
    margin-top: 8px;

    border-bottom:
      1px dotted #000;

    height: 18px;
  }

  /* =========================
     TỰ LUẬN
  ========================= */

  .essay {
    margin-bottom: 12px;

    page-break-inside: avoid;
  }

  .essay-space {
    height: 40px;
  }

  /* =========================
     CUỐI ĐỀ
  ========================= */

  .end-exam {
    margin-top: 20px;

    text-align: center;

    font-weight: bold;
  }
</style>
      </head>

      <body>
        <table class="header">
          <tr>
            <td>
              <div class="school">
                UBND XÃ NHÂN CƠ
              </div>

              <div class="school-name">
                TRƯỜNG THCS NGUYỄN CÔNG TRỨ
              </div>

              <div class="exam-code">
                Mã đề: ${selectedExamCode}
              </div>
            </td>

            <td>
              <div class="exam-title">
                ${examTitle}
              </div>

              <div class="subject">
                MÔN:
                ${escapeHtml(
                  selectedSubject?.name ??
                    ""
                )}
                - LỚP
                ${
                  selectedGrade?.grade ??
                  ""
                }
              </div>

              <div class="time">
                Thời gian làm bài:
                ${duration} phút
              </div>

              <div>
                <i>
                  (Không kể thời gian phát đề)
                </i>
              </div>
            </td>
          </tr>
        </table>

        <table class="student-info">
  <tr>
    <td class="student-name">
      Họ và tên:
      <span class="line">
        &nbsp;
      </span>
    </td>

    <td class="student-number">
      Số báo danh:
      <span class="line">
        &nbsp;
      </span>
    </td>
  </tr>
</table>

<hr class="divider" />

        <hr />

        ${
          multipleChoice.length ||
          trueFalse.length ||
          shortAnswer.length
            ? `
              <div class="section-title">
                PHẦN I. TRẮC NGHIỆM
              </div>
            `
            : ""
        }

        ${
          multipleChoice.length
            ? `
              <div class="subsection-title">
                A. Trắc nghiệm nhiều lựa chọn
              </div>

              <div class="instruction">
                Chọn một đáp án đúng nhất cho mỗi câu hỏi.
              </div>

              ${renderMultipleChoice}
            `
            : ""
        }

        ${
          trueFalse.length
            ? `
              <div class="subsection-title">
                B. Trắc nghiệm Đúng / Sai
              </div>

              <div class="instruction">
                Xác định mỗi nhận định là đúng hay sai.
              </div>

              ${renderTrueFalse}
            `
            : ""
        }

        ${
          shortAnswer.length
            ? `
              <div class="subsection-title">
                C. Trắc nghiệm trả lời ngắn
              </div>

              ${renderShortAnswer}
            `
            : ""
        }

        ${
          essay.length
            ? `
              <div class="section-title">
                PHẦN II. TỰ LUẬN
              </div>

              ${renderEssay}
            `
            : ""
        }

        <p
          style="
            text-align:center;
            margin-top:30px;
            font-weight:bold;
          "
        >
          --- HẾT ---
        </p>
      </body>
    </html>
  `;

  const blob =
    new Blob(
      ["\ufeff", html],
      {
        type:
          "application/msword;charset=utf-8",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  const safeName =
    examName
      .trim()
      .replace(
        /[\\/:*?"<>|]/g,
        "-"
      )
      .replace(
        /\s+/g,
        "-"
      );

  link.href = url;

  link.download =
    `${safeName || "de-kiem-tra"}.doc`;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
};
    const handleToggleQuestionLock = (
    questionId: string
  ) => {
    setLockedQuestionIds(
      (current) =>
        current.includes(
          questionId
        )
          ? current.filter(
              (id) =>
                id !==
                questionId
            )
          : [
              ...current,
              questionId,
            ]
    );

    setSavedExamId(null);
    setWarningMessage("");
  };

  const handleReplaceQuestion =
    async (
      question:
        ExamBankQuestion
    ) => {setReplacementWarning(null);
      setErrorMessage("");
      setSuccessMessage("");
      setWarningMessage("");

      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        setErrorMessage(
          "Thông tin môn học hoặc khối lớp chưa đầy đủ."
        );
        return;
      }

      setReplacingQuestionId(
        question.id
      );

      try {
        const replacement =
  await getReplacementExamQuestion({
    lessonCode: question.lessonCode,
    subject: selectedSubject.name,
    grade: selectedGrade.grade,
    type: question.type,
    level: question.level,
    excludeQuestionIds:
      generatedExam.map(
        (item) => item.id
      ),
  });

if (!replacement) {
  setReplacementWarning({
  questionId: question.id,
  message:
    "Không còn câu khác phù hợp để thay cho câu này.",
});

return;
}

setGeneratedExam(
  (current) =>
    current.map(
      (item) =>
        item.id === question.id
          ? replacement
          : item
    )
);

        setGeneratedExam(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                question.id
                  ? replacement
                  : item
            )
        );

        setLockedQuestionIds(
          (current) =>
            current.filter(
              (id) =>
                id !==
                question.id
            )
        );

        setSavedExamId(null);

        setSuccessMessage(
          "Đã thay câu hỏi bằng một câu khác cùng bài, dạng câu và mức độ."
        );
      } catch (error) {
        console.error(
          "Lỗi thay câu hỏi:",
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : "Không thể thay câu hỏi.";

        if (
          message.includes(
            "Không còn câu hỏi thay thế phù hợp"
          )
        ) {
          setWarningMessage(
            "Không còn câu khác phù hợp để thay cho câu này."
          );
        } else {
          setErrorMessage(
            message
          );
        }
      } finally {
        setReplacingQuestionId(
          null
        );
      }
    };

  const getQuestionScore = (
    type: QuestionType,
    level: QuestionLevel
  ): number => {
    const cell = matrix.find(
      (item) => item.type === type && item.level === level
    );
    return cell?.scorePerQuestion ?? 0;
  };

  const buildExamExportData = (
    examCode: string =
      selectedExamCode
  ): ExamExportData => {
    if (!selectedSubject || !selectedGrade) {
      throw new Error("Thông tin môn học hoặc khối lớp chưa đầy đủ.");
    }
    if (generatedExam.length === 0) {
      throw new Error("Chưa có đề kiểm tra để xuất.");
    }
    return {
      examName,
      examType,
      subjectName: selectedSubject.name,
      grade: selectedGrade.grade,
      duration,
      totalScore,
      examCode,
      schoolAuthority: "UBND XÃ NHÂN CƠ",
      schoolName: "TRƯỜNG THCS NGUYỄN CÔNG TRỨ",
      questions:
        createExamVariant(
          generatedExam,
          examCode
        ).map((question) => ({
          questionId:
            question.id,

          lessonCode:
            question.lessonCode,

          type:
            question.type,

          level:
            question.level,

          question:
            question.question,

          options:
            question.options ?? [],

          correctAnswer:
            question.correctAnswer,

          explanation:
            question.explanation ?? "",

          score:
            getQuestionScore(
              question.type,
              question.level
            ),

          markingGuide: savedGuides[question.id] ?? [],
        })),
    };
  };

  const handleSaveExam = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (generatedExam.length === 0) {
      setErrorMessage("Hãy tạo đề trước khi lưu.");
      return;
    }
    if (!selectedSubject || !selectedGrade) {
      setErrorMessage("Thông tin môn học hoặc khối lớp chưa đầy đủ.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      setErrorMessage("Thời gian làm bài không hợp lệ.");
      return;
    }
    if (Math.abs(totalScore - 10) > 0.001) {
      setErrorMessage(`Tổng điểm hiện tại là ${totalScore.toFixed(2)}. Đề kiểm tra phải đủ 10,00 điểm.`);
      return;
    }
    setIsSavingExam(true);
    try {
      const result = await saveExam({
        examName: examName.trim(),
        examType,
        examSemester,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        gradeId: selectedGrade.id,
        grade: selectedGrade.grade,
        lessonCodes: selectedLessonCodes,
        duration,
        totalScore,
        specification: importedRows.filter(row=>row.count>0),
        specificationName: importedName,
        matrix: matrix.map((item) => ({
          type: item.type,
          level: item.level,
          count: item.count,
          scorePerQuestion: item.scorePerQuestion,
        })),
        questions: generatedExam.map((question, index) => ({
          questionId: question.id,
          lessonCode: question.lessonCode,
          type: question.type,
          level: question.level,
          question: question.question,
          options: question.options ?? [],
          correctAnswer: question.correctAnswer,
          explanation: question.explanation ?? "",
          score: getQuestionScore(question.type, question.level),
          markingGuide: savedGuides[question.id] ?? [],
          order: index + 1,
        })),
        examCodes,
        status: "draft",
      }, editingExamId);
      setSavedExamId(result.examId);
      setEditingExamId(result.examId);
      setSuccessMessage("Đã lưu đề kiểm tra thành công.");
    } catch (error) {
      console.error("Lỗi lưu đề:", error);
      setErrorMessage(error instanceof Error ? error.message : "Không thể lưu đề kiểm tra.");
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleDownloadExamDocx = async () => {
    try {
      setErrorMessage("");
      await downloadExamDocx(buildExamExportData(selectedExamCode));
    } catch (error) {
      console.error("Lỗi tải đề Word:", error);
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải đề Word.");
    }
  };

  const handleDownloadExamPdf = async () => {
    try {
      setErrorMessage("");
      await downloadExamPdf(buildExamExportData(selectedExamCode));
    } catch (error) {
      console.error("Lỗi tải đề PDF:", error);
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải đề PDF.");
    }
  };

  const handleDownloadAnswerDocx = async () => {
    try {
      setErrorMessage("");
      await downloadAnswerDocx(buildExamExportData(selectedExamCode));
    } catch (error) {
      console.error("Lỗi tải đáp án Word:", error);
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải đáp án Word.");
    }
  };

  const handleDownloadAnswerPdf = async () => {
    try {
      setErrorMessage("");
      await downloadAnswerPdf(buildExamExportData(selectedExamCode));
    } catch (error) {
      console.error("Lỗi tải đáp án PDF:", error);
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải đáp án PDF.");
    }
  };

 return (
  <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-6">

      {/* TIÊU ĐỀ TRANG */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            {isAdmin
              ? "Quản trị / Kiểm tra đánh giá"
              : "Giáo viên / Kiểm tra đánh giá"}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {isAdmin
              ? "Tạo đề kiểm tra chính thức"
              : "Tạo đề kiểm tra"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {isAdmin
              ? "Thiết lập đề kiểm tra chính thức, cấu hình ma trận, kiểm tra ngân hàng và sinh đề ngẫu nhiên."
              : "Chọn phạm vi kiến thức, cấu hình ma trận và kiểm tra ngân hàng trước khi sinh đề."}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
          <p className="text-xs font-bold uppercase text-blue-700">
            Tổng số câu
          </p>

          <p className="mt-1 text-2xl font-bold text-blue-900">
            {totalQuestions}
          </p>
        </div>
      </div>

      {userScopeError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {userScopeError}
        </div>
      )}
      {!isLoadingCurriculum && !isLoadingUserScope && !userScopeError &&
        curriculumTree.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {curriculums.length === 0
              ? "Chưa có Curriculum trong Firestore. Quản trị cần nhập SGK và lưu Curriculum trước khi tạo đề."
              : "Tài khoản chưa được phân công môn hoặc khối lớp phù hợp với Curriculum."}
          </div>
        )}

      {/* THÔNG BÁO LỖI */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {/* THÔNG BÁO THÀNH CÔNG */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} />

          {successMessage}
        </div>
      )}

      {/* CẢNH BÁO */}
      {warningMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {warningMessage}
        </div>
      )}

      {/* THÔNG TIN ĐỀ */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <FileText
            size={20}
            className="text-blue-700"
          />

          <h2 className="text-lg font-bold text-slate-900">
            Thông tin đề
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">

          {/* TÊN ĐỀ */}
          <label className="block xl:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
              Tên đề
            </span>

            <input
              value={examName}
              onChange={(event) => {
                setExamName(
                  event.target.value
                );

                clearCheckResult();
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </label>

          {/* MÔN HỌC */}
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              disabled={
                isLoadingCurriculum || isLoadingUserScope || Boolean(userScopeError) ||
                curriculumTree.length === 0
              }
            >
              {isLoadingCurriculum && (
                <option value="">
                  Đang tải Curriculum...
                </option>
              )}

              {!isLoadingCurriculum &&
                curriculumTree.length === 0 && (
                  <option value="">
                    Chưa có Curriculum
                  </option>
                )}

              {curriculumTree.map(
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

          {/* THỜI GIAN */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
              Thời gian làm bài
            </span>

            <div className="relative">
              <input
                type="number"
                min={1}
                max={300}
                value={duration}
                onChange={(event) => {
                  const value =
                    Number(
                      event.target.value
                    );

                  setDuration(
                    Number.isFinite(
                      value
                    )
                      ? Math.max(
                          1,
                          Math.min(
                            value,
                            300
                          )
                        )
                      : 1
                  );

                  clearCheckResult();
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-14 text-sm outline-none focus:border-blue-500"
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                phút
              </span>
            </div>
          </label>

           <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                  Khối lớp
                </span>

                <select
                  value={
                    selectedGrade?.id ?? ""
                  }
                  onChange={(event) =>
                    handleGradeChange(
                      event.target.value
                    )
                  }
                  disabled={
                    !selectedSubject ||
                    isLoadingCurriculum || isLoadingUserScope || Boolean(userScopeError)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                >
                  {selectedSubject?.grades.map(
                    (grade) => (
                      <option
                        key={grade.id}
                        value={grade.id}
                      >
                        Lớp {grade.grade}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                  Đợt kiểm tra
                </span>

                <select
                  value={`${examType}_${examSemester}`}
                  onChange={(event) => {
                    const [nextType, nextSemester] = event.target.value.split("_") as [ExamType, "1" | "2"];
                    setExamType(nextType);
                    setExamSemester(nextSemester);
                    const currentDefault = `Kiểm tra ${examType === "midterm" ? "giữa" : "cuối"} học kỳ ${examSemester === "1" ? "I" : "II"}`;
                    if (!examName.trim() || examName === currentDefault) {
                      setExamName(`Kiểm tra ${nextType === "midterm" ? "giữa" : "cuối"} học kỳ ${nextSemester === "1" ? "I" : "II"}`);
                    }
                    clearCheckResult();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="midterm_1">Giữa học kỳ I</option>
                  <option value="final_1">Cuối học kỳ I</option>
                  <option value="midterm_2">Giữa học kỳ II</option>
                  <option value="final_2">Cuối học kỳ II</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
                  Số mã đề
                </span>

                <select
                  value={
                    numberOfExamCodes
                  }
                  onChange={(event) => {
                    const value =
                      Number(
                        event.target.value
                      );

                    setRestoredExamCodes(null);
                    setNumberOfExamCodes(
                      value
                    );

                    setSelectedExamCode(
                      "101"
                    );

                    setSavedExamId(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value={1}>
                    1 mã đề
                  </option>

                  <option value={2}>
                    2 mã đề
                  </option>

                  <option value={3}>
                    3 mã đề
                  </option>

                  <option value={4}>
                    4 mã đề
                  </option>
                </select>

                <p className="mt-1 text-xs text-slate-500">
                  {examCodes.join(
                    ", "
                  )}
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen
                  size={20}
                  className="text-blue-700"
                />

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Phạm vi kiến thức
                  </h2>

                  <p className="text-sm text-slate-500">
                    Chọn chương, sau đó chọn các bài đưa vào đề kiểm tra.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Đã chọn {totalLessons} bài
              </div>
            </div>

            <div className="mt-6">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
                  Chương
                </span>

                <select
                  value={
                    selectedChapter?.id ?? ""
                  }
                  onChange={(event) =>
                    handleChapterChange(
                      event.target.value
                    )
                  }
                  disabled={
                    availableChapters.length === 0
                  }
                  className="w-full max-w-2xl rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 disabled:bg-slate-100"
                >
                  {availableChapters.length === 0 && (
                    <option value="">
                      Chưa có chương / chủ đề
                    </option>
                  )}

                  {availableChapters.map(
                    (chapter) => (
                      <option
                        key={chapter.id}
                        value={chapter.id}
                      >
                        Chương {chapter.chapterNo}: {chapter.title}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Bài học trong Chương {selectedChapter?.chapterNo}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedChapter?.title}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllLessonsInChapter}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Chọn cả chương
                  </button>

                  <button
                    type="button"
                    onClick={handleClearLessonsInChapter}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Bỏ chọn chương
                  </button>
                </div>
              </div>

              {availableLessons.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                  Chương này chưa có bài học.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {availableLessons.map((lesson) => {
                    const checked =
                      selectedLessonCodes.includes(
                        lesson.code
                      );

                    return (
                      <label
                        key={lesson.code}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                          checked
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            handleToggleLesson(
                              lesson.code
                            )
                          }
                          className="mt-1 h-4 w-4"
                        />

                        <div>
                          <p className="text-xs font-bold text-blue-700">
                            {lesson.code}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            Bài {lesson.lessonNo}. {lesson.title}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList
                  size={20}
                  className="text-blue-700"
                />

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Ma trận đề
                  </h2>

                  <p className="text-sm text-slate-500">
                    Số lượng câu theo dạng và mức độ nhận thức.
                  </p>
                </div>
              </div>

              <label className="cursor-pointer rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700">
                {importing ? "Đang đọc file..." : "Tải ma trận Excel"}
                <input type="file" accept=".xlsx,.xls,.csv,.json,.docx" className="hidden"
                  disabled={importing} onChange={(event) => {
                    void handleImportMatrix(event.target.files?.[0]);
                    event.target.value = "";
                  }} />
              </label>

              <button
                type="button"
                onClick={handleResetMatrix}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Đặt lại
              </button>
            </div>

            {importedRows.length > 0 && (
              <div className="space-y-3 border-b border-slate-200 p-6">
                <p className="font-semibold text-slate-900">File: {importedName} · {totalQuestions} câu</p>
                {importWarnings.map((warning, index) => (
                  <p key={index} className="text-sm text-amber-700">{warning}</p>
                ))}
                <p className="text-sm text-slate-600">
                  Gắn từng nội dung với bài học thuộc môn và khối đã chọn; giáo viên kiểm tra số câu, mức độ và điểm trước khi tạo đề.
                </p>
                {Array.from(
  new Set(
    importedRows.map(
      (row) =>
        row.lessonTitle ||
        row.requirement ||
        "Nội dung chưa đặt tên"
    )
  )
).map((title) => {
                  const rows = importedRows.filter((row) => (row.lessonTitle || row.requirement || "Nội dung chưa đặt tên") === title);
                  return (
                    <div key={title} className="rounded-lg border border-slate-200 p-3">
                      <label className="block text-sm font-semibold text-slate-800">{title}</label>
                      <p className="my-1 text-xs text-slate-600">
                        {rows.map((row) => `${questionTypeRows.find((item) => item.value === row.type)?.label} / ${questionLevels.find((item) => item.value === row.level)?.label}: ${row.count}`).join("; ")}
                      </p>
                      <select className="w-full rounded border border-slate-300 p-2 text-sm"
                        value={rows[0]?.lessonCode || ""}
                        onChange={(event) => {
                          const code = event.target.value;
                          setImportedRows((current) => current.map((row) =>
                            (row.lessonTitle || row.requirement || "Nội dung chưa đặt tên") === title
                              ? { ...row, lessonCode: code } : row
                          ));
                          if (code) {
                            setSelectedLessonCodes((current) =>
                              Array.from(new Set([...current, code]))
                            );
                          }
                          clearCheckResult();
                        }}>
                        <option value="">Chọn bài học tương ứng</option>
                        {allLessons.map((lesson) => (
                          <option key={lesson.code} value={lesson.code}>{lesson.chapter} · {lesson.code} · {lesson.title}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="overflow-x-auto p-6">
              <table className="w-full min-w-[850px] border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700">
                      Dạng câu hỏi
                    </th>

                    {questionLevels.map((level) => (
                      <th
                        key={level.value}
                        className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700"
                      >
                        {level.label}
                      </th>
                    ))}

                    <th className="border border-slate-200 bg-blue-50 px-4 py-3 text-center text-sm font-bold text-blue-900">
                      Tổng
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {questionTypeRows.map((type) => (
                    <tr key={type.value}>
                      <td className="border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
                        {type.label}
                      </td>

                      {questionLevels.map((level) => {
                        const cell = matrix.find(
                          (item) =>
                            item.type === type.value &&
                            item.level === level.value
                        );
                        
                        return (
                          <td
                            key={level.value}
                            className="border border-slate-200 px-3 py-3 text-center"
                          >
                            <div className="flex flex-col items-center gap-2">
                        {/* SỐ CÂU */}
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                            Số câu
                          </p>

                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={
                              cell?.count ?? 0
                            }
                            onChange={(event) =>
                              handleMatrixChange(
                                type.value,
                                level.value,
                                event.target.value
                              )
                            }
                            className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm font-semibold outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* ĐIỂM / CÂU */}
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                            Điểm/câu
                          </p>

              <input
                type="number"
                min={0}
                max={10}
                step={0.25}
                value={
                  cell?.scorePerQuestion ??
                  0
                }
                onChange={(event) =>
                    handleMatrixScoreChange(
                    type.value,
                    level.value,
                    event.target.value
                  )
              }
                    className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm font-semibold outline-none focus:border-blue-500"
                     />
                </div>
              </div>
                          </td>
                        );
                      })}

                      <td className="border border-slate-200 bg-blue-50 px-4 py-3 text-center text-lg font-bold text-blue-800">
                        {getRowTotal(type.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                      Tổng
                    </td>

                    {questionLevels.map((level) => (
                      <td
                        key={level.value}
                        className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-base font-bold text-slate-800"
                      >
                        {getColumnTotal(level.value)}
                      </td>
                    ))}

                    <td className="border border-slate-200 bg-blue-100 px-4 py-3 text-center text-xl font-bold text-blue-900">
                      {totalQuestions}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {bankCheckResult && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Kết quả kiểm tra ngân hàng
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  So sánh số câu hiện có với yêu cầu của ma trận.
                </p>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Yêu cầu
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {bankCheckResult.totalRequired}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Đáp ứng
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {bankCheckResult.totalAvailable}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Còn thiếu
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {bankCheckResult.totalMissing}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700">
                        Dạng câu
                      </th>
                      <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700">
                        Mức độ
                      </th>
                      <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700">
                        Yêu cầu
                      </th>
                      <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700">
                        Hiện có
                      </th>
                      <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {bankCheckResult.details.map((item) => (
                      <tr key={`${item.type}-${item.level}`}>
                        <td className="border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
                          {questionTypeRows.find(
                            (type) => type.value === item.type
                          )?.label ?? item.type}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-sm text-slate-700">
                          {questionLevels.find(
                            (level) => level.value === item.level
                          )?.label ?? item.level}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center font-bold">
                          {item.required}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center font-bold">
                          {item.available}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          {item.isEnough ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                              Đủ
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                              Thiếu {item.missing}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
            {/* ĐỀ ĐÃ TẠO */}
{generatedExam.length > 0 && (
  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-blue-700">
          Đề vừa tạo
        </p>

        <h2 className="mt-1 text-xl font-bold text-slate-900">
          {examName}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {selectedSubject?.name} •
          Lớp {selectedGrade?.grade} •{" "}
          {generatedExam.length} câu
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-slate-500">
            Xem mã đề
          </span>

          <select
            value={
              selectedExamCode
            }
            onChange={(event) =>
              setSelectedExamCode(
                event.target.value
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-blue-700 outline-none focus:border-blue-500"
          >
            {examCodes.map(
              (code) => (
                <option
                  key={code}
                  value={code}
                >
                  Mã {code}
                </option>
              )
            )}
          </select>

          {numberOfExamCodes >
            1 && (
            <span className="text-xs text-slate-500">
              Mỗi mã được đảo thứ tự câu và phương án lựa chọn.
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={
          handleGenerateExam
        }
        disabled={
          isGeneratingExam
        }
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RefreshCw
          size={16}
        />

        Tạo lại đề
      </button>
        <button
  type="button"
  onClick={handleSaveExam}
  disabled={
    isSavingExam ||
    generatedExam.length === 0
  }
  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
>
  {isSavingExam
    ? "Đang lưu..."
    : editingExamId
    ? "Lưu thay đổi"
    : "Lưu đề"}
</button>
  <div className="flex flex-wrap gap-2">
  <button
    type="button"
    onClick={
      handleDownloadExamDocx
    }
    className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
  >
    <Download size={17} />

    Tải đề Word
  </button>

  <button
    type="button"
    onClick={
      handleDownloadExamPdf
    }
    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
  >
    <Download size={17} />

    Tải đề PDF
  </button>

  <button
    type="button"
    onClick={
      handleDownloadAnswerDocx
    }
    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
  >
    <Download size={17} />

    Đáp án & HDC Word
  </button>

  <button
    type="button"
    onClick={
      handleDownloadAnswerPdf
    }
    className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
  >
    <Download size={17} />

    Đáp án & HDC PDF
  </button>
  </div>
    </div>
        {/* ĐẦU ĐỀ */}
  <div className="mb-8 border-b-2 border-slate-900 pb-5">
  <div className="grid grid-cols-2 gap-8">
    {/* BÊN TRÁI */}
    <div className="text-center">
      <p className="text-lg font-medium text-slate-900">
        UBND XÃ NHÂN CƠ
      </p>

      <p className="mt-1 text-xl font-bold uppercase text-slate-900">
        TRƯỜNG THCS NGUYỄN CÔNG TRỨ
      </p>

      <div className="mt-8 inline-block border-2 border-slate-900 px-6 py-2">
        <p className="text-xl font-bold">
          Mã đề: {selectedExamCode}
        </p>
      </div>
    </div>

    {/* BÊN PHẢI */}
    <div className="text-center">
      <p className="text-xl font-bold uppercase text-slate-900">
        {examType === "midterm"
          ? `ĐỀ KIỂM TRA GIỮA HỌC KỲ ${examSemester === "1" ? "I" : "II"}`
          : examType === "final"
          ? `ĐỀ KIỂM TRA CUỐI HỌC KỲ ${examSemester === "1" ? "I" : "II"}`
          : "ĐỀ KIỂM TRA THƯỜNG XUYÊN"}
      </p>

      <p className="mt-1 text-xl font-bold uppercase text-slate-900">
        MÔN: {selectedSubject?.name} - LỚP{" "}
        {selectedGrade?.grade}
      </p>

      <p className="mt-2 text-lg font-bold italic">
        Thời gian làm bài: {duration} phút
      </p>

      <p className="text-base italic text-slate-700">
        (Không kể thời gian phát đề)
      </p>
    </div>
  </div>

  {/* THÔNG TIN HỌC SINH */}
  <div className="mt-10 flex gap-8 text-lg">
    <div className="flex-1">
      Họ và tên:
      <span className="ml-2 inline-block w-[70%] border-b border-dotted border-slate-900">
        &nbsp;
      </span>
    </div>

    <div className="flex-1">
      Số báo danh:
      <span className="ml-2 inline-block w-[60%] border-b border-dotted border-slate-900">
        &nbsp;
      </span>
    </div>
  </div>
</div>
   {/* =====================================================
    PHẦN I - TRẮC NGHIỆM
===================================================== */}

{previewExam.some(
  (question) =>
    question.type !== "essay"
) && (
  <div className="mt-8">
    <h2 className="text-lg font-bold uppercase text-slate-900">
      PHẦN I. TRẮC NGHIỆM
    </h2>

    {/* A. NHIỀU LỰA CHỌN */}
    {previewExam.some(
      (question) =>
        question.type ===
        "multiple_choice"
    ) && (
      <div className="mt-5">
        <h3 className="font-bold text-slate-900">
          A. Trắc nghiệm nhiều lựa chọn
        </h3>

        <p className="mt-1 text-sm italic text-slate-600">
          Chọn một đáp án đúng nhất
          cho mỗi câu hỏi.
        </p>

        <div className="mt-4 space-y-5">
          {previewExam
            .filter(
              (question) =>
                question.type ===
                "multiple_choice"
            )
            .map(
              (
                question,
                index
              ) => (
                <div
                  key={
                    question.id
                  }
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="font-semibold leading-7 text-slate-900">
                    Câu {index + 1}.{" "}
                    {
                      question.question
                    }
                  </p>

                  {question.options &&
                    question.options
                      .length >
                      0 && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {question.options.map(
                          (
                            option,
                            optionIndex
                          ) => (
                            <div
                              key={`${question.id}-${optionIndex}`}
                              className="text-sm leading-6 text-slate-800"
                            >
                              <span className="font-semibold">
                                {String.fromCharCode(
                                  65 +
                                    optionIndex
                                )}
                                .
                              </span>{" "}
                              {option}
                            </div>
                          )
                        )}
                      </div>
                    )}

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleQuestionLock(
                          question.id
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                        lockedQuestionIds.includes(
                          question.id
                        )
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lockedQuestionIds.includes(
                        question.id
                      )
                        ? "Đã khóa"
                        : "Khóa câu"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleReplaceQuestion(
                          question
                        )
                      }
                      disabled={
                        replacingQuestionId ===
                        question.id
                      }
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          replacingQuestionId ===
                          question.id
                            ? "animate-spin"
                            : ""
                        }
                      />

                      {replacingQuestionId ===
                      question.id
                        ? "Đang thay..."
                        : "Thay câu khác"}
                    </button>
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    )}

    {/* B. ĐÚNG / SAI */}
    {previewExam.some(
      (question) =>
        question.type ===
        "true_false"
    ) && (
      <div className="mt-8">
        <h3 className="font-bold text-slate-900">
          B. Trắc nghiệm Đúng / Sai
        </h3>

        <p className="mt-1 text-sm italic text-slate-600">
          Xác định mỗi nhận định
          là đúng hay sai.
        </p>

        <div className="mt-4 space-y-5">
          {previewExam
            .filter(
              (question) =>
                question.type ===
                "true_false"
            )
            .map(
              (
                question,
                index
              ) => (
                <div
                  key={
                    question.id
                  }
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="font-semibold leading-7 text-slate-900">
                    Câu {index + 1}.{" "}
                    {
                      question.question
                    }
                  </p>

                  <div className="mt-3 flex gap-8 text-sm">
                    <span>
                      ☐ Đúng
                    </span>

                    <span>
                      ☐ Sai
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleQuestionLock(
                          question.id
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                        lockedQuestionIds.includes(
                          question.id
                        )
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lockedQuestionIds.includes(
                        question.id
                      )
                        ? "Đã khóa"
                        : "Khóa câu"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleReplaceQuestion(
                          question
                        )
                      }
                      disabled={
                        replacingQuestionId ===
                        question.id
                      }
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          replacingQuestionId ===
                          question.id
                            ? "animate-spin"
                            : ""
                        }
                      />

                      {replacingQuestionId ===
                      question.id
                        ? "Đang thay..."
                        : "Thay câu khác"}
                    </button>
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    )}

    {/* C. TRẢ LỜI NGẮN */}
    {previewExam.some(
      (question) =>
        question.type ===
        "short_answer"
    ) && (
      <div className="mt-8">
        <h3 className="font-bold text-slate-900">
          C. Trắc nghiệm trả lời ngắn
        </h3>

        <div className="mt-4 space-y-5">
          {previewExam
            .filter(
              (question) =>
                question.type ===
                "short_answer"
            )
            .map(
              (
                question,
                index
              ) => (
                <div
                  key={
                    question.id
                  }
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="font-semibold leading-7 text-slate-900">
                    Câu {index + 1}.{" "}
                    {
                      question.question
                    }
                  </p>

                  <div className="mt-4 border-b border-dotted border-slate-500" />

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleQuestionLock(
                          question.id
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                        lockedQuestionIds.includes(
                          question.id
                        )
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lockedQuestionIds.includes(
                        question.id
                      )
                        ? "Đã khóa"
                        : "Khóa câu"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleReplaceQuestion(
                          question
                        )
                      }
                      disabled={
                        replacingQuestionId ===
                        question.id
                      }
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          replacingQuestionId ===
                          question.id
                            ? "animate-spin"
                            : ""
                        }
                      />

                      {replacingQuestionId ===
                      question.id
                        ? "Đang thay..."
                        : "Thay câu khác"}
                    </button>
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    )}
  </div>
)}

{/* =====================================================
    PHẦN II - TỰ LUẬN
===================================================== */}

{previewExam.some(
  (question) =>
    question.type === "essay"
) && (
  <div className="mt-10">
    <h2 className="border-t-2 border-slate-900 pt-5 text-lg font-bold uppercase text-slate-900">
      PHẦN II. TỰ LUẬN
    </h2>

    <div className="mt-5 space-y-6">
      {previewExam
        .filter(
          (question) =>
            question.type ===
            "essay"
        )
        .map(
          (
            question,
            index
          ) => (
            <div
              key={
                question.id
              }
              className="rounded-lg border border-slate-200 p-4"
            >
              <p className="font-semibold leading-7 text-slate-900">
                Câu {index + 1}.{" "}
                {
                  question.question
                }
              </p>

              <div className="mt-8 space-y-5">
                <div className="border-b border-dotted border-slate-400" />
                <div className="border-b border-dotted border-slate-400" />
                <div className="border-b border-dotted border-slate-400" />
              </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleQuestionLock(
                          question.id
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                        lockedQuestionIds.includes(
                          question.id
                        )
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lockedQuestionIds.includes(
                        question.id
                      )
                        ? "Đã khóa"
                        : "Khóa câu"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleReplaceQuestion(
                          question
                        )
                      }
                      disabled={
                        replacingQuestionId ===
                        question.id
                      }
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          replacingQuestionId ===
                          question.id
                            ? "animate-spin"
                            : ""
                        }
                      />

                      {replacingQuestionId ===
                      question.id
                        ? "Đang thay..."
                        : "Thay câu khác"}
                    </button>
                  </div>
            </div>
          )
        )}
    </div>
  </div>
)}
  </section>
)}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">
                Số bài chọn
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {selectedLessonCodes.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">
                Tổng câu
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {totalQuestions}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">
                Tổng điểm
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {totalScore.toFixed(2)}
              </p>
            </div>
          </section>

          {/* ACTION */}
<div className="flex flex-wrap justify-end gap-3">
  <button
    type="button"
    onClick={
      handleCheckQuestionBank
    }
    disabled={
      isCheckingBank ||
      isGeneratingExam
    }
    className="flex items-center gap-2 rounded-xl border border-blue-700 bg-white px-6 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {isCheckingBank ? (
      <RefreshCw
        size={18}
        className="animate-spin"
      />
    ) : (
      <Search size={18} />
    )}

    {isCheckingBank
      ? "Đang kiểm tra..."
      : "Kiểm tra ngân hàng"}
  </button>

  {bankCheckResult?.isEnough && (
    <button
      type="button"
      onClick={
        handleGenerateExam
      }
      disabled={
        isGeneratingExam
      }
      className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isGeneratingExam ? (
        <RefreshCw
          size={18}
          className="animate-spin"
        />
      ) : (
        <FileText
          size={18}
        />
      )}

      {isGeneratingExam
        ? "Đang tạo đề..."
        : "Tạo đề kiểm tra"}
    </button>
     )}
    </div>
        </div>
      </main>
    
  );
}

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  GraduationCap,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  getAllCurriculums,
  type CurriculumDocument,
} from "@/services/curriculumService";

/* =====================================================
   PROPS
===================================================== */

interface Props {
  onSelectLesson: (
    lessonCode: string
  ) => void;

  selectedLessonCode?: string;
}

/* =====================================================
   GROUP TYPE
===================================================== */

interface SubjectGroup {
  subjectCode: string;

  subjectName: string;

  curriculums:
    CurriculumDocument[];
}

/* =====================================================
   COMPONENT
===================================================== */

export default function KnowledgeTree({
  onSelectLesson,
  selectedLessonCode,
}: Props) {
  const [
    curriculums,
    setCurriculums,
  ] = useState<
    CurriculumDocument[]
  >([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    openSubjects,
    setOpenSubjects,
  ] = useState<string[]>([]);

  const [
    openGrades,
    setOpenGrades,
  ] = useState<string[]>([]);

  const [
    openChapters,
    setOpenChapters,
  ] = useState<string[]>([]);

  /* =====================================================
     LOAD FIRESTORE
  ===================================================== */

  const loadCurriculums =
    async () => {
      setIsLoading(true);

      setErrorMessage("");

      try {
        const data =
          await getAllCurriculums();

        /*
         * Sắp xếp:
         * môn → lớp → chương
         */
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
         * Mở sẵn curriculum đầu tiên
         * để người dùng nhìn thấy dữ liệu ngay.
         */
        const first =
          sorted[0];

        if (first) {
          setOpenSubjects([
            first.subjectCode,
          ]);

          setOpenGrades([
            `${first.subjectCode}-${first.grade}`,
          ]);

          const firstChapter =
            first.chapters?.[0];

          if (
            firstChapter
          ) {
            setOpenChapters([
              `${first.subjectCode}-${first.grade}-${firstChapter.id}`,
            ]);
          }
        }
      } catch (
        error
      ) {
        console.error(
          "Lỗi tải Curriculum:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không tải được Curriculum từ Firestore."
        );
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    loadCurriculums();
  }, []);

  /* =====================================================
     GROUP SUBJECT
  ===================================================== */

  const subjectGroups =
    useMemo<
      SubjectGroup[]
    >(() => {
      const map =
        new Map<
          string,
          SubjectGroup
        >();

      curriculums.forEach(
        (curriculum) => {
          const key =
            curriculum.subjectCode;

          const existing =
            map.get(key);

          if (existing) {
            existing.curriculums.push(
              curriculum
            );

            return;
          }

          map.set(key, {
            subjectCode:
              curriculum.subjectCode,

            subjectName:
              curriculum.subjectName,

            curriculums: [
              curriculum,
            ],
          });
        }
      );

      return Array.from(
        map.values()
      );
    }, [curriculums]);

  /* =====================================================
     TOGGLE
  ===================================================== */

  const toggleItem = (
    id: string,

    currentItems:
      string[],

    setItems:
      React.Dispatch<
        React.SetStateAction<
          string[]
        >
      >
  ) => {
    setItems(
      (previousItems) =>
        previousItems.includes(
          id
        )
          ? previousItems.filter(
              (item) =>
                item !== id
            )
          : [
              ...previousItems,
              id,
            ]
    );
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6">
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm font-semibold text-slate-600">
            Đang tải chương trình từ Firestore...
          </p>
        </div>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (errorMessage) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="font-bold text-red-700">
                Không tải được chương trình
              </p>

              <p className="mt-1 text-sm text-red-600">
                {errorMessage}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              loadCurriculums
            }
            className="mt-3 flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            <RefreshCw
              size={14}
            />

            Tải lại
          </button>
        </div>
      </div>
    );
  }

  /* =====================================================
     EMPTY
  ===================================================== */

  if (
    curriculums.length ===
    0
  ) {
    return (
      <div className="p-4">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
          <BookOpen
            size={20}
          />

          Chương trình học
        </h2>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-700">
            Chưa có Curriculum
          </p>

          <p className="mt-1 text-sm text-amber-700">
            Hãy vào chức năng Nhập SGK & xây Curriculum để tạo chương trình trước.
          </p>
        </div>
      </div>
    );
  }

  /* =====================================================
     RENDER TREE
  ===================================================== */

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <BookOpen
            size={20}
          />

          Chương trình học
        </h2>

        <button
          type="button"
          onClick={
            loadCurriculums
          }
          title="Tải lại từ Firestore"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
        >
          <RefreshCw
            size={17}
          />
        </button>
      </div>

      {/* TREE */}
      <div className="space-y-2">
        {subjectGroups.map(
          (subject) => {
            const subjectKey =
              subject.subjectCode;

            const isSubjectOpen =
              openSubjects.includes(
                subjectKey
              );

            return (
              <div
                key={
                  subjectKey
                }
              >
                {/* SUBJECT */}
                <button
                  type="button"
                  onClick={() =>
                    toggleItem(
                      subjectKey,
                      openSubjects,
                      setOpenSubjects
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold text-blue-700 hover:bg-blue-50"
                >
                  {isSubjectOpen ? (
                    <ChevronDown
                      size={18}
                    />
                  ) : (
                    <ChevronRight
                      size={18}
                    />
                  )}

                  <BookOpen
                    size={18}
                  />

                  <span>
                    {
                      subject.subjectName
                    }
                  </span>
                </button>

                {/* GRADES */}
                {isSubjectOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {subject.curriculums.map(
                      (
                        curriculum
                      ) => {
                        const gradeKey =
                          `${curriculum.subjectCode}-${curriculum.grade}`;

                        const isGradeOpen =
                          openGrades.includes(
                            gradeKey
                          );

                        return (
                          <div
                            key={
                              curriculum.id ??
                              gradeKey
                            }
                          >
                            {/* GRADE */}
                            <button
                              type="button"
                              onClick={() =>
                                toggleItem(
                                  gradeKey,
                                  openGrades,
                                  setOpenGrades
                                )
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {isGradeOpen ? (
                                <ChevronDown
                                  size={17}
                                />
                              ) : (
                                <ChevronRight
                                  size={17}
                                />
                              )}

                              <GraduationCap
                                size={17}
                              />

                              <span>
                                Lớp{" "}
                                {
                                  curriculum.grade
                                }
                              </span>
                            </button>

                            {/* CHAPTERS */}
                            {isGradeOpen && (
                              <div className="ml-4 mt-1 space-y-1">
                                {curriculum.chapters.map(
                                  (
                                    chapter
                                  ) => {
                                    const chapterKey =
                                      `${curriculum.subjectCode}-${curriculum.grade}-${chapter.id}`;

                                    const isChapterOpen =
                                      openChapters.includes(
                                        chapterKey
                                      );

                                    return (
                                      <div
                                        key={
                                          chapterKey
                                        }
                                      >
                                        {/* CHAPTER */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleItem(
                                              chapterKey,
                                              openChapters,
                                              setOpenChapters
                                            )
                                          }
                                          className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                          {isChapterOpen ? (
                                            <ChevronDown
                                              size={16}
                                              className="mt-0.5 shrink-0"
                                            />
                                          ) : (
                                            <ChevronRight
                                              size={16}
                                              className="mt-0.5 shrink-0"
                                            />
                                          )}

                                          <Folder
                                            size={16}
                                            className="mt-0.5 shrink-0"
                                          />

                                          <span>
                                            Chương{" "}
                                            {
                                              chapter.chapterNo
                                            }
                                            :{" "}
                                            {
                                              chapter.title
                                            }
                                          </span>
                                        </button>

                                        {/* LESSONS */}
                                        {isChapterOpen && (
                                          <div className="ml-6 mt-1 space-y-1">
                                            {chapter.lessons.map(
                                              (
                                                lesson
                                              ) => {
                                                /*
                                                 * Firestore Curriculum dùng:
                                                 * lesson.lessonCode
                                                 *
                                                 * Không còn lesson.code như curriculumData.ts cũ.
                                                 */
                                                const isSelected =
                                                  selectedLessonCode ===
                                                  lesson.lessonCode;

                                                return (
                                                  <button
                                                    key={
                                                      lesson.id
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                      onSelectLesson(
                                                        lesson.lessonCode
                                                      )
                                                    }
                                                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                                      isSelected
                                                        ? "bg-blue-600 font-semibold text-white"
                                                        : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                                    }`}
                                                  >
                                                    <FileText
                                                      size={16}
                                                      className="mt-0.5 shrink-0"
                                                    />

                                                    <div className="min-w-0">
                                                      <p>
                                                        Bài{" "}
                                                        {
                                                          lesson.lessonNo
                                                        }
                                                        .{" "}
                                                        {
                                                          lesson.title
                                                        }
                                                      </p>

                                                      <p
                                                        className={`mt-0.5 text-[11px] ${
                                                          isSelected
                                                            ? "text-blue-100"
                                                            : "text-slate-400"
                                                        }`}
                                                      >
                                                        {
                                                          lesson.lessonCode
                                                        }
                                                      </p>
                                                    </div>
                                                  </button>
                                                );
                                              }
                                            )}

                                            {chapter
                                              .lessons
                                              .length ===
                                              0 && (
                                              <p className="px-3 py-2 text-xs italic text-slate-400">
                                                Chương này chưa có bài học.
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                )}

                                {curriculum
                                  .chapters
                                  .length ===
                                  0 && (
                                  <p className="px-3 py-2 text-xs italic text-slate-400">
                                    Chưa có chương.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
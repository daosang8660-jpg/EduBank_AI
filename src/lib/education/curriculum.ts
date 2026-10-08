/* =====================================================
   TYPES
===================================================== */

export interface CurriculumLesson {
  id: string;
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

export interface CurriculumChapter {
  id: string;

  chapterNo: number;

  title: string;

  lessons: CurriculumLesson[];
}

export interface CurriculumDocument {
  id?: string;

  subjectId: string;
  subjectCode: string;
  subjectName: string;

  grade: number;

  curriculumVersion: string;

  sourceBookId?: string;

  chapters: CurriculumChapter[];

  status:
    | "draft"
    | "reviewed"
    | "published";

  createdAt?: unknown;
  updatedAt?: unknown;
}

/* =====================================================
   FIRESTORE COLLECTION
===================================================== */

const CURRICULUM_COLLECTION =
  "curriculums";

/* =====================================================
   NORMALIZE
===================================================== */

function normalizeText(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLesson(
  lesson:
    Partial<CurriculumLesson>,
  chapterNo: number,
  index: number
): CurriculumLesson {
  const result:
    CurriculumLesson = {
    id:
      normalizeText(
        lesson.id
      ) ||
      `lesson-${chapterNo}-${index + 1}`,

    lessonCode:
      normalizeText(
        lesson.lessonCode
      ),

    lessonNo:
      Number(
        lesson.lessonNo
      ) ||
      index + 1,

    title:
      normalizeText(
        lesson.title
      ),

    status:
      lesson.status ??
      "empty",
  };

  const startPage =
    Number(
      lesson.startPage
    );

  if (
    Number.isFinite(
      startPage
    ) &&
    startPage > 0
  ) {
    result.startPage =
      startPage;
  }

  const endPage =
    Number(
      lesson.endPage
    );

  if (
    Number.isFinite(
      endPage
    ) &&
    endPage > 0
  ) {
    result.endPage =
      endPage;
  }

  return result;
}
function normalizeChapter(
  chapter:
    Partial<CurriculumChapter>,
  index: number
): CurriculumChapter {
  const chapterNo =
    Number(
      chapter.chapterNo
    ) ||
    index + 1;

  return {
    id:
      normalizeText(
        chapter.id
      ) ||
      `chapter-${chapterNo}`,

    chapterNo,

    title:
      normalizeText(
        chapter.title
      ),

    lessons:
      Array.isArray(
        chapter.lessons
      )
        ? chapter.lessons.map(
            (
              lesson,
              lessonIndex
            ) =>
              normalizeLesson(
                lesson,
                chapterNo,
                lessonIndex
              )
          )
        : [],
  };
}

/* =====================================================
   TẠO ID ỔN ĐỊNH
===================================================== */

export function buildCurriculumId(
  subjectCode: string,
  grade: number
): string {
  return `${subjectCode
    .trim()
    .toUpperCase()}-${grade}`;
}

/* =====================================================
   SINH LESSON CODE
===================================================== */

export function buildLessonCode(
  subjectCode: string,
  grade: number,
  lessonNo: number
): string {
  const prefix =
    subjectCode
      .trim()
      .toUpperCase();

  if (
    prefix === "TA"
  ) {
    return `${prefix}${grade}_U${lessonNo}`;
  }

  return `${prefix}${grade}_B${lessonNo}`;
}

/* =====================================================
   CHUẨN HÓA CURRICULUM TRƯỚC KHI LƯU
===================================================== */

export function normalizeCurriculum(
  input:
    Partial<CurriculumDocument>
): CurriculumDocument {
  const subjectCode =
    normalizeText(
      input.subjectCode
    ).toUpperCase();

  const grade =
    Number(
      input.grade
    );

  const chapters =
    Array.isArray(
      input.chapters
    )
      ? input.chapters.map(
          (
            chapter,
            index
          ) =>
            normalizeChapter(
              chapter,
              index
            )
        )
      : [];

  let globalLessonNo =
    1;

  const normalizedChapters =
    chapters.map(
      (chapter) => ({
        ...chapter,

        lessons:
          chapter.lessons.map(
            (lesson) => {
              const next =
                {
                  ...lesson,

                  lessonNo:
                  globalLessonNo,

                lessonCode:
                  lesson.lessonCode ||
                  buildLessonCode(
                    subjectCode,
                    grade,
                    globalLessonNo
                  ),
                };

              globalLessonNo +=
                1;

              return next;
            }
          ),
      })
    );

  return {
    id:
      input.id,

    subjectId:
      normalizeText(
        input.subjectId
      ),

    subjectCode,

    subjectName:
      normalizeText(
        input.subjectName
      ),

    grade,

    curriculumVersion:
      normalizeText(
        input.curriculumVersion
      ) ||
      "GDPT2018",

    sourceBookId:
      normalizeText(
        input.sourceBookId
      ) ||
      undefined,

    chapters:
      normalizedChapters,

    status:
      input.status ??
      "draft",

    createdAt:
      input.createdAt,

    updatedAt:
      input.updatedAt,
  };
}

/* =====================================================
   VALIDATE
===================================================== */

export function validateCurriculum(
  curriculum:
    CurriculumDocument
): string[] {
  const errors:
    string[] = [];

  if (
    !curriculum.subjectCode
  ) {
    errors.push(
      "Thiếu mã môn học."
    );
  }

  if (
    !curriculum.subjectName
  ) {
    errors.push(
      "Thiếu tên môn học."
    );
  }

  if (
    !Number.isInteger(
      curriculum.grade
    ) ||
    curriculum.grade <
      1
  ) {
    errors.push(
      "Khối lớp không hợp lệ."
    );
  }

  if (
    curriculum.chapters.length ===
    0
  ) {
    errors.push(
      "Curriculum chưa có chương."
    );
  }

  const lessonCodes =
    new Set<string>();

  curriculum.chapters.forEach(
    (
      chapter,
      chapterIndex
    ) => {
      if (
        !chapter.title
      ) {
        errors.push(
          `Chương ${
            chapterIndex +
            1
          } chưa có tên.`
        );
      }

      chapter.lessons.forEach(
        (
          lesson,
          lessonIndex
        ) => {
          if (
            !lesson.title
          ) {
            errors.push(
              `Bài ${
                lessonIndex +
                1
              } của chương ${
                chapterIndex +
                1
              } chưa có tên.`
            );
          }

          if (
            !lesson.lessonCode
          ) {
            errors.push(
              `Bài "${lesson.title}" chưa có mã bài.`
            );

            return;
          }

          const code =
            lesson.lessonCode
              .trim()
              .toUpperCase();

          if (
            lessonCodes.has(
              code
            )
          ) {
            errors.push(
              `Trùng mã bài: ${code}`
            );
          }

          lessonCodes.add(
            code
          );
        }
      );
    }
  );

  return errors;
}
export function flattenCurriculumLessons(
  curriculum:
    CurriculumDocument
): Array<{
  subjectCode: string;

  subjectName: string;

  grade: number;

  chapterId: string;

  chapterNo: number;

  chapterTitle: string;

  lessonId: string;

  lessonCode: string;

  lessonNo: number;

  lessonTitle: string;

  startPage?: number;

  endPage?: number;

  status:
    CurriculumLesson["status"];
}> {
  return curriculum.chapters.flatMap(
    (chapter) =>
      chapter.lessons.map(
        (lesson) => ({
          subjectCode:
            curriculum.subjectCode,

          subjectName:
            curriculum.subjectName,

          grade:
            curriculum.grade,

          chapterId:
            chapter.id,

          chapterNo:
            chapter.chapterNo,

          chapterTitle:
            chapter.title,

          lessonId:
            lesson.id,

          lessonCode:
            lesson.lessonCode,

          lessonNo:
            lesson.lessonNo,

          lessonTitle:
            lesson.title,

          startPage:
            lesson.startPage,

          endPage:
            lesson.endPage,

          status:
            lesson.status,
        })
      )
  );
}
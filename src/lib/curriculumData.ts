// ============================================================
// EduBank AI - Curriculum Data
// Kết nối tri thức với cuộc sống - THCS
//
// Mục tiêu:
// - Dùng chung cho: Chuẩn hóa học liệu -> Ngân hàng câu hỏi -> Tạo đề.
// - Giữ nguyên mã Tin học 6 hiện có để không làm hỏng dữ liệu đã lưu.
// - Các môn/khối còn lại đã được khai báo đầy đủ ở cấp Subject + Grade.
// - Chỉ đưa lesson/chapter vào khi đã xác minh mục lục, tránh tạo mã bài sai.
//
// QUY ƯỚC MÃ:
//   Toán:                  T{grade}_B{n}
//   Ngữ văn:               NV{grade}_B{n}
//   Khoa học tự nhiên:     KHTN{grade}_B{n}
//   Lịch sử và Địa lí:     LSDL{grade}_B{n}
//   GDCD:                  GDCD{grade}_B{n}
//   Tin học:               TH{grade}_B{n}
//   Công nghệ:             CN{grade}_B{n}
//   Tiếng Anh Global Success: TA{grade}_U{n}
//
// LƯU Ý QUAN TRỌNG:
// lesson.code là khóa liên kết với knowledge_library/question_bank.
// Không đổi mã sau khi đã có dữ liệu Firestore.
// ============================================================

export type CurriculumStatus =
  | "empty"
  | "imported"
  | "reviewed"
  | "published";

export interface Lesson {
  id: string;
  code: string;
  lessonNo: number;
  title: string;
  status: CurriculumStatus;
}

export interface Chapter {
  id: string;
  chapterNo: number;
  title: string;
  lessons: Lesson[];
}

export interface Grade {
  id: string;
  grade: number;
  chapters: Chapter[];
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  grades: Grade[];
}

/* ============================================================
   HELPERS TẠO DỮ LIỆU
============================================================ */

function emptyGrades(
  subjectPrefix: string
): Grade[] {
  return [6, 7, 8, 9].map(
    (grade) => ({
      id: `${subjectPrefix}-grade-${grade}`,
      grade,
      chapters: [],
    })
  );
}

function lesson(
  id: string,
  code: string,
  lessonNo: number,
  title: string
): Lesson {
  return {
    id,
    code,
    lessonNo,
    title,
    status: "empty",
  };
}

/* ============================================================
   TIN HỌC
   Giữ nguyên dữ liệu Tin học 6 đang dùng trong hệ thống.
============================================================ */

const tinHocGrades: Grade[] = [
  {
    id: "grade-6",
    grade: 6,
    chapters: [
      {
        id: "th6-c1",
        chapterNo: 1,
        title: "Máy tính và cộng đồng",
        lessons: [
          lesson(
            "th6-b1",
            "TH6_B1",
            1,
            "Thông tin và dữ liệu"
          ),
          lesson(
            "th6-b2",
            "TH6_B2",
            2,
            "Xử lí thông tin"
          ),
          lesson(
            "th6-b3",
            "TH6_B3",
            3,
            "Thông tin trong máy tính"
          ),
        ],
      },

      {
        id: "th6-c2",
        chapterNo: 2,
        title:
          "Mạng máy tính và Internet",
        lessons: [
          lesson(
            "th6-b4",
            "TH6_B4",
            4,
            "Mạng máy tính"
          ),
          lesson(
            "th6-b5",
            "TH6_B5",
            5,
            "Internet"
          ),
          lesson(
            "th6-b6",
            "TH6_B6",
            6,
            "World Wide Web và trình duyệt"
          ),
        ],
      },
    ],
  },

  {
    id: "th-grade-7",
    grade: 7,
    chapters: [],
  },

  {
    id: "th-grade-8",
    grade: 8,
    chapters: [],
  },

  {
    id: "th-grade-9",
    grade: 9,
    chapters: [],
  },
];

/* ============================================================
   DANH MỤC MÔN THCS - KẾT NỐI TRI THỨC
============================================================ */

export const curriculumData: Subject[] = [
  {
    id: "subject-toan",
    code: "T",
    name: "Toán",
    grades: emptyGrades("toan"),
  },

  {
    id: "subject-nv",
    code: "NV",
    name: "Ngữ văn",
    grades: emptyGrades("nv"),
  },

  {
    id: "subject-khtn",
    code: "KHTN",
    name: "Khoa học tự nhiên",
    grades: emptyGrades("khtn"),
  },

  {
    id: "subject-lsdl",
    code: "LSDL",
    name: "Lịch sử và Địa lí",
    grades: emptyGrades("lsdl"),
  },

  {
    id: "subject-gdcd",
    code: "GDCD",
    name: "Giáo dục công dân",
    grades: emptyGrades("gdcd"),
  },

  {
    id: "subject-th",
    code: "TH",
    name: "Tin học",
    grades: tinHocGrades,
  },

  {
    id: "subject-cn",
    code: "CN",
    name: "Công nghệ",
    grades: emptyGrades("cn"),
  },

  {
    id: "subject-ta",
    code: "TA",
    name: "Tiếng Anh",
    grades: emptyGrades("ta"),
  },
];

/* ============================================================
   HÀM TRA CỨU DÙNG CHUNG
============================================================ */

export function getSubjectById(
  subjectId: string
): Subject | undefined {
  return curriculumData.find(
    (subject) =>
      subject.id === subjectId
  );
}

export function getSubjectByCode(
  subjectCode: string
): Subject | undefined {
  const normalized =
    subjectCode
      .trim()
      .toUpperCase();

  return curriculumData.find(
    (subject) =>
      subject.code.toUpperCase() ===
      normalized
  );
}

export function getGrade(
  subjectId: string,
  gradeNumber: number
): Grade | undefined {
  return getSubjectById(
    subjectId
  )?.grades.find(
    (grade) =>
      grade.grade ===
      gradeNumber
  );
}

export function getAllLessons(
  subjectId?: string,
  gradeNumber?: number
): Lesson[] {
  const subjects =
    subjectId
      ? curriculumData.filter(
          (subject) =>
            subject.id ===
            subjectId
        )
      : curriculumData;

  const result: Lesson[] = [];

  subjects.forEach(
    (subject) => {
      subject.grades.forEach(
        (grade) => {
          if (
            gradeNumber !==
              undefined &&
            grade.grade !==
              gradeNumber
          ) {
            return;
          }

          grade.chapters.forEach(
            (chapter) => {
              result.push(
                ...chapter.lessons
              );
            }
          );
        }
      );
    }
  );

  return result;
}

export function getLessonByCode(
  lessonCode: string
): {
  subject: Subject;
  grade: Grade;
  chapter: Chapter;
  lesson: Lesson;
} | null {
  const normalized =
    lessonCode
      .trim()
      .toUpperCase();

  for (
    const subject of
    curriculumData
  ) {
    for (
      const grade of
      subject.grades
    ) {
      for (
        const chapter of
        grade.chapters
      ) {
        const found =
          chapter.lessons.find(
            (item) =>
              item.code
                .toUpperCase() ===
              normalized
          );

        if (found) {
          return {
            subject,
            grade,
            chapter,
            lesson:
              found,
          };
        }
      }
    }
  }

  return null;
}

export function getChapterById(
  subjectId: string,
  gradeId: string,
  chapterId: string
): Chapter | undefined {
  return getSubjectById(
    subjectId
  )
    ?.grades.find(
      (grade) =>
        grade.id === gradeId
    )
    ?.chapters.find(
      (chapter) =>
        chapter.id ===
        chapterId
    );
}

/* ============================================================
   KIỂM TRA TÍNH NHẤT QUÁN
============================================================ */

export interface CurriculumValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCurriculumData():
  CurriculumValidationResult {
  const errors:
    string[] = [];

  const subjectIds =
    new Set<string>();

  const lessonIds =
    new Set<string>();

  const lessonCodes =
    new Set<string>();

  curriculumData.forEach(
    (subject) => {
      if (
        subjectIds.has(
          subject.id
        )
      ) {
        errors.push(
          `Trùng subject.id: ${subject.id}`
        );
      }

      subjectIds.add(
        subject.id
      );

      subject.grades.forEach(
        (grade) => {
          const chapterIds =
            new Set<string>();

          grade.chapters.forEach(
            (chapter) => {
              if (
                chapterIds.has(
                  chapter.id
                )
              ) {
                errors.push(
                  `Trùng chapter.id: ${chapter.id}`
                );
              }

              chapterIds.add(
                chapter.id
              );

              chapter.lessons.forEach(
                (item) => {
                  if (
                    lessonIds.has(
                      item.id
                    )
                  ) {
                    errors.push(
                      `Trùng lesson.id: ${item.id}`
                    );
                  }

                  lessonIds.add(
                    item.id
                  );

                  const code =
                    item.code
                      .trim()
                      .toUpperCase();

                  if (
                    lessonCodes.has(
                      code
                    )
                  ) {
                    errors.push(
                      `Trùng lesson.code: ${item.code}`
                    );
                  }

                  lessonCodes.add(
                    code
                  );
                }
              );
            }
          );
        }
      );
    }
  );

  return {
    isValid:
      errors.length === 0,
    errors,
  };
}

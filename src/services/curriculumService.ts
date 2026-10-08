import { educationRequest } from "@/services/educationApiClient";
import { buildCurriculumId, normalizeCurriculum, validateCurriculum } from "@/lib/education/curriculum";
import type { CurriculumDocument, CurriculumLesson, CurriculumChapter } from "@/lib/education/curriculum";
export * from "@/lib/education/curriculum";

export async function saveCurriculum(input: Partial<CurriculumDocument>): Promise<string> {
  const curriculum = normalizeCurriculum(input);
  const errors = validateCurriculum(curriculum);
  if (errors.length) throw new Error(errors.join("\n"));
  const result = await educationRequest("/api/curriculum/manage", { method:"POST", body:JSON.stringify(curriculum) });
  return result.id as string;
}
export async function getAllCurriculums(): Promise<CurriculumDocument[]> {
  const result = await educationRequest("/api/curriculum/list");
  return result.curriculums as CurriculumDocument[];
}
export async function getCurriculumsBySubject(subjectCode: string): Promise<CurriculumDocument[]> {
  const result = await educationRequest(`/api/curriculum/list?subjectCode=${encodeURIComponent(subjectCode.trim().toUpperCase())}`);
  return result.curriculums as CurriculumDocument[];
}
export async function getCurriculum(subjectCode: string, grade: number): Promise<CurriculumDocument | null> {
  const list = await getCurriculumsBySubject(subjectCode);
  return list.find(item => item.id === buildCurriculumId(subjectCode, grade)) ?? null;
}
export async function getCurriculumLessonByCode(
  lessonCode: string
): Promise<{
  curriculum:
    CurriculumDocument;

  chapter:
    CurriculumChapter;

  lesson:
    CurriculumLesson;
} | null> {
  const normalizedCode =
    lessonCode
      .trim()
      .toUpperCase();

  const all =
    await getAllCurriculums();

  for (
    const curriculum of
    all
  ) {
    for (
      const chapter of
      curriculum.chapters
    ) {
      const found =
        chapter.lessons.find(
          (lesson) =>
            lesson.lessonCode
              .trim()
              .toUpperCase() ===
            normalizedCode
        );

      if (found) {
        return {
          curriculum,
          chapter,
          lesson:
            found,
        };
      }
    }
  }

  return null;
}


export async function updateLessonStatus(subjectCode: string, grade: number, lessonCode: string, status: CurriculumLesson["status"]): Promise<void> {
  await educationRequest("/api/curriculum/manage", { method:"PATCH", body:JSON.stringify({subjectCode, grade, lessonCode, status}) });
}
export async function deleteCurriculum(subjectCode: string, grade: number): Promise<void> {
  await educationRequest("/api/curriculum/manage", { method:"DELETE", body:JSON.stringify({subjectCode, grade}) });
}

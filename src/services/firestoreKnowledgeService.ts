import { educationRequest } from "@/services/educationApiClient";
export interface KnowledgeRepositoryData {
  lessonCode: string;
  lessonTitle: string;
  subject: string;
  grade: number;
  chapterTitle: string;

  objectives: unknown[];
  knowledgeUnits: unknown[];
  keywords: unknown[];
  activities: unknown[];
  exercises: unknown[];

  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}


export async function saveKnowledgeRepository(data: KnowledgeRepositoryData): Promise<void> {
  await educationRequest("/api/knowledge/save", {method:"POST",body:JSON.stringify(data)});
}
export async function getKnowledgeRepositoryByLessonCode(lessonCode: string): Promise<KnowledgeRepositoryData|null> {
  if(!lessonCode.trim()) return null;
  const result=await educationRequest(`/api/knowledge/lesson?lessonCode=${encodeURIComponent(lessonCode.trim())}`);
  return result.knowledge as KnowledgeRepositoryData|null;
}
export async function lessonExists(lessonCode: string): Promise<boolean> {
  return (await getKnowledgeRepositoryByLessonCode(lessonCode)) !== null;
}

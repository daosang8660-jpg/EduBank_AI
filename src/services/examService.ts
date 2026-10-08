import { educationRequest } from "@/services/educationApiClient";
import { validateExam, normalizeExam } from "@/lib/education/exam";
import type { SaveExamInput, SaveExamResult, SavedExam } from "@/lib/education/exam";
export * from "@/lib/education/exam";
export async function saveExam(input:SaveExamInput, examId?:string):Promise<SaveExamResult> {
  validateExam(input);
  return await educationRequest("/api/exams/records",{method:examId?"PATCH":"POST",body:JSON.stringify({input:normalizeExam(input),...(examId?{id:examId}:{})})}) as unknown as SaveExamResult;
}
export async function getExamById(id:string):Promise<SavedExam|null> {
  if(!id.trim()) return null;
  const result=await educationRequest(`/api/exams/records?id=${encodeURIComponent(id.trim())}`);
  return result.exam as SavedExam|null;
}
export async function getSavedExams():Promise<SavedExam[]> {
  const result=await educationRequest("/api/exams/records");
  return result.exams as SavedExam[];
}
export async function finalizeExam(id:string):Promise<void> {
  await educationRequest("/api/exams/records",{method:"PATCH",body:JSON.stringify({id,status:"final"})});
}

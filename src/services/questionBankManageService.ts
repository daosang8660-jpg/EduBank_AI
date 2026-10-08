import { educationRequest } from "@/services/educationApiClient";
import { normalizeQuestionBankItem } from "@/services/questionBankReadService";
import type { QuestionBankItem, QuestionBankStatus, QuestionSourceType } from "@/services/questionBankReadService";
import type { QuestionLevel, QuestionType } from "@/services/questionGeneratorService";
import { validateQuestion } from "@/lib/education/questionEdit";
export interface UpdateQuestionBankInput {
  id:string; question:string; type:QuestionType; level:QuestionLevel; options?:string[];
  correctAnswer:string; explanation:string; sourceKnowledgeIds?:string[]; sourceType?:QuestionSourceType;
}
export interface QuestionBankManageResult { success:boolean; id:string; status?:QuestionBankStatus; }
export async function getQuestionBankItemById(id:string): Promise<QuestionBankItem|null> {
  if(!id.trim()) return null;
  const result=await educationRequest(`/api/question-bank?id=${encodeURIComponent(id.trim())}`);
  return result.item ? normalizeQuestionBankItem(result.item.id,result.item) : null;
}
export async function updateQuestionBankItem(input:UpdateQuestionBankInput): Promise<QuestionBankManageResult> {
  validateQuestion(input);
  return await educationRequest("/api/question-bank",{method:"PATCH",body:JSON.stringify(input)}) as unknown as QuestionBankManageResult;
}
async function statusUpdate(id:string,status:QuestionBankStatus):Promise<QuestionBankManageResult> {
  return await educationRequest("/api/question-bank",{method:"PATCH",body:JSON.stringify({id,status})}) as unknown as QuestionBankManageResult;
}
export const deactivateQuestionBankItem=(id:string)=>statusUpdate(id,"inactive");
export const restoreQuestionBankItem=(id:string)=>statusUpdate(id,"approved");

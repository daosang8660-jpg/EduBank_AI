// src/services/questionBankService.ts
import { auth } from "@/lib/firebase";
import type { QuestionLevel, QuestionType } from "@/services/questionGeneratorService";

export type QuestionSourceType =
  | "ai"
  | "teacher_upload"
  | "manual";

export interface ApprovedQuestionInput {
  id: string;

  subject: string;
  grade: number;

  chapterTitle: string;

  lessonCode: string;
  lessonTitle: string;

  type: QuestionType;
  level: QuestionLevel;

  question: string;

  options?: string[];

  correctAnswer: string;

  explanation: string;

  sourceKnowledgeIds: string[];

  sourceType: QuestionSourceType;

  createdBy?: string;
}

export interface SaveApprovedQuestionsResult {
  success: boolean;

  total: number;

  ids: string[];

  savedItems: Array<{
    sourceQuestionId: string;
    bankQuestionId: string;
  }>;
}

// Retain request ID for retries of the same list/payload to avoid duplicate writes.
const attempts = new WeakMap<ApprovedQuestionInput[], { payload:string; requestId:string }>();

export async function saveApprovedQuestions(questions: ApprovedQuestionInput[]): Promise<SaveApprovedQuestionsResult> {
  if (!Array.isArray(questions) || !questions.length || questions.length > 450) {
    throw new Error("Mỗi lần lưu từ 1 đến 450 câu hỏi.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Bạn cần đăng nhập để lưu câu hỏi.");
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error("Phiên đăng nhập đã thay đổi. Hãy thử lại.");
  const payload = JSON.stringify(questions);
  let attempt = attempts.get(questions);
  if (!attempt || attempt.payload !== payload) {
    attempt = { payload, requestId:crypto.randomUUID() };
    attempts.set(questions, attempt);
  }
  let response: Response;
  try {
    response = await fetch("/api/save-questions", { method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body:JSON.stringify({ questions, requestId:attempt.requestId }) });
  } catch { throw new Error("Chưa nhận được xác nhận lưu. Hãy thử lại cùng danh sách câu hỏi."); }
  const raw = await response.text();
  let result: SaveApprovedQuestionsResult & { message?:string };
  try { result = JSON.parse(raw); }
  catch { throw new Error(`API lưu câu hỏi trả dữ liệu không hợp lệ (HTTP ${response.status}). Kiểm tra đường dẫn và log máy chủ.`); }
  if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được câu hỏi.");
  if (result.total !== questions.length || !Array.isArray(result.ids) || result.ids.length !== questions.length || !Array.isArray(result.savedItems)) {
    throw new Error("Kết quả xác nhận lưu không đầy đủ. Hãy kiểm tra trước khi lưu lại.");
  }
  return result;
}

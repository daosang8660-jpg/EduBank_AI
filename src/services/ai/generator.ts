import { generateQuestionsFromKnowledge } from "@/services/questionGeneratorService";
import type { GeneratedQuestion } from "@/services/questionGeneratorService";
export type ConfiguredQuestion = GeneratedQuestion & { content: string; topic: string; subject: string; grade: number; chapterTitle: string };
import type { CurriculumDocument } from "@/services/curriculumService";
import { buildRequests, type Selection, type QuestionConfigData } from "@/components/ai/questionSetup";

// Gemini is called only by the existing server API. Never put its key here.
export async function generateConfiguredQuestions(selection: Selection, curriculums: CurriculumDocument[], config: QuestionConfigData) {
  const requests = buildRequests(selection, curriculums, config);
  const questions: ConfiguredQuestion[] = [];
  for (const request of requests) {
    const result = await generateQuestionsFromKnowledge(request.input);
    const expected = request.input.specifications.reduce((n, s) => n + s.count, 0);
    if (result.questions.length !== expected) throw new Error(`AI trả ${result.questions.length}/${expected} câu cho “${request.topic}”. Hãy thử lại trước khi lưu.`);
    const actual = new Map<string, number>();
    for (const question of result.questions) {
      const key = `${question.type}:${question.level}`;
      actual.set(key, (actual.get(key) ?? 0) + 1);
    }
    for (const specification of request.input.specifications) {
      if (actual.get(`${specification.type}:${specification.level}`) !== specification.count) {
        throw new Error(`AI chưa trả đúng dạng và mức độ cho “${request.topic}”. Hãy thử lại trước khi lưu.`);
      }
    }
    questions.push(...result.questions.map(q => ({ ...q, content: q.question, topic: request.topic, subject: request.input.subject, grade: request.input.grade, chapterTitle: request.input.chapterTitle })));
  }
  return questions;
}

// Legacy entrypoint: callers must provide real structured lesson context.
export async function generateQuestions(selection: Selection, config: QuestionConfigData, contextText: string) {
  const context = JSON.parse(contextText) as { curriculums?: CurriculumDocument[] };
  if (!Array.isArray(context.curriculums)) throw new Error("Cần Curriculum và học liệu thực tế. Hãy dùng generateConfiguredQuestions.");
  return generateConfiguredQuestions(selection, context.curriculums, config);
}

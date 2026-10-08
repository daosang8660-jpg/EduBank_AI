import type { CurriculumDocument } from "@/services/curriculumService";
import type { KnowledgeData, GenerateQuestionsInput, QuestionLevel, QuestionType } from "@/services/questionGeneratorService";

export interface Selection { subject: string; grade: string; book?: string; chapter: string; lesson: string }
export type LevelKey = "nb" | "th" | "vd" | "vdc";
export type TypeKey = "multipleChoice" | "trueFalse" | "shortAnswer" | "essay";
export interface Topic { id: string; name: string; knowledge: KnowledgeData; counts: Record<LevelKey, number> }
export interface QuestionConfigData { topics: Topic[]; types: Record<TypeKey, boolean>; temperature: number }
export const levels: { key: LevelKey; label: string; value: QuestionLevel }[] = [
  { key: "nb", label: "Nhận biết", value: "recognition" },
  { key: "th", label: "Thông hiểu", value: "understanding" },
  { key: "vd", label: "Vận dụng", value: "application" },
  { key: "vdc", label: "Vận dụng cao", value: "high_application" },
];
export const types: { key: TypeKey; label: string; value: QuestionType }[] = [
  { key: "multipleChoice", label: "Trắc nghiệm nhiều lựa chọn", value: "multiple_choice" },
  { key: "trueFalse", label: "Đúng / Sai", value: "true_false" },
  { key: "shortAnswer", label: "Trả lời ngắn", value: "short_answer" },
  { key: "essay", label: "Tự luận", value: "essay" },
];
export const emptySelection: Selection = { subject: "", grade: "", chapter: "", lesson: "" };
export function initialConfig(): QuestionConfigData {
  return { topics: [], types: { multipleChoice: true, trueFalse: false, shortAnswer: false, essay: false }, temperature: 0.35 };
}
export function curriculumId(c: CurriculumDocument) { return c.id ?? `${c.subjectCode}-${c.grade}`; }
export function resolveSelection(curriculums: CurriculumDocument[], s: Selection) {
  const curriculum = curriculums.find(c => c.subjectCode === s.subject && curriculumId(c) === s.grade);
  const chapter = curriculum?.chapters.find(c => c.id === s.chapter);
  const lesson = chapter?.lessons.find(l => l.lessonCode === s.lesson);
  return { curriculum, chapter, lesson };
}
export function normalizeKnowledge(data: Partial<KnowledgeData>): KnowledgeData {
  return { objectives: Array.isArray(data.objectives) ? data.objectives : [], knowledgeUnits: Array.isArray(data.knowledgeUnits) ? data.knowledgeUnits : [], keywords: Array.isArray(data.keywords) ? data.keywords : [], activities: Array.isArray(data.activities) ? data.activities : [], exercises: Array.isArray(data.exercises) ? data.exercises : [] };
}
export function knowledgeTopics(data: KnowledgeData, lessonCode: string, lessonTitle: string): Topic[] {
  const counts = () => ({ nb: 0, th: 0, vd: 0, vdc: 0 });
  if (data.knowledgeUnits.length) return data.knowledgeUnits.map((unit, index) => ({
    id: `${lessonCode}:${unit.id || index}:${index}`, name: unit.title || `Đơn vị kiến thức ${index + 1}`,
    knowledge: { ...data, knowledgeUnits: [unit], exercises: [] }, counts: counts(),
  }));
  if (Object.values(data).some(items => items.length > 0)) return [{ id: lessonCode, name: lessonTitle, knowledge: data, counts: counts() }];
  return [];
}
export function totalCount(config: QuestionConfigData) {
  return config.topics.reduce((sum, topic) => sum + levels.reduce((n, level) => n + topic.counts[level.key], 0), 0);
}
export function buildRequests(selection: Selection, curriculums: CurriculumDocument[], config: QuestionConfigData): { topic: string; input: GenerateQuestionsInput }[] {
  const { curriculum, chapter, lesson } = resolveSelection(curriculums, selection);
  if (!curriculum || !chapter || !lesson) throw new Error("Chọn đầy đủ môn, khối, chương và bài học.");
  const selectedTypes = types.filter(t => config.types[t.key]);
  if (!selectedTypes.length) throw new Error("Chọn ít nhất một dạng câu hỏi.");
  const total = totalCount(config);
  if (!Number.isInteger(total) || total < 1 || total > 50) throw new Error("Mỗi lần tạo từ 1 đến 50 câu hỏi.");
  let cursor = 0;
  return config.topics.flatMap(topic => {
    const specifications = levels.flatMap(level => {
      const count = topic.counts[level.key];
      if (!Number.isInteger(count) || count < 0) throw new Error("Số câu hỏi phải là số nguyên không âm.");
      const counts = selectedTypes.map(() => 0);
      for (let i = 0; i < count; i++) counts[cursor++ % selectedTypes.length]++;
      return selectedTypes.flatMap((type, index) => counts[index] ? [{ type: type.value, level: level.value, count: counts[index] }] : []);
    });
    if (!specifications.length) return [];
    return [{ topic: topic.name, input: { lessonCode: lesson.lessonCode, lessonTitle: lesson.title, subject: curriculum.subjectName, grade: curriculum.grade, chapterTitle: chapter.title, knowledge: topic.knowledge, specifications, temperature: config.temperature } }];
  });
}

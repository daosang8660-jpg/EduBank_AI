import type { ConfiguredQuestion } from "@/services/ai/generator";
import { useEffect, useRef, useState } from "react";
import LessonSelector from "@/components/ai/LessonSelector";
import QuestionConfig from "@/components/ai/QuestionConfig";
import GenerateButton from "@/components/ai/GenerateButton";
import { getAllCurriculums, type CurriculumDocument } from "@/services/curriculumService";
import { getKnowledgeRepositoryByLessonCode } from "@/services/firestoreKnowledgeService";
import type { KnowledgeData } from "@/services/questionGeneratorService";
import { emptySelection, initialConfig, resolveSelection, normalizeKnowledge, knowledgeTopics, type Selection } from "@/components/ai/questionSetup";
interface Props { setActiveTab: (tab: string) => void; onDataGenerated?: (questions: ConfiguredQuestion[]) => void }
export default function AIGenerator({ setActiveTab, onDataGenerated }: Props) {
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [config, setConfig] = useState(initialConfig);
  const [curriculums, setCurriculums] = useState<CurriculumDocument[]>([]);
  const [loadingCurriculums, setLoadingCurriculums] = useState(true);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  useEffect(() => {
    let active = true;
    getAllCurriculums().then(data => { if (active) setCurriculums(data); }).catch(() => { if (active) setError("Không thể tải danh sách môn và bài học."); }).finally(() => { if (active) setLoadingCurriculums(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const version = ++requestVersion.current;
    let active = true;
    const current = () => active && version === requestVersion.current;
    setConfig(c => ({ ...c, topics: [] }));
    const { curriculum, lesson } = resolveSelection(curriculums, selection);
    if (!curriculum || !lesson) { setLoadingKnowledge(false); return; }
    setLoadingKnowledge(true); setError("");
    getKnowledgeRepositoryByLessonCode(lesson.lessonCode).then(data => {
      if (!current()) return;
      if (!data) throw new Error("Bài học chưa có học liệu trong hệ thống.");
      if (data.lessonCode !== lesson.lessonCode || Number(data.grade) !== curriculum.grade || ![curriculum.subjectName, curriculum.subjectCode, curriculum.subjectId].includes(data.subject)) throw new Error("Học liệu không khớp môn, khối hoặc mã bài. Cần kiểm tra lại dữ liệu.");
      const topics = knowledgeTopics(normalizeKnowledge(data as Partial<KnowledgeData>), lesson.lessonCode, lesson.title);
      if (!topics.length) throw new Error("Học liệu của bài này chưa có nội dung.");
      setConfig(c => ({ ...c, topics }));
    }).catch(e => { if (current()) setError(e instanceof Error ? e.message : "Không thể tải học liệu."); }).finally(() => { if (current()) setLoadingKnowledge(false); });
    return () => { active = false; };
  }, [curriculums, selection]);
  const changeSelection = (next: Selection) => {
    if (generating) return;
    requestVersion.current++; setConfig(c => ({ ...c, topics: [] })); setError(""); setSelection(next);
  };
  return <div className="bg-slate-50 p-6">
    <h1 className="text-3xl font-bold text-slate-800">Tạo câu hỏi bằng AI</h1>
    <p className="mb-6 mt-2 text-slate-500">Chọn nội dung, dạng câu hỏi và mức độ nhận thức để AI hỗ trợ tạo câu hỏi. Kiểm duyệt trước khi lưu vào ngân hàng.</p>
    {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {loadingCurriculums && <p className="mb-4">Đang tải danh sách môn và bài học...</p>}
    <div className="grid gap-6 lg:grid-cols-12"><div className="lg:col-span-5"><LessonSelector selection={selection} onChange={changeSelection} curriculums={curriculums} disabled={loadingCurriculums || generating} />{loadingKnowledge && <p className="mt-3 text-sm">Đang tải học liệu...</p>}</div>
      <div className="space-y-6 lg:col-span-7"><QuestionConfig config={config} setConfig={setConfig} disabled={loadingKnowledge || generating || !config.topics.length} /><GenerateButton selection={selection} config={config} curriculums={curriculums} disabled={loadingCurriculums || loadingKnowledge || !config.topics.length} onBusyChange={setGenerating} onSuccess={questions => { onDataGenerated?.(questions); setActiveTab("review_questions"); }} /></div>
    </div>
  </div>;
}

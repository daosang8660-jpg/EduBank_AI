import type { ConfiguredQuestion } from "@/services/ai/generator";
import { useRef, useState, useEffect } from "react";
import type { CurriculumDocument } from "@/services/curriculumService";
import { generateConfiguredQuestions } from "@/services/ai/generator";
import { totalCount, types, type Selection, type QuestionConfigData } from "./questionSetup";
interface Props { selection: Selection; config: QuestionConfigData; curriculums: CurriculumDocument[]; disabled?: boolean; onBusyChange: (busy: boolean) => void; onSuccess: (questions: ConfiguredQuestion[]) => void }
export default function GenerateButton({ selection, config, curriculums, disabled = false, onBusyChange, onSuccess }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const invalid = !selection.lesson || totalCount(config) < 1 || totalCount(config) > 50 || !types.some(t => config.types[t.key]);
  const handleGenerate = async () => {
    if (running.current || disabled || invalid) return;
    running.current = true;
    setIsGenerating(true); setError(""); onBusyChange(true);
    try { const questions = await generateConfiguredQuestions(selection, curriculums, config); if (mounted.current) onSuccess(questions); }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Không thể tạo câu hỏi."); }
    finally { running.current = false; if (mounted.current) { setIsGenerating(false); onBusyChange(false); } }
  };
  return <div className="rounded-lg border bg-white p-5 shadow-sm"><button type="button" onClick={() => void handleGenerate()} disabled={disabled || invalid || isGenerating} className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{isGenerating ? "Đang tạo câu hỏi..." : `Tạo ${totalCount(config)} câu hỏi`}</button>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<p className="mt-3 text-xs text-slate-500">Kết quả được chuyển sang màn hình kiểm duyệt trước khi lưu.</p></div>;
}

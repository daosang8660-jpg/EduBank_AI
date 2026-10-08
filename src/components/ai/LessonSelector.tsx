import type { CurriculumDocument } from "@/services/curriculumService";
import { curriculumId, resolveSelection, type Selection } from "./questionSetup";

interface Props { selection: Selection; onChange: (s: Selection) => void; curriculums: CurriculumDocument[]; disabled?: boolean }
export default function LessonSelector({ selection, onChange, curriculums, disabled = false }: Props) {
  const subjects = Array.from(new Map(curriculums.map(c => [c.subjectCode, c.subjectName])).entries());
  const grades = curriculums.filter(c => c.subjectCode === selection.subject).sort((a, b) => a.grade - b.grade);
  const { curriculum, chapter } = resolveSelection(curriculums, selection);
  const change = (field: keyof Selection, value: string) => {
    const next = { ...selection, [field]: value };
    if (field === "subject") { next.grade = ""; next.chapter = ""; next.lesson = ""; }
    if (field === "grade") { next.chapter = ""; next.lesson = ""; }
    if (field === "chapter") next.lesson = "";
    onChange(next);
  };
  const className = "w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm disabled:opacity-50";
  return <section className="rounded-lg border bg-white p-5 shadow-sm">
    <h2 className="mb-4 text-lg font-bold">Chọn nội dung và học liệu</h2>
    <div className="space-y-4">
      <label className="block text-sm">Môn học<select aria-label="Môn học" className={className} value={selection.subject} disabled={disabled} onChange={e => change("subject", e.target.value)}><option value="">Chọn môn học</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="block text-sm">Khối lớp<select aria-label="Khối lớp" className={className} value={selection.grade} disabled={disabled || !selection.subject} onChange={e => change("grade", e.target.value)}><option value="">Chọn khối</option>{grades.map(c => <option key={curriculumId(c)} value={curriculumId(c)}>Khối {c.grade} — {c.curriculumVersion}</option>)}</select></label>
      <label className="block text-sm">Chương / Chủ đề<select aria-label="Chương / Chủ đề" className={className} value={selection.chapter} disabled={disabled || !curriculum} onChange={e => change("chapter", e.target.value)}><option value="">Chọn chương</option>{curriculum?.chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="block text-sm">Bài học<select aria-label="Bài học" className={className} value={selection.lesson} disabled={disabled || !chapter} onChange={e => change("lesson", e.target.value)}><option value="">Chọn bài học</option>{chapter?.lessons.map(l => <option key={l.lessonCode} value={l.lessonCode}>{l.title}</option>)}</select></label>
      {curriculum && !curriculum.chapters.length && <p className="text-sm text-amber-700">Môn và khối này chưa có danh sách chương, bài trong hệ thống.</p>}
      <p className="rounded bg-blue-50 p-3 text-xs text-blue-700">Chọn bài để tải học liệu trong hệ thống. Câu hỏi cần được kiểm duyệt trước khi lưu vào ngân hàng.</p>
    </div>
  </section>;
}

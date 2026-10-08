import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { displayText as text, filterLibrary, loadAdminLibrary, objectRows, type LibraryItem, type LibraryKind } from "@/services/adminLibraryService";

const statusLabels: Record<string, string> = { approved: "Đã duyệt", draft: "Bản nháp", final: "Đã chốt", pending_admin_review: "Chờ duyệt", needs_revision: "Cần chỉnh sửa" };
const typeLabels: Record<string, string> = { multiple_choice: "Trắc nghiệm", true_false: "Đúng/Sai", short_answer: "Trả lời ngắn", essay: "Tự luận" };
const levelLabels: Record<string, string> = { recognition: "Nhận biết", understanding: "Thông hiểu", application: "Vận dụng", high_application: "Vận dụng cao" };

function QuestionContent({ data, answers }: { data: Record<string, unknown>; answers: boolean }) {
  const options = Array.isArray(data.options) ? data.options.filter((value): value is string => typeof value === "string") : [];
  const guides = objectRows(data.markingGuide);
  return <div className="space-y-2">
    <p className="whitespace-pre-wrap text-slate-900">{text(data.question) || "Chưa có nội dung câu hỏi."}</p>
    {options.length > 0 && <ol className="list-inside list-[upper-alpha] space-y-1 text-sm text-slate-700">{options.map((option, index) => <li key={index} className="whitespace-pre-wrap">{option}</li>)}</ol>}
    {answers && <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="whitespace-pre-wrap"><strong>Đáp án: </strong>{text(data.correctAnswer) || "Chưa có đáp án."}</p>
      {text(data.explanation) && <p className="whitespace-pre-wrap"><strong>Giải thích: </strong>{text(data.explanation)}</p>}
      {guides.length > 0 && <div><strong>Hướng dẫn chấm:</strong>{guides.map((guide, index) => <p key={index} className="whitespace-pre-wrap">{text(guide.content)} ({text(guide.score)} điểm)</p>)}</div>}
    </div>}
  </div>;
}

export default function AdminBankBrowser({ kind }: { kind: LibraryKind }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [lastId, setLastId] = useState<string>();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [expanded, setExpanded] = useState<string>();
  const [answers, setAnswers] = useState(false);
  const generation = useRef(0);
  const loading = useRef(false);

  const load = useCallback(async (reset: boolean, afterId?: string) => {
    if (loading.current) return;
    loading.current = true;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    if (reset) {
      setItems([]); setExpanded(undefined); setLastId(undefined); setHasMore(false);
    }
    try {
      const page = await loadAdminLibrary(kind, reset ? undefined : afterId);
      if (current !== generation.current) return;
      setItems((previous) => reset ? page.items : [...previous, ...page.items.filter((item) => !previous.some((old) => old.id === item.id))]);
      setLastId(page.lastId); setHasMore(page.hasMore);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "Không thể tải ngân hàng.");
    } finally {
      if (current === generation.current) { loading.current = false; setBusy(false); }
    }
  }, [kind]);

  const invalidateLoad = useCallback(() => { ++generation.current; loading.current = false; }, []);
  useEffect(() => {
    loading.current = false;
    setSearch(""); setSubject(""); setGrade(""); setAnswers(false);
    void load(true);
    const originalUid = auth.currentUser?.uid;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.uid === originalUid) return;
      ++generation.current;
      loading.current = false;
      setItems([]); setExpanded(undefined); setHasMore(false); setBusy(false);
      // A changed session must re-enter through RoleGuard before reading again.
    });
    return () => { invalidateLoad(); unsubscribe(); };
  }, [load, invalidateLoad]);

  const subjects = useMemo(() => Array.from(new Set(items.map(({ data }) => text(data.subjectName) || text(data.subject) || text(data.subjectId)).filter(Boolean))).sort(), [items]);
  const grades = useMemo(() => Array.from(new Set(items.map(({ data }) => text(data.grade)).filter(Boolean))).sort(), [items]);
  const visible = useMemo(() => filterLibrary(items, search, subject, grade), [items, search, subject, grade]);

  return <section className="space-y-5 rounded-xl bg-white p-6 shadow">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold text-slate-800">{kind === "questions" ? "Ngân hàng câu hỏi" : "Đề kiểm tra đã lưu"}</h2>
        <p className="mt-1 text-sm text-slate-500">{kind === "questions" ? "Xem câu hỏi đã lưu, đáp án và giải thích." : "Mở nội dung đề, ma trận, câu hỏi và đáp án đã lưu."}</p></div>
      <button type="button" onClick={() => void load(true)} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Đang tải..." : "Làm mới"}</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <input aria-label="Tìm trong ngân hàng" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung, tên đề, bài học" className="min-w-48 flex-1 rounded-lg border px-3 py-2" />
      <select aria-label="Lọc môn" value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-lg border px-3 py-2"><option value="">Tất cả môn</option>{subjects.map((name) => <option key={name}>{name}</option>)}</select>
      <select aria-label="Lọc khối" value={grade} onChange={(event) => setGrade(event.target.value)} className="rounded-lg border px-3 py-2"><option value="">Tất cả khối</option>{grades.map((value) => <option key={value} value={value}>Khối {value}</option>)}</select>
    </div>
    <p className="text-sm text-slate-500">Hiển thị {visible.length}/{items.length} mục đã tải. {hasMore && "Còn dữ liệu: bấm Tải thêm. Tìm kiếm và bộ lọc áp dụng cho các mục đã tải."}</p>
    {!busy && !error && visible.length === 0 && <p className="rounded-lg bg-slate-50 p-5 text-center text-slate-500">Chưa có mục phù hợp.</p>}
    <div className="space-y-3">{visible.map(({ id, data }) => {
      const questions = objectRows(data.questions);
      const matrix = objectRows(data.matrix);
      return <article key={id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0 flex-1">
          <h3 className="whitespace-pre-wrap break-words font-bold text-slate-900">{kind === "questions" ? text(data.question) || "Câu hỏi chưa có nội dung" : text(data.examName) || "Đề chưa có tên"}</h3>
          <p className="mt-1 text-sm text-slate-600">{text(data.subjectName) || text(data.subject) || text(data.subjectId)} · Khối {text(data.grade)} · {statusLabels[text(data.status)] || text(data.status)}</p>
          {kind === "questions" ? <p className="mt-1 text-xs text-slate-500">{text(data.lessonCode)} · {text(data.lessonTitle)} · {typeLabels[text(data.type)] || text(data.type)} · {levelLabels[text(data.level)] || text(data.level)}</p>
            : <p className="mt-1 text-xs text-slate-500">{questions.length} câu · {text(data.duration)} phút · {text(data.totalScore)} điểm</p>}
        </div><button type="button" aria-expanded={expanded === id} onClick={() => { setExpanded(expanded === id ? undefined : id); setAnswers(false); }} className="h-fit rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700">{expanded === id ? "Thu gọn" : "Xem nội dung"}</button></div>
        {expanded === id && <div className="mt-4 space-y-4 border-t pt-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={answers} onChange={(event) => setAnswers(event.target.checked)} />Hiển thị đáp án và hướng dẫn chấm</label>
          {kind === "questions" ? <QuestionContent data={data} answers={answers} /> : <>
            {matrix.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left font-bold">Ma trận đề</caption><thead><tr><th className="p-2">Dạng câu</th><th className="p-2">Mức độ</th><th className="p-2">Số câu</th><th className="p-2">Điểm/câu</th></tr></thead><tbody>{matrix.map((row, index) => <tr key={index} className="border-t"><td className="p-2">{typeLabels[text(row.type)] || text(row.type)}</td><td className="p-2">{levelLabels[text(row.level)] || text(row.level)}</td><td className="p-2">{text(row.count)}</td><td className="p-2">{text(row.scorePerQuestion)}</td></tr>)}</tbody></table></div>}
            {questions.length === 0 && <p className="text-sm text-slate-600">Bản ghi chưa có nội dung câu hỏi. Nếu đây là đề tải lên, mở mục Tệp đề Word/PDF để xem.</p>}
            {questions.map((question, index) => <div key={index} className="space-y-2 rounded-lg border p-4"><h4 className="font-bold">Câu {index + 1} ({text(question.score)} điểm)</h4><QuestionContent data={question} answers={answers} /></div>)}
          </>}
        </div>}
      </article>;
    })}</div>
    {hasMore && <button type="button" onClick={() => void load(false, lastId)} disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang tải..." : "Tải thêm"}</button>}
  </section>;
}

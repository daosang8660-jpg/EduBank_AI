import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

type ExamStatus = "pending_admin_review" | "needs_revision" | "approved";
type ExamItem = {
  id: string;
  examName: string;
  teacherName: string;
  subjectId: string;
  grade: number;
  academicYear: string;
  semester: string;
  examPeriod: "midterm" | "final" | null;
  examDate: string | null;
  status: ExamStatus;
  examFileName: string;
  matrixFileName: string | null;
  createdAt: string | null;
};

const labels: Record<ExamStatus, string> = {
  pending_admin_review: "Chờ nhà trường xem",
  needs_revision: "Cần chỉnh sửa",
  approved: "Đã duyệt",
};

export default function AdminExamManager() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [limited, setLimited] = useState(false);

  const token = async () => {
    if (!auth.currentUser) throw new Error("Bạn cần đăng nhập lại.");
    return auth.currentUser.getIdToken();
  };

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Bạn cần đăng nhập lại.");
      const response = await fetch("/api/admin/exams", {
        headers: { Authorization: `Bearer ${await current.getIdToken()}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Không thể tải danh sách đề.");
      setExams(payload.exams);
      setLimited(Boolean(payload.limited));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách đề.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => exams.filter((exam) => {
    const text = `${exam.examName} ${exam.teacherName} ${exam.subjectId} ${exam.grade}`.toLocaleLowerCase("vi");
    return (statusFilter === "all" || exam.status === statusFilter) && text.includes(query.trim().toLocaleLowerCase("vi"));
  }), [exams, query, statusFilter]);

  async function updateStatus(exam: ExamItem, status: ExamStatus) {
    setWorkingId(exam.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(exam.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Không thể cập nhật đề.");
      setExams((current) => current.map((item) => item.id === exam.id ? { ...item, status } : item));
      setMessage(`Đã cập nhật trạng thái: ${labels[status]}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật đề.");
    } finally {
      setWorkingId("");
    }
  }

  async function download(id: string, kind: "exam" | "matrix", fileName: string) {
    setWorkingId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(id)}?kind=${kind}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || "Không tải được tệp.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được tệp.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="space-y-5 rounded-xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản lí đề kiểm tra</h2>
          <p className="mt-1 text-sm text-slate-500">Đề Word/PDF do admin tải lên; chỉ tài khoản quản trị xem và tải lại tệp.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
          {busy ? "Đang tải..." : "Làm mới"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <input aria-label="Tìm đề" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên đề, giáo viên, môn, khối" className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" />
        <select aria-label="Lọc trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      {limited && <p className="text-sm text-amber-700">Đang hiển thị 100 đề gần nhất.</p>}
      {!busy && visible.length === 0 && <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa có đề phù hợp.</p>}
      <div className="space-y-3">
        {visible.map((exam) => (
          <article key={exam.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">{exam.examName}</h3>
                <p className="mt-1 text-sm text-slate-600">{exam.subjectId} · Lớp {exam.grade} · {exam.examPeriod ? `${exam.examPeriod === "midterm" ? "Giữa" : "Cuối"} học kỳ ${exam.semester === "1" ? "I" : "II"}` : `Học kỳ ${exam.semester}`} · {exam.academicYear} · GV: {exam.teacherName}</p>
                {exam.createdAt && <p className="mt-1 text-xs text-slate-500">Tải lên: {new Date(exam.createdAt).toLocaleString("vi-VN")}</p>}
              </div>
              <span className="h-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{labels[exam.status] ?? exam.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={workingId === exam.id} onClick={() => void download(exam.id, "exam", exam.examFileName)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Tải đề: {exam.examFileName}</button>
              {exam.matrixFileName && <button type="button" disabled={workingId === exam.id} onClick={() => void download(exam.id, "matrix", exam.matrixFileName!)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Tải ma trận</button>}
              {exam.status !== "needs_revision" && <button type="button" disabled={workingId === exam.id} onClick={() => void updateStatus(exam, "needs_revision")} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Cần chỉnh sửa</button>}
              {exam.status !== "approved" && <button type="button" disabled={workingId === exam.id} onClick={() => void updateStatus(exam, "approved")} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Duyệt đề</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

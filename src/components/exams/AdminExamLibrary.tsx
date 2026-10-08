import { useState } from "react";
import AdminBankBrowser from "@/components/admin/AdminBankBrowser";
import AdminExamManager from "./AdminExamManager";

export default function AdminExamLibrary() {
  const [tab, setTab] = useState<"structured" | "files">("structured");
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Loại đề kiểm tra">
      <button type="button" onClick={() => setTab("structured")} aria-pressed={tab === "structured"} className={`rounded-lg px-4 py-2 font-semibold ${tab === "structured" ? "bg-blue-700 text-white" : "bg-white text-slate-700"}`}>Đề đã lưu</button>
      <button type="button" onClick={() => setTab("files")} aria-pressed={tab === "files"} className={`rounded-lg px-4 py-2 font-semibold ${tab === "files" ? "bg-blue-700 text-white" : "bg-white text-slate-700"}`}>Tệp đề Word/PDF</button>
    </div>
    {tab === "structured" ? <AdminBankBrowser kind="exams" /> : <AdminExamManager />}
  </div>;
}

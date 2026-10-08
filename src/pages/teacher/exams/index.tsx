import Link from "next/link";
import { useEffect, useState } from "react";
import RoleGuard from "@/components/auth/RoleGuard";
import { getSavedExams, type SavedExam } from "@/services/examService";
function ExamList(){
  const [items,setItems]=useState<SavedExam[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;getSavedExams().then(v=>{if(live)setItems(v);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Không tải được đề.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
  return <main className="p-6"><h1 className="text-2xl font-bold">Đề kiểm tra đã lưu</h1><Link className="text-blue-700" href="/teacher/exams/create">Tạo đề mới</Link>
    {loading&&<p>Đang tải...</p>}{error&&<p className="text-red-700">{error}</p>}
    {!loading&&!error&&items.length===0&&<p className="mt-4">Chưa có đề được lưu với tài khoản này.</p>}
    <div className="mt-4 space-y-4">{items.map(exam=><article key={exam.id} className="rounded-xl border bg-white p-4"><h2 className="font-bold">{exam.examName}</h2><p>{exam.subjectName} · Khối {exam.grade} · {exam.questions?.length??0} câu · {exam.status==="final"?"Đã chốt":"Bản nháp"}</p><div className="mt-2 flex gap-4"><Link className="text-blue-700" href={{pathname:"/teacher/exams/create",query:{examId:exam.id}}}>{exam.status==="final"?"Mở và tạo bản mới":"Mở / chỉnh sửa"}</Link><Link className="text-blue-700" href={{pathname:"/teacher/exams/create",query:{examId:exam.id,copy:"1"}}}>Dùng làm đề mới</Link></div></article>)}</div>
  </main>;
}
export default function TeacherExamLibrary(){return <RoleGuard requiredRole="teacher"><ExamList /></RoleGuard>;}

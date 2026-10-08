import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import RoleGuard from "@/components/auth/RoleGuard";
import ExamBuilder from "@/components/exams/ExamBuilder";
import { getExamById, type SavedExam } from "@/services/examService";
function TeacherExamContent() {
  const router=useRouter(), id=typeof router.query.examId==="string"?router.query.examId:undefined;
  const copy=router.query.copy==="1";
  const [exam,setExam]=useState<SavedExam|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!router.isReady) return;
    let live=true;
    setLoading(true);setError("");setExam(null);
    if(!id) {setLoading(false);return;}
    getExamById(id).then(value=>{if(live){if(!value) setError("Không tìm thấy đề.");else setExam(value);}})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:"Không tải được đề.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[router.isReady,id]);
  return <main className="p-6"><Link href="/teacher/exams" className="text-blue-700">← Đề đã lưu</Link>
    {error?<p className="mt-4 text-red-700">{error}</p>:loading?<p>Đang tải đề...</p>:
      <ExamBuilder key={`${id??"new"}:${copy}`} mode="teacher" initialExam={exam??undefined} copyExam={copy || exam?.status==="final"} />}
  </main>;
}
export default function TeacherCreateExamPage(){return <RoleGuard requiredRole="teacher"><Head><title>Tạo đề | Giáo viên</title></Head><TeacherExamContent /></RoleGuard>;}

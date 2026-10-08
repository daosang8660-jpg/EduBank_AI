import Head from "next/head";

import RoleGuard from "@/components/auth/RoleGuard";
import TeacherQuestionGenerator from "@/components/teacher/TeacherQuestionGenerator";

export default function TeacherPage() {
  return (
    <RoleGuard requiredRole="teacher">
      <Head>
        <title>Sinh câu hỏi | Giáo viên | EduBank AI</title>
      </Head>

      <TeacherQuestionGenerator />
    </RoleGuard>
  );
}

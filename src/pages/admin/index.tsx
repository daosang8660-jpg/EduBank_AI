import type { ConfiguredQuestion } from "@/services/ai/generator";
import { auth } from "@/lib/firebase";
import Head from "next/head";
import { useRouter } from "next/router";
import RoleGuard from "@/components/auth/RoleGuard";
import { useEffect, useState } from "react";

import AdminLayout from "@/components/admin/AdminLayout";
import type { MenuType } from "@/components/admin/Sidebar";

import GradeManager from "@/components/admin/GradeManager";
import SubjectManager from "@/components/admin/SubjectManager";
import ChapterManager from "@/components/admin/ChapterManager";
import LessonManager from "@/components/admin/LessonManager";
import KnowledgeRepositoryManager from "@/components/admin/KnowledgeRepositoryManager";
import UserManager from "@/components/admin/UserManager";
import TextbookImport from "@/components/curriculum/TextbookImport";

import AIGenerator from "@/components/AIGenerator";
import QuestionReview from "@/components/QuestionReview";
import AdminExamBuilder from "@/components/exams/AdminExamBuilder";
import AdminBankBrowser from "@/components/admin/AdminBankBrowser";
import AdminExamLibrary from "@/components/exams/AdminExamLibrary";

export default function AdminDashboard() {
  const router = useRouter();
  const [active, setActive] = useState<MenuType>("dashboard");
  useEffect(() => {
    if (!router.isReady) return;
    const section = router.query.section;
    const supported: MenuType[] = ["dashboard", "classes", "subjects", "books", "chapters", "lessons", "knowledge", "question-bank", "ai", "exams", "exam-matrix", "users", "settings"];
    if (typeof section === "string" && supported.includes(section as MenuType)) {
      setActive(section as MenuType);
    }
  }, [router.isReady, router.query.section]);
  const [activeAITab, setActiveAITab] = useState<string>("generate");
  const [generatedData, setGeneratedData] = useState<ConfiguredQuestion[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveToBank = async () => {
    if (isSaving) return;
    if (generatedData.length === 0) {
      alert("Chưa có câu hỏi để lưu.");
      return;
    }

    setIsSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Vui lòng đăng nhập trước khi lưu câu hỏi.");
      }
      const token = await user.getIdToken();
      if (auth.currentUser?.uid !== user.uid) {
        throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng thử lại.");
      }

      const response = await fetch("/api/save-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questions: generatedData,
        }),
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`API lưu câu hỏi trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
      }
      if (auth.currentUser?.uid !== user.uid) {
        throw new Error("Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại để kiểm tra kết quả lưu.");
      }
      if (response.status === 401) {
        throw new Error(result?.message || "Phiên đăng nhập không hợp lệ. Hãy đăng xuất rồi đăng nhập lại.");
      }
      if (!result || typeof result !== "object") {
        throw new Error(`API lưu câu hỏi trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Không thể lưu câu hỏi."
        );
      }

      alert("Đã lưu câu hỏi vào ngân hàng thành công.");
      setGeneratedData([]);
      setActiveAITab("generate");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Lỗi kết nối. Vui lòng thử lại."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoleGuard requiredRole="admin">
      <>
        <Head>
        <title>Quản trị | EduBank AI</title>
      </Head>

      <AdminLayout active={active} setActive={setActive}>
        {active === "dashboard" && (
          <section className="rounded-xl bg-white p-8 shadow">
            <h2 className="text-2xl font-bold text-slate-800">
              Dashboard quản trị
            </h2>
            <p className="mt-2 text-slate-500">
              Chọn một chức năng trong menu bên trái.
            </p>
          </section>
        )}

        {active === "classes" && <GradeManager />}

        {active === "subjects" && <SubjectManager />}

        {active === "books" && <TextbookImport />}

        {active === "chapters" && <ChapterManager />}

        {active === "lessons" && <LessonManager />}

        {active === "knowledge" && <KnowledgeRepositoryManager />}

        {active === "ai" && (
          <section>
            {activeAITab === "generate" && (
              <AIGenerator
                setActiveTab={setActiveAITab}
                onDataGenerated={setGeneratedData}
              />
            )}

            {activeAITab === "review_questions" && (
              <QuestionReview
                questions={generatedData}
                isSaving={isSaving}
                onSave={handleSaveToBank}
              />
            )}
          </section>
        )}

        {active === "question-bank" && <AdminBankBrowser kind="questions" />}

        {active === "exams" && <AdminExamLibrary />}

        {active === "exam-matrix" && <AdminExamBuilder />}

        {active === "users" && <UserManager />}

        {active === "settings" && (
          <section className="rounded-xl bg-white p-8 shadow">
            <h2 className="text-2xl font-bold text-slate-800">
              Cài đặt hệ thống
            </h2>
            <p className="mt-2 text-slate-500">
              Chức năng đang được phát triển.
            </p>
          </section>
        )}
      </AdminLayout>
      </>
    </RoleGuard>
  );
}

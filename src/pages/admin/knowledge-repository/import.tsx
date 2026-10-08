import type { ConfiguredQuestion } from "@/services/ai/generator";
import { auth } from "@/lib/firebase";
import React, { useState } from "react";
import Head from "next/head";

// Nhúng Header nằm cùng cấp thư mục
import Header from "../header"; 

// Import các component AI (Đảm bảo đường dẫn @/components khớp với dự án của bạn)
import AIGenerator from "@/components/AIGenerator"; 
import QuestionReview from "@/components/QuestionReview";

export default function AdminDashboard() {
  // State quản lý việc chuyển đổi giữa màn hình Tạo câu hỏi và màn hình Kiểm duyệt
  const [activeTab, setActiveTab] = useState("generate");
  
  // State lưu trữ mảng câu hỏi do AI sinh ra
  const [generatedData, setGeneratedData] = useState<ConfiguredQuestion[]>([]);
  
  // State quản lý hiệu ứng loading khi đang lưu dữ liệu vào DB
  const [isSaving, setIsSaving] = useState(false);

  // Hàm xử lý lưu dữ liệu lên API
  const handleSaveToBank = async () => {
    if (isSaving) return;
    if (generatedData.length === 0) return;
    
    setIsSaving(true);
    
    try {
      // Gọi API endpoint để lưu vào cơ sở dữ liệu
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
        body: JSON.stringify({ questions: generatedData }),
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

      if (response.ok && result.success) {
        alert("Thành công: Đã lưu đề cương vào ngân hàng câu hỏi!");
        // Làm sạch dữ liệu và quay về màn hình khởi tạo
        setGeneratedData([]);
        setActiveTab("generate");
      } else {
        alert("Lỗi: " + result.message);
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Lỗi kết nối. Vui lòng thử lại!"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Head>
        <title>Quản trị AI - EduBank</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Hiển thị thanh điều hướng phía trên */}
      <Header title="Quản trị AI - EduBank" />

      {/* Phần nội dung chính (thay đổi linh hoạt giữa 2 Tab) */}
      <main className="flex-1 flex flex-col">
        {activeTab === "generate" && (
          <AIGenerator 
            setActiveTab={setActiveTab}
            // AIGenerator cần có prop onDataGenerated để truyền mảng câu hỏi lên đây
            onDataGenerated={setGeneratedData} 
          />
        )}

        {activeTab === "review_questions" && (
          <QuestionReview 
            questions={generatedData} 
            isSaving={isSaving}
            onSave={handleSaveToBank}
          />
        )}
      </main>
    </div>
  );
}
import type { ConfiguredQuestion } from "@/services/ai/generator";
import { useState } from "react";
import AIGenerator from "./AIGenerator"; 
import QuestionReview from "./QuestionReview";

export default function ExamDashboard() {
  const [activeTab, setActiveTab] = useState("generate");
  const [generatedData, setGeneratedData] = useState<ConfiguredQuestion[]>([]); // State chứa dữ liệu sinh ra

  return (
    <div className="min-h-screen bg-slate-50">
      
      {activeTab === "generate" && (
        <AIGenerator 
          setActiveTab={(tab) => setActiveTab(tab)}
          // Khi sinh thành công, nhận dữ liệu giả lập và lưu vào state
          onDataGenerated={(data) => setGeneratedData(data)} 
        />
      )}

      {activeTab === "review_questions" && (
        <QuestionReview 
          questions={generatedData} 
          onSave={() => alert("Đã lưu vào ngân hàng thành công!")}
        />
      )}
      
    </div>
  );
}
 import React, { useState } from 'react';
import CreateQS from './createQS'; 
import AIGeneratorPage from './AIGenerator';
import QuestionReviewPage from './QuestionReview'; // Import giao diện duyệt câu hỏi

export default function TeacherDashboard() {
  // Trạng thái tab đang active
  const [activeTab, setActiveTab] = useState('ai_creator'); 
  
  // Hàm hiển thị nội dung dựa trên tab
  const renderMainContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <PlaceholderContent title="Bảng điều khiển" icon="fa-border-all" />;
      
      // Truyền hàm setActiveTab xuống AIGeneratorPage
      case 'ai_creator':
        return <AIGeneratorPage setActiveTab={setActiveTab} />;
      
      // Tab mới để hiển thị danh sách câu hỏi AI vừa tạo
      case 'review_questions':
        return <QuestionReviewPage />;
        
      case 'question_bank':
        return <PlaceholderContent title="Ngân hàng câu hỏi" icon="fa-server" />;
      case 'exam_manager':
        return <PlaceholderContent title="Quản lý đề thi" icon="fa-file-lines" />;
      case 'create_question':
        return <CreateQS />;
      default:
        return <PlaceholderContent title="Bảng điều khiển" icon="fa-border-all" />;
    }
  };

  return (
    <div className="flex h-screen bg-[#fafafa] font-sans text-slate-800 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-60 bg-[#f8f9fc] border-r border-slate-200 flex flex-col justify-between relative z-20 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
        <div>
          <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3">
            <div className="bg-[#2c4391] text-white p-1.5 rounded flex items-center justify-center w-8 h-8">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-[#1e3050]">EduBank AI</h1>
              <p className="text-[10px] text-slate-500">Silk | Tin học 6</p>
            </div>
          </div>

          <nav className="space-y-1 text-sm mt-4 px-3 flex flex-col">
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-left transition-colors ${activeTab === 'dashboard' ? 'bg-[#eef2fa] text-[#2c4391] font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
              <i className="fa-solid fa-border-all w-5 text-center"></i> Bảng điều khiển
            </button>
            <button onClick={() => setActiveTab('ai_creator')} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-left transition-colors ${activeTab === 'ai_creator' ? 'bg-[#eef2fa] text-[#2c4391] font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
              <i className="fa-solid fa-robot w-5 text-center"></i> Trình tạo AI
            </button>
            <button onClick={() => setActiveTab('question_bank')} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-left transition-colors ${activeTab === 'question_bank' ? 'bg-[#eef2fa] text-[#2c4391] font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
              <i className="fa-solid fa-server w-5 text-center"></i> Ngân hàng câu hỏi
            </button>
            <button onClick={() => setActiveTab('exam_manager')} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-left transition-colors ${activeTab === 'exam_manager' ? 'bg-[#eef2fa] text-[#2c4391] font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
              <i className="fa-regular fa-circle-question w-5 text-center"></i> Quản lý đề thi
            </button>
            {/* Đã xóa nút Tạo câu hỏi ở đây theo ý bạn */}
          </nav>
        </div>

        <div className="px-5 py-4 space-y-4">
          <button className="w-full bg-[#283870] hover:bg-[#1e2a55] text-white font-bold py-2.5 rounded-md transition-colors text-sm shadow-sm" type="button">Tạo đề thi</button>
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <button className="flex items-center gap-3 text-slate-500 hover:text-slate-800 w-full text-left text-sm px-2 py-1"><i className="fa-solid fa-gear w-4 text-center"></i> Cài đặt</button>
            <button className="flex items-center gap-3 text-slate-500 hover:text-slate-800 w-full text-left text-sm px-2 py-1"><i className="fa-regular fa-circle-question w-4 text-center"></i> Hỗ trợ</button>
          </div>
        </div>
      </aside>

      {/* Render nội dung động */}
      {renderMainContent()}
    </div>
  );
}

// Component cho tab chưa làm
function PlaceholderContent({ title, icon }: { title: string, icon: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8">
      <i className={`fa-solid ${icon} text-6xl mb-4 text-slate-300`}></i>
      <h2 className="text-2xl font-bold text-slate-600 mb-2">Giao diện {title}</h2>
      <p className="text-sm">Đang chờ cập nhật dữ liệu.</p>
    </div>
  );
}
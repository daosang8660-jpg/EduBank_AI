import React from 'react';

// Định nghĩa cấu trúc của một câu hỏi
interface Question {
  id: string | number;
  type: string;
  level: string;
  topic: string;
  content: string;
  options?: string[];
  correctAnswer: string;
}

interface Props {
  questions?: Question[];
  onSave: () => void;
  isSaving?: boolean; // Thêm prop để nhận trạng thái đang lưu từ component cha
}

export default function QuestionReview({ 
  questions = [], 
  onSave,
  isSaving = false
}: Props) {
  
  const totalQuestions = questions.length;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      
      {/* Khối Header đếm số lượng */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Kiểm duyệt câu hỏi AI</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Chỉnh sửa trước khi đưa vào ngân hàng câu hỏi để soạn đề cương ôn tập.
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-blue-600">{totalQuestions}</div>
          <div className="text-sm text-slate-500 font-medium">Câu hỏi</div>
        </div>
      </div>

      {/* Khối Hành động (Sẵn sàng lưu) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Sẵn sàng lưu</h2>
          <p className="text-slate-500 text-sm mt-0.5">{totalQuestions} câu hỏi</p>
        </div>
        <button 
          onClick={onSave}
          disabled={totalQuestions === 0 || isSaving}
          className="bg-[#3b5998] hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center space-x-2 w-48"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Đang lưu...</span>
            </>
          ) : (
            <span>Lưu vào ngân hàng</span>
          )}
        </button>
      </div>

      {/* Danh sách Câu hỏi */}
      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:border-blue-300 transition-colors">
            
            {/* Tag thông tin */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded">
                  Câu {index + 1}
                </span>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                  {q.level}
                </span>
                <span className="text-xs text-slate-500">
                  {q.topic}
                </span>
              </div>
              
              {/* Nút thao tác (Sửa/Xóa) */}
              <div className="flex space-x-2">
                <button className="text-slate-400 hover:text-blue-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Nội dung câu hỏi */}
            <p className="text-[15px] font-medium text-slate-800 mb-4 whitespace-pre-wrap">
              {q.content}
            </p>

            {/* Các đáp án lựa chọn (nếu có) */}
            {q.options && q.options.length > 0 && (
              <div className="space-y-2 mb-4 pl-2">
                {(q.options ?? []).map((opt, i) => (
                  <div key={i} className="text-[15px] text-slate-700">
                    {opt}
                  </div>
                ))}
              </div>
            )}

            {/* Trình bày đáp án trực tiếp */}
            <div className="pt-3 border-t border-slate-100 flex items-start space-x-2">
              <span className="text-[15px] font-bold text-emerald-600">Đáp án:</span>
              <span className="text-[15px] font-semibold text-slate-800">{q.correctAnswer}</span>
            </div>

          </div>
        ))}

        {/* Trạng thái trống khi chưa có câu hỏi */}
        {questions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            Chưa có câu hỏi nào được sinh.
          </div>
        )}
      </div>

    </div>
  );
}
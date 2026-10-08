import React, { useState } from "react";

type QuestionType = "trac-nghiem" | "dung-sai" | "tra-loi-ngan" | "tu-luan";
type Level = "nhan-biet" | "thong-hieu" | "van-dung" | "van-dung-cao";

interface Option {
  id: string;
  text: string;
}

export default function CreateQuestionPage() {
  const [questionType, setQuestionType] = useState<QuestionType>("trac-nghiem");
  const [level, setLevel] = useState<Level>("nhan-biet");
  const [content, setContent] = useState("");
  const [options, setOptions] = useState<Option[]>([
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ]);
  const [correctOption, setCorrectOption] = useState<string | null>(null);
  const [chapter, setChapter] = useState("Chủ đề 1: Máy tính và cộng đồng");

  const updateOption = (id: string, text: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const addOption = () => {
    const nextLetter = String.fromCharCode(65 + options.length);
    setOptions((prev) => [...prev, { id: nextLetter, text: "" }]);
  };

  const questionTypeTabs: { key: QuestionType; label: string }[] = [
    { key: "trac-nghiem", label: "Trắc nghiệm" },
    { key: "dung-sai", label: "Đúng/Sai" },
    { key: "tra-loi-ngan", label: "Trả lời ngắn" },
    { key: "tu-luan", label: "Tự luận" },
  ];

  const levelOptions: { key: Level; label: string }[] = [
    { key: "nhan-biet", label: "Nhận biết" },
    { key: "thong-hieu", label: "Thông hiểu" },
    { key: "van-dung", label: "Vận dụng" },
    { key: "van-dung-cao", label: "Vận dụng cao" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa] font-sans text-slate-800">
      
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 px-6 bg-white shrink-0 h-14 z-10">
        <div className="flex items-center gap-6 h-full">
          <span className="font-bold text-slate-800 text-sm">Quản lý Ngân hàng câu hỏi</span>
          <div className="flex gap-4 text-sm font-medium border-l border-slate-300 pl-6 h-full items-center">
            <span className="text-[#2c4391] border-b-2 border-[#2c4391] h-full flex items-center pt-[2px] cursor-pointer">Tin học 6</span>
            <span className="text-slate-500 cursor-pointer hover:text-slate-700">Kho liệu</span>
            <span className="text-slate-500 cursor-pointer hover:text-slate-700">Lịch sử</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex items-center">
            <SearchIcon />
            <input placeholder="Tìm kiếm câu hỏi..." className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none w-56" />
          </div>
          <IconButton name="globe" />
          <IconButton name="bell" />
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 leading-none">Silk</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Giáo viên</span>
            </div>
            <div className="text-slate-600">
              <UserIcon />
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        
        {/* Title Row */}
        <div className="flex justify-between items-center py-5 px-6 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Tạo câu hỏi mới</h2>
            <p className="text-xs text-slate-500 mt-1">Xây dựng ngân hàng câu hỏi chất lượng cao cho lớp Tin học 6.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-white border border-slate-300 rounded text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700" type="button">
              Hủy bỏ
            </button>
            <button className="px-4 py-2 bg-[#e8edfc] text-[#2c4391] rounded text-sm font-bold flex items-center gap-2 hover:bg-[#dce4fa] transition-colors" type="button">
              <SparkleIcon /> AI Phân tích
            </button>
            <button className="px-4 py-2 bg-[#283870] text-white rounded text-sm font-bold hover:bg-[#1e2a55] transition-colors" type="button">
              Lưu vào ngân hàng
            </button>
          </div>
        </div>

        {/* Grid Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
          
          {/* Left Column (Editor & Options) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Question Editor */}
            <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-sm text-slate-800">Nội dung câu hỏi</span>
                <div className="flex gap-3 text-slate-500">
                  <IconButton name="image" />
                  <IconButton name="sigma" />
                </div>
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                  <button type="button" className="font-bold hover:text-slate-900 w-6 h-6 flex items-center justify-center">B</button>
                  <button type="button" className="italic hover:text-slate-900 font-serif w-6 h-6 flex items-center justify-center">I</button>
                  <button type="button" className="underline hover:text-slate-900 w-6 h-6 flex items-center justify-center">U</button>
                  <span className="w-px h-4 bg-slate-300 mx-1" />
                  <button type="button" className="hover:text-slate-900"><BulletListIcon /></button>
                  <button type="button" className="hover:text-slate-900"><NumberListIcon /></button>
                </div>
                <textarea
                  className="w-full h-40 p-4 focus:outline-none resize-none text-sm placeholder:text-slate-400"
                  placeholder="Nhập nội dung câu hỏi tại đây..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </section>

            {/* Answer Configuration */}
            <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-sm text-slate-800">Cấu hình đáp án</span>
                <div className="flex bg-slate-50 border border-slate-200 rounded p-1 text-xs font-semibold">
                  {questionTypeTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`px-4 py-1.5 rounded transition-colors ${
                        questionType === tab.key ? "bg-[#e8edfc] text-[#2c4391] shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                      onClick={() => setQuestionType(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {questionType === "trac-nghiem" && (
                <div className="space-y-4">
                  {options.map((opt) => (
                    <div className="flex items-center gap-3" key={opt.id}>
                      <input
                        type="radio"
                        name="correct_answer"
                        className="w-5 h-5 border-slate-300 text-[#283870] focus:ring-[#283870] cursor-pointer"
                        checked={correctOption === opt.id}
                        onChange={() => setCorrectOption(opt.id)}
                      />
                      <input
                        className="flex-1 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-[#283870] placeholder:text-slate-400"
                        placeholder={`Nhập phương án ${opt.id}`}
                        value={opt.text}
                        onChange={(e) => updateOption(opt.id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        onClick={() => removeOption(opt.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  <button className="w-full mt-6 py-3 border-2 border-dashed border-slate-300 rounded-md text-slate-600 font-semibold text-sm hover:border-slate-400 hover:bg-slate-50 transition-colors flex justify-center items-center gap-2" type="button" onClick={addOption}>
                    <PlusIcon /> Thêm phương án
                  </button>
                </div>
              )}

              {questionType !== "trac-nghiem" && (
                <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded">
                  Giao diện cho dạng &quot;{questionTypeTabs.find((t) => t.key === questionType)?.label}&quot; sẽ hiển thị ở đây.
                </div>
              )}
            </section>
          </div>

          {/* Right Column (Info, AI, Upload) */}
          <aside className="space-y-6">
            
            {/* General Info */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-5">Thông tin chung</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">MÔN HỌC</label>
                  <div className="relative">
                    <span className="block w-full bg-[#f4f7fe] border border-[#e4e9f7] rounded text-sm text-[#283870] font-semibold px-3 py-2 cursor-not-allowed">Tin học 6</span>
                    <div className="absolute right-3 top-2.5 text-[#283870] opacity-60"><LockIcon /></div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">KHỐI LỚP</label>
                  <div className="relative">
                    <span className="block w-full bg-[#f4f7fe] border border-[#e4e9f7] rounded text-sm text-[#283870] font-semibold px-3 py-2 cursor-not-allowed">Lớp 6</span>
                    <div className="absolute right-3 top-2.5 text-[#283870] opacity-60"><LockIcon /></div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">CHƯƠNG / CHỦ ĐỀ</label>
                  <select 
                    className="w-full bg-white border border-slate-200 rounded text-sm text-slate-700 px-3 py-2 appearance-none focus:outline-none focus:border-slate-400"
                    value={chapter} 
                    onChange={(e) => setChapter(e.target.value)}
                  >
                    <option>Chủ đề 1: Máy tính và cộng đồng</option>
                    <option>Chủ đề 2: Mạng máy tính và Internet</option>
                    <option>Chủ đề 3: Tổ chức lưu trữ, tìm kiếm...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase">MỨC ĐỘ TƯ DUY</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {levelOptions.map((lv) => (
                      <button
                        key={lv.key}
                        type="button"
                        className={`py-2 font-medium rounded border transition-colors ${
                          level === lv.key ? "bg-[#3b4b86] text-white border-[#3b4b86]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => setLevel(lv.key)}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="bg-[#283870] rounded-lg p-5 text-white shadow-md relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <SparkleIcon />
                </div>
                <h3 className="font-bold text-sm">Trợ lý AI</h3>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed mb-6 relative z-10">
                Nhấn &quot;AI Phân tích&quot; để kiểm tra tính logic, ngôn ngữ và độ phù hợp của câu hỏi với khung chương trình 2018.
              </p>
              <div className="bg-white/10 rounded border border-white/20 p-3 relative z-10">
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Chất lượng câu hỏi dự kiến</span>
                  <span>-- %</span>
                </div>
                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-white w-1/4 h-full rounded-full opacity-50" />
                </div>
              </div>
            </div>

            {/* Upload Box */}
<label className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer transition-colors bg-white relative">
  
  {/* Thẻ input ẩn để gọi hộp thoại chọn file */}
  <input 
    type="file" 
    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
    accept=".docx, .pdf, .xlsx, .xls"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) {
        // Nơi này dùng để gọi API upload hoặc lưu file vào state
        alert(`Bạn đã chọn file: ${file.name}`);
      }
    }}
  />

  <div className="text-slate-400 mb-2"><UploadIcon /></div>
  <h4 className="font-bold text-sm text-slate-700">Tải file câu hỏi</h4>
  <p className="text-[10px] text-slate-400 mt-1">Hỗ trợ .docx, .pdf hoặc Excel theo mẫu</p>
</label>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Danh sách các file SVG Icon nội bộ
   ========================================================================= */

function IconButton({ name }: { name: string }) {
  return (
    <button className="text-slate-400 hover:text-slate-700 transition-colors" type="button">
      {name === "globe" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>}
      {name === "bell" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>}
      {name === "image" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>}
      {name === "sigma" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 7V4H6l6 8-6 8h12v-3" /></svg>}
    </button>
  );
}

function SearchIcon() { return <svg className="absolute left-3 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>; }
function SparkleIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2z" /></svg>; }
function UserIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="5" /><path d="M3 21v-2a7 7 0 0 1 14 0v2" /></svg>; }
function BulletListIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>; }
function NumberListIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none">3</text></svg>; }
function TrashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" /></svg>; }
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function LockIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }
function UploadIcon() { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6M9 15l3-3 3 3" /></svg>; }
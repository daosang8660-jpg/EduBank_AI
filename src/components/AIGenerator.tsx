 import { useState } from "react";

type QuestionTypesState = {
  multipleChoice: boolean;
  trueFalse: boolean;
  shortAnswer: boolean;
  essay: boolean;
};

export default function AIGeneratorPage({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeSubTab, setActiveSubTab] = useState("ai_generator");
  const [totalQuestions, setTotalQuestions] = useState(15);
  const [levels, setLevels] = useState({ nb: 40, th: 40, vd: 20 });
  const [questionTypes, setQuestionTypes] = useState<QuestionTypesState>({
    multipleChoice: true,
    trueFalse: true,
    shortAnswer: false,
    essay: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        window.alert("Chỉ hỗ trợ file PDF.");
        return;
      }
      setUploadedFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile) {
      window.alert("Vui lòng tải lên file PDF trước khi sinh câu hỏi.");
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("totalQuestions", String(totalQuestions));
      formData.append("levels", JSON.stringify(levels));
      formData.append("questionTypes", JSON.stringify(questionTypes));

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      setProgress(60);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Không thể sinh câu hỏi.");
      }

      const data = await response.json();
      const questions = data.questions ?? [];

      window.sessionStorage.setItem("generatedQuestions", JSON.stringify(questions));
      setProgress(100);

      setActiveTab("review_questions");
    } catch (error) {
      console.error(error);
      window.alert(
        error instanceof Error ? error.message : "Không thể sinh câu hỏi, vui lòng thử lại."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f9fafb] font-sans text-slate-800">
      <header className="flex items-center justify-between border-b border-slate-200 px-8 bg-white h-[60px] shrink-0">
        <div className="flex items-center gap-6 h-full">
          <span className="font-bold text-slate-800 text-[15px]">Question Bank Manager</span>
          <div className="flex gap-5 text-sm font-medium border-l border-slate-200 pl-6 h-full items-center text-slate-500">
            <span className="text-slate-800 cursor-pointer font-semibold">Tin học 6</span>
            <span className="cursor-pointer hover:text-slate-700">Mathematics</span>
            <span className="cursor-pointer hover:text-slate-700">Science</span>
            <span className="cursor-pointer hover:text-slate-700">History</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative flex items-center">
            <SearchIcon />
            <input
              placeholder="Search questions..."
              className="pl-9 pr-4 py-1.5 bg-[#f1f5f9] border border-transparent rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#0a58ca] w-64 transition-all"
            />
          </div>
          <IconButton name="bell" />
          <UserIcon />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-[#1e293b]">Tạo câu hỏi mới</h2>
            <p className="text-sm text-slate-500 mt-2">
              Tải lên tài liệu và cấu hình ma trận để AI tự động sinh câu hỏi.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <div className="bg-white border border-slate-200 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="flex border-b border-slate-200 bg-white">
                  <button
                    onClick={() => setActiveSubTab("ai_generator")}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                      activeSubTab === "ai_generator"
                        ? "border-b-2 border-[#0a58ca] text-[#0a58ca]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    AI Generator
                  </button>
                  <button
                    onClick={() => setActiveSubTab("upload_existing")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      activeSubTab === "upload_existing"
                        ? "border-b-2 border-[#0a58ca] text-[#0a58ca]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Tải lên câu hỏi có sẵn
                  </button>
                </div>

                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-base">Nguồn dữ liệu câu hỏi</h3>
                  <DocumentIcon />
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <button className="border border-slate-200 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm text-slate-600 hover:bg-slate-50 font-medium">
                      <FileWordIcon /> Tải file .docx
                    </button>
                    <button className="border border-slate-200 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm text-slate-600 hover:bg-slate-50 font-medium">
                      <FileExcelIcon /> Tải file .xlsx
                    </button>
                  </div>

                  {!uploadedFile ? (
                    <label className="border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#f1f5f9] transition-all mb-4 group">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleFileChange}
                      />
                      <div className="w-12 h-12 bg-[#e0e7ff] text-[#0a58ca] rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadFileIcon />
                      </div>
                      <h4 className="font-bold text-sm text-slate-700 mb-1">
                        Kéo thả file Sách giáo khoa vào đây
                      </h4>
                      <p className="text-xs text-slate-500">
                        hoặc click để chọn file từ máy tính. Hỗ trợ định dạng .pdf, tối đa 50MB.
                      </p>
                    </label>
                  ) : (
                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide">
                        Đã tải lên
                      </div>
                      <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                          <PdfIcon />
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800 truncate max-w-[180px]">
                              {uploadedFile.name}
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • Tải lên hoàn tất
                            </p>
                          </div>
                        </div>
                        <button
                          className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                          onClick={() => setUploadedFile(null)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveTab("create_question")}
                    className="w-full border border-[#0a58ca] text-[#0a58ca] font-semibold py-2.5 rounded-lg flex justify-center items-center gap-2 text-sm hover:bg-[#eff6ff] transition-colors"
                  >
                    <EditIcon /> Nhập câu hỏi thủ công
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc]">
                  <div>
                    <h3 className="font-bold text-[#1e293b] text-base">
                      Cấu hình số lượng & Mức độ
                    </h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      Thiết lập số lượng câu hỏi theo từng mức độ nhận thức.
                    </p>
                  </div>
                  <TableIcon />
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Loại câu hỏi muốn sinh:
                    </label>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-[#0a58ca] border-slate-300 focus:ring-[#0a58ca]"
                          checked={questionTypes.multipleChoice}
                          onChange={(e) =>
                            setQuestionTypes((prev) => ({
                              ...prev,
                              multipleChoice: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-slate-700">Trắc nghiệm nhiều lựa chọn</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-[#0a58ca] border-slate-300 focus:ring-[#0a58ca]"
                          checked={questionTypes.trueFalse}
                          onChange={(e) =>
                            setQuestionTypes((prev) => ({
                              ...prev,
                              trueFalse: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-slate-700">Trắc nghiệm đúng sai</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-[#0a58ca] border-slate-300 focus:ring-[#0a58ca]"
                          checked={questionTypes.shortAnswer}
                          onChange={(e) =>
                            setQuestionTypes((prev) => ({
                              ...prev,
                              shortAnswer: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-slate-700">Trắc nghiệm trả lời ngắn</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-[#0a58ca] border-slate-300 focus:ring-[#0a58ca]"
                          checked={questionTypes.essay}
                          onChange={(e) =>
                            setQuestionTypes((prev) => ({
                              ...prev,
                              essay: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-slate-700">Câu hỏi tự luận</span>
                      </label>
                    </div>
                  </div>

                  <hr className="border-slate-100 mb-6" />

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tổng số câu hỏi muốn sinh
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={totalQuestions}
                        onChange={(e) => setTotalQuestions(Number(e.target.value))}
                        className="w-full bg-[#f4f7fe] border border-[#e2e8f0] rounded-lg px-4 py-3 text-[#1e293b] font-medium focus:outline-none focus:ring-1 focus:ring-[#0a58ca]"
                      />
                      <span className="absolute right-4 top-3.5 text-sm text-slate-500">
                        câu hỏi
                      </span>
                    </div>
                  </div>

                  <div className="mb-8">
                    <label className="block text-[11px] font-bold text-slate-400 mb-4 uppercase tracking-wider">
                      Mức độ câu hỏi (%)
                    </label>
                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-slate-700">Nhận biết</span>
                          <span className="font-bold text-[#0a58ca]">{levels.nb}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={levels.nb}
                          onChange={(e) =>
                            setLevels((prev) => ({
                              ...prev,
                              nb: Number(e.target.value),
                            }))
                          }
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0a58ca]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-slate-700">Thông hiểu</span>
                          <span className="font-bold text-[#0a58ca]">{levels.th}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={levels.th}
                          onChange={(e) =>
                            setLevels((prev) => ({
                              ...prev,
                              th: Number(e.target.value),
                            }))
                          }
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0a58ca]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-slate-700">Vận dụng</span>
                          <span className="font-bold text-[#0a58ca]">{levels.vd}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={levels.vd}
                          onChange={(e) =>
                            setLevels((prev) => ({
                              ...prev,
                              vd: Number(e.target.value),
                            }))
                          }
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0a58ca]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-slate-200 rounded-xl shadow-sm p-6 relative overflow-hidden">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`w-full font-bold py-3.5 rounded-lg transition-all text-[15px] shadow-sm flex justify-center items-center gap-2 mb-5 relative z-10 ${
                    isGenerating
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-[#0a58ca] hover:bg-[#1e40af] text-white"
                  }`}
                  type="button"
                >
                  {isGenerating ? <SpinIcon /> : <SparkleIconWhite />}
                  Bắt đầu sinh câu hỏi bằng AI
                </button>

                {isGenerating && (
                  <div className="mb-5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#0a58ca] tracking-wider mb-2">
                      <span className="flex items-center gap-1.5">
                        <SpinIcon /> AI ĐANG PHÂN TÍCH TÀI LIỆU & XÂY DỰNG NGỮ CẢNH...
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0a58ca] h-full rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 text-xs text-slate-500 font-semibold uppercase tracking-wide mb-4">
                  <i className="fa-regular fa-calendar-check mt-0.5"></i>
                  <span>
                    BƯỚC TIẾP THEO: KIỂM DUYỆT TẠI MÀN HÌNH 'REVIEW' TRƯỚC KHI LƯU
                  </span>
                </div>

                <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4 flex gap-3 text-sm text-[#1e40af]">
                  <i className="fa-solid fa-circle-info mt-0.5 text-[#3b82f6]"></i>
                  <p>
                    Sau khi sinh, hệ thống sẽ chuyển bạn đến màn hình <b>Review</b>. Bạn cần kiểm
                    duyệt nội dung tại đó trước khi nhấn <b>'Lưu vào ngân hàng'</b> để hoàn tất.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3 text-slate-400"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconButton({ name }: { name: string }) {
  return (
    <button className="text-slate-400 hover:text-slate-700" type="button">
      {name === "bell" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      )}
    </button>
  );
}

function UserIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-slate-500"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M3 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-slate-400"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-slate-400"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function UploadFileIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
      <path d="M12 11v6" />
      <path d="M9.5 13.5L12 11l2.5 2.5" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
        fill="#FEE2E2"
        stroke="#EF4444"
        strokeWidth="1.5"
      />
      <text x="6" y="16" fill="#EF4444" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
        PDF
      </text>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
    </svg>
  );
}

function SparkleIconWhite() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2z" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.25-5.25" />
    </svg>
  );
}

function FileWordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 12l1.5 6 1.5-6" />
      <path d="M15 12l-1.5 6-1.5-6" />
    </svg>
  );
}

function FileExcelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 12l6 6" />
      <path d="M15 12l-6 6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
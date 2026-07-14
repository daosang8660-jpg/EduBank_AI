import { useEffect, useState } from "react";

type Question = {
  id: number;
  type: string;
  difficulty?: string;
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
};

const difficultyLabel = (d?: string) => {
  switch (d) {
    case "easy":
      return "Nhận biết";
    case "medium":
      return "Thông hiểu";
    case "hard":
      return "Vận dụng";
    default:
      return d || "Chưa xác định";
  }
};

const difficultyColor = (d?: string) => {
  switch (d) {
    case "easy":
      return "bg-green-50 text-green-700 border-green-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "hard":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

export default function QuestionReview() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const raw = window.sessionStorage.getItem("generatedQuestions");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setQuestions(Array.isArray(parsed) ? parsed : []);
      } catch {
        setQuestions([]);
      }
    }
  }, []);

  const updateQuestion = (id: number, patch: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const updateOption = (id: number, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const options = [...(q.options || [])];
        options[index] = value;
        return { ...q, options };
      })
    );
  };

  const removeQuestion = (id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const markSaved = (id: number) => {
    setSavedIds((prev) => new Set(prev).add(id));
    setEditingId(null);
  };

  const saveAllToBank = () => {
    // TODO: gọi API lưu vào ngân hàng câu hỏi thật (ví dụ POST /api/questions)
    window.sessionStorage.removeItem("generatedQuestions");
    window.alert(`Đã lưu ${questions.length} câu hỏi vào ngân hàng.`);
  };

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f9fafb] text-slate-400 p-8">
        <i className="fa-regular fa-file-lines text-6xl mb-4 text-slate-300"></i>
        <h2 className="text-xl font-bold text-slate-600 mb-2">Chưa có câu hỏi nào để duyệt</h2>
        <p className="text-sm text-center max-w-sm">
          Vào tab "Trình tạo AI" để tải lên file PDF và sinh câu hỏi trước, sau đó quay lại đây để kiểm duyệt.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f9fafb] font-sans text-slate-800">
      <header className="flex items-center justify-between border-b border-slate-200 px-8 bg-white h-[60px] shrink-0">
        <div>
          <h2 className="font-bold text-slate-800 text-[15px]">Duyệt câu hỏi</h2>
          <p className="text-[11px] text-slate-500">
            {questions.length} câu hỏi được AI sinh ra • kiểm tra trước khi lưu vào ngân hàng
          </p>
        </div>
        <button
          onClick={saveAllToBank}
          className="bg-[#283870] hover:bg-[#1e2a55] text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
          type="button"
        >
          Lưu tất cả vào ngân hàng
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {questions.map((q, idx) => {
            const isEditing = editingId === q.id;
            const isSaved = savedIds.has(q.id);

            return (
              <div
                key={q.id}
                className={`bg-white border rounded-xl shadow-sm p-5 transition-colors ${
                  isSaved ? "border-green-300" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400">Câu {idx + 1}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${difficultyColor(
                        q.difficulty
                      )}`}
                    >
                      {difficultyLabel(q.difficulty)}
                    </span>
                    {isSaved && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                        Đã duyệt
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditing ? (
                      <button
                        onClick={() => setEditingId(q.id)}
                        className="text-xs font-semibold text-[#0a58ca] hover:underline"
                        type="button"
                      >
                        Sửa
                      </button>
                    ) : (
                      <button
                        onClick={() => markSaved(q.id)}
                        className="text-xs font-semibold text-green-600 hover:underline"
                        type="button"
                      >
                        Xong
                      </button>
                    )}
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="text-xs font-semibold text-red-500 hover:underline"
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    className="w-full border border-slate-200 rounded-md p-3 text-sm mb-3 focus:outline-none focus:border-[#0a58ca]"
                    rows={2}
                    value={q.question || ""}
                    onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-800 mb-3">{q.question}</p>
                )}

                {Array.isArray(q.options) && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {q.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = q.answer === letter || q.answer === opt;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 border rounded-md px-3 py-2 text-sm ${
                            isCorrect
                              ? "border-green-300 bg-green-50 text-green-800"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          <span className="font-bold">{letter}.</span>
                          {isEditing ? (
                            <input
                              className="flex-1 bg-transparent focus:outline-none"
                              value={opt}
                              onChange={(e) => updateOption(q.id, i, e.target.value)}
                            />
                          ) : (
                            <span>{opt}</span>
                          )}
                          {isCorrect && <i className="fa-solid fa-check ml-auto text-green-600"></i>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.explanation && (
                  <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
                    <span className="font-semibold text-slate-600">Giải thích: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
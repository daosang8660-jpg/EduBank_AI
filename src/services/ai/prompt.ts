export interface QuestionPromptSelection {
  subject: string;
  grade: string | number;
  book: string;
  chapter: string;
  lesson: string;
}

export interface QuestionPromptConfig {
  total: number;
  matrix: { nb: number; th: number; vd: number; vdc: number };
}

export const buildQuestionPrompt = (
  selection: QuestionPromptSelection,
  config: QuestionPromptConfig,
  contextText: string
): string => {
  return `
Nhiệm vụ: Soạn đề cương ôn tập cho học sinh.
Môn học: ${selection.subject} lớp ${selection.grade}, sách ${selection.book}.
Phạm vi kiến thức: ${selection.chapter} - ${selection.lesson}.

Dựa vào nội dung học liệu chuẩn sau đây:
"""
${contextText}
"""

Hãy sinh ra đúng ${config.total} câu hỏi bám sát ma trận:
- Nhận biết: ${config.matrix.nb} câu
- Thông hiểu: ${config.matrix.th} câu
- Vận dụng: ${config.matrix.vd} câu
- Vận dụng cao: ${config.matrix.vdc} câu

YÊU CẦU BẮT BUỘC: 
1. Trả về DUY NHẤT một mảng JSON hợp lệ. 
2. Chỉ đưa ra đáp án và câu hỏi, tuyệt đối KHÔNG giải thích, KHÔNG bình luận thêm.
3. Cấu trúc mỗi object trong mảng phải chính xác như sau:
[
  {
    "id": 1,
    "type": "multipleChoice", // hoặc "shortAnswer", "trueFalse"
    "level": "Nhận biết",
    "topic": "Tên chủ đề hoặc tên văn bản/bài học",
    "content": "Nội dung câu hỏi?",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."], // Bỏ trống mảng này nếu không phải trắc nghiệm
    "correctAnswer": "A" // Trả về đáp án đúng cực kỳ ngắn gọn
  }
]
`;
};
import { DocumentAnalysis } from "../document/analyzeDocument";

export interface GenerateQuestionOptions {
  totalQuestions: number;

  levels: {
    nb: number;
    th: number;
    vd: number;
  };

  questionTypes: {
    multipleChoice: boolean;
    trueFalse: boolean;
    shortAnswer: boolean;
    essay: boolean;
  };
}

export function buildPrompt(
  document: DocumentAnalysis,
  options: GenerateQuestionOptions
) {
  const selectedTypes = Object.entries(options.questionTypes)
    .filter(([, value]) => value)
    .map(([key]) => {
      switch (key) {
        case "multipleChoice":
          return "Trắc nghiệm nhiều lựa chọn";

        case "trueFalse":
          return "Đúng/Sai";

        case "shortAnswer":
          return "Trả lời ngắn";

        case "essay":
          return "Tự luận";

        default:
          return "";
      }
    })
    .join(", ");

  return `
Bạn là chuyên gia biên soạn ngân hàng câu hỏi theo Chương trình GDPT 2018.

========================

CHỈ sử dụng nội dung trong tài liệu dưới đây.

KHÔNG tự suy diễn.

KHÔNG bổ sung kiến thức ngoài tài liệu.

========================

Nội dung tài liệu

${document.content}

========================

Yêu cầu

- Sinh ${options.totalQuestions} câu hỏi.

- Tỷ lệ mức độ

+ Nhận biết ${options.levels.nb}%

+ Thông hiểu ${options.levels.th}%

+ Vận dụng ${options.levels.vd}%

- Loại câu hỏi

${selectedTypes}

========================

Trả về DUY NHẤT JSON Array.

Ví dụ

[
{
"id":1,
"type":"multiple_choice",
"difficulty":"easy",
"question":"...",
"options":["A","B","C","D"],
"answer":"A",
"explanation":"..."
}
]

Không markdown.

Không giải thích.

Không thêm text ngoài JSON.
`;
}
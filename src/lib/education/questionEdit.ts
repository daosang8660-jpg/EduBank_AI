import type { UpdateQuestionBankInput } from "@/services/questionBankManageService";
function normalizeText(
  value: string
): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeStringArray(
  value: string[] | undefined
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      normalizeText(item)
    )
    .filter(Boolean);
}

/* =====================================================
   KIỂM TRA CÂU HỎI
===================================================== */

export function validateQuestion(
  input: UpdateQuestionBankInput
): void {
  if (!input.id.trim()) {
    throw new Error(
      "Thiếu mã câu hỏi."
    );
  }

  if (!input.question.trim()) {
    throw new Error(
      "Nội dung câu hỏi không được để trống."
    );
  }

  if (!input.correctAnswer.trim()) {
    throw new Error(
      "Đáp án không được để trống."
    );
  }

  if (
    input.type ===
    "multiple_choice"
  ) {
    if (
      !Array.isArray(input.options) ||
      input.options.length !== 4
    ) {
      throw new Error(
        "Câu trắc nghiệm phải có đúng 4 phương án."
      );
    }

    const options =
      input.options.map(
        (option) =>
          normalizeText(option)
      );

    if (
      options.some(
        (option) => !option
      )
    ) {
      throw new Error(
        "Các phương án không được để trống."
      );
    }

    const correctAnswer =
      normalizeText(
        input.correctAnswer
      );

    if (
      !options.includes(
        correctAnswer
      )
    ) {
      throw new Error(
        "Đáp án đúng phải khớp với một phương án."
      );
    }
  }

  if (
    input.type ===
    "true_false"
  ) {
    const answer =
      normalizeText(
        input.correctAnswer
      );

    if (
      answer !== "Đúng" &&
      answer !== "Sai"
    ) {
      throw new Error(
        "Câu Đúng/Sai phải có đáp án là Đúng hoặc Sai."
      );
    }
  }
}


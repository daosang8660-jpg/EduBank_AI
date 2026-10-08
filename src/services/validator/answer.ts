export interface QuestionValidationInput {
  id?: string | number | null;
  type?: string | null;
  difficulty?: string | null;
  question?: string | null;
  options?: string[] | null;
  answer?: string | null;
  explanation?: string | null;
}

export function validateQuestions(questions: readonly QuestionValidationInput[]) {
  return questions.map((q, index) => ({
    id: q.id ?? index + 1,

    type: q.type ?? "multiple_choice",

    difficulty: q.difficulty ?? "medium",

    question: q.question ?? "",

    options: Array.isArray(q.options) ? q.options : [],

    answer: q.answer ?? "",

    explanation: q.explanation ?? "",
  }));
}
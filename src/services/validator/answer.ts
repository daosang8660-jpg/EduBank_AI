export function validateQuestions(questions: any[]) {
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
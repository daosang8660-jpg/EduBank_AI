// ...existing code...
import React, { useEffect, useState, memo } from "react";

type Choice = {
  id: string;
  text: string;
  correct?: boolean;
};

type RegenerateResult = {
  question?: string;
  choices?: Choice[];
  explanation?: string;
};

type Props = {
  id?: string;
  question: string;
  choices: Choice[];
  selectedId?: string;
  onSelect?: (choiceId: string) => void;
  reveal?: boolean;
  explanation?: string;
  className?: string;
  disabled?: boolean;

  // editing / actions
  editable?: boolean;
  difficulty?: "easy" | "medium" | "hard" | string;
  type?: "mcq" | "truefalse" | "short" | string;
  onSave?: (payload: {
    id?: string;
    question: string;
    choices: Choice[];
    explanation?: string;
    difficulty?: string;
    type?: string;
  }) => void;
  onDelete?: (id?: string) => void;
  onRegenerate?: (id?: string) => Promise<RegenerateResult>;
};

function QuestionCardComponent({
  id,
  question: questionProp,
  choices: choicesProp,
  selectedId: selectedIdProp,
  onSelect,
  reveal = false,
  explanation: explanationProp,
  className,
  disabled = false,
  editable = false,
  difficulty: difficultyProp,
  type: typeProp,
  onSave,
  onDelete,
  onRegenerate,
}: Props) {
  // Part 1: component state + edit UI state
  const name = id ?? `question-${Math.random().toString(36).slice(2, 9)}`;

  const [selectedId, setSelectedId] = useState<string | undefined>(selectedIdProp);
  const [editing, setEditing] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>(questionProp);
  const [choices, setChoices] = useState<Choice[]>(choicesProp);
  const [explanation, setExplanation] = useState<string | undefined>(explanationProp);
  const [difficulty, setDifficulty] = useState<string | undefined>(difficultyProp);
  const [qtype, setQtype] = useState<string | undefined>(typeProp);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => setSelectedId(selectedIdProp), [selectedIdProp]);
  useEffect(() => setQuestion(questionProp), [questionProp]);
  useEffect(() => setChoices(choicesProp), [choicesProp]);
  useEffect(() => setExplanation(explanationProp), [explanationProp]);
  useEffect(() => setDifficulty(difficultyProp), [difficultyProp]);
  useEffect(() => setQtype(typeProp), [typeProp]);

  function handleSelect(choiceId: string) {
    if (disabled) return;
    setSelectedId(choiceId);
    onSelect?.(choiceId);
  }

  // Part 2: edit handlers (choices, explanation, difficulty, type)
  function handleChoiceTextChange(choiceId: string, text: string) {
    setChoices((prev) => prev.map((c) => (c.id === choiceId ? { ...c, text } : c)));
  }

  function handleToggleCorrect(choiceId: string) {
    setChoices((prev) => prev.map((c) => (c.id === choiceId ? { ...c, correct: !c.correct } : c)));
  }

  function handleAddChoice() {
    const newChoice: Choice = { id: Math.random().toString(36).slice(2, 9), text: "New answer" };
    setChoices((prev) => [...prev, newChoice]);
  }

  function handleRemoveChoice(choiceId: string) {
    setChoices((prev) => prev.filter((c) => c.id !== choiceId));
  }

  function handleSave() {
    onSave?.({ id, question, choices, explanation, difficulty, type: qtype });
    setEditing(false);
  }

  // Part 3: AI regenerate, copy, delete, handlers
  async function handleRegenerate() {
    setLoadingAI(true);
    try {
      if (onRegenerate) {
        const result = await onRegenerate(id);
        if (result?.question) setQuestion(result.question);
        if (Array.isArray(result?.choices)) setChoices(result.choices as Choice[]);
        if (result?.explanation) setExplanation(result.explanation);
      } else {
        // fallback to calling local API route
        const res = await fetch("/api/ai/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, question, choices, explanation, difficulty, type: qtype }),
        });
        if (res.ok) {
          const data: RegenerateResult = await res.json();
          if (data.question) setQuestion(data.question);
          if (Array.isArray(data.choices)) setChoices(data.choices as Choice[]);
          if (data.explanation) setExplanation(data.explanation);
        }
      }
    } catch (e) {
      // noop - keep existing content
    } finally {
      setLoadingAI(false);
    }
  }

  async function handleCopy() {
    const payload = { question, choices, explanation, difficulty, type: qtype };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  function handleDelete() {
    // safe delete confirmation
    if (!globalThis.confirm?.("Xác nhận xóa câu hỏi này?")) return;
    onDelete?.(id);
  }

  function handleCancelEdit() {
    setEditing(false);
    setQuestion(questionProp);
    setChoices(choicesProp);
    setExplanation(explanationProp);
    setDifficulty(difficultyProp);
    setQtype(typeProp);
  }

  return (
    <article className={["question-card", className].filter(Boolean).join(" ")} aria-labelledby={`${name}-label`}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <h3 id={`${name}-label`} className="question-card__title" style={{ margin: 0 }}>
            {!editable || !editing ? (
              question
            ) : (
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="question-card__input--edit"
                aria-label="Chỉnh sửa câu hỏi"
                style={{ width: "100%" }}
              />
            )}
          </h3>
          {(!editing && editable && difficulty) && (
            <div style={{ fontSize: 12, color: "#666" }}>Mức độ: {difficulty}</div>
          )}
        </div>

        {editable && (
          <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
            {!editing ? (
              <button onClick={() => setEditing(true)} aria-label="Chỉnh sửa">Chỉnh sửa</button>
            ) : (
              <>
                <button onClick={handleSave} aria-label="Lưu">Lưu</button>
                <button onClick={handleCancelEdit} aria-label="Hủy">Hủy</button>
              </>
            )}
            <button onClick={handleRegenerate} aria-label="Sinh lại câu">{loadingAI ? "Đang..." : "Sinh lại câu"}</button>
            <button onClick={handleCopy} aria-label="Sao chép">Sao chép</button>
            <button onClick={handleDelete} aria-label="Xóa">Xóa</button>
          </div>
        )}
      </header>

      <ul className="question-card__choices" role="list" style={{ paddingLeft: 0 }}>
        {choices.map((c) => {
          const isSelected = selectedId === c.id;
          const isCorrect = !!c.correct;
          const revealClass =
            reveal && isCorrect
              ? "question-card__choice--correct"
              : reveal && isSelected && !isCorrect
              ? "question-card__choice--incorrect"
              : "";

          return (
            <li key={c.id} className={`question-card__choice ${revealClass}`} style={{ listStyle: "none", marginBottom: 8 }}>
              <label className="question-card__label" aria-pressed={isSelected} data-selected={isSelected ? "true" : "false"} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(!editable || !editing) ? (
                  <>
                    <input type="radio" name={name} value={c.id} checked={isSelected} onChange={() => handleSelect(c.id)} disabled={disabled} className="question-card__input" />
                    <span className="question-card__text">{c.text}</span>
                    {reveal && isCorrect && <span aria-hidden className="question-card__badge question-card__badge--correct">✓</span>}
                    {reveal && isSelected && !isCorrect && <span aria-hidden className="question-card__badge question-card__badge--incorrect">✕</span>}
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                    <input type="text" value={c.text} onChange={(e) => handleChoiceTextChange(c.id, e.target.value)} style={{ flex: 1 }} />
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={!!c.correct} onChange={() => handleToggleCorrect(c.id)} /> Đúng
                    </label>
                    <button onClick={() => handleRemoveChoice(c.id)} aria-label="Xóa đáp án">Xóa</button>
                  </div>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {editable && editing && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAddChoice}>Thêm đáp án</button>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Lời giải</label>
            <textarea value={explanation ?? ""} onChange={(e) => setExplanation(e.target.value)} rows={3} style={{ width: "100%" }} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <label>
              Mức độ
              <select value={difficulty ?? ""} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">--</option>
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </label>

            <label>
              Loại câu hỏi
              <select value={qtype ?? ""} onChange={(e) => setQtype(e.target.value)}>
                <option value="">--</option>
                <option value="mcq">Trắc nghiệm</option>
                <option value="truefalse">Đúng/Sai</option>
                <option value="short">Tự luận ngắn</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {explanation && !editing && (
        <div className="question-card__explanation" aria-live="polite" style={{ marginTop: 8 }}>
          {explanation}
        </div>
      )}
    </article>
  );
}

export default memo(QuestionCardComponent);
// ...existing code...
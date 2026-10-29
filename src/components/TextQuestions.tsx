import type { TextListQuestion as TextListQ, TextQuestion as TextQ } from "../questions.ts";
import type { TextAnswer, TextListAnswer } from "../lib/answers.ts";
import { inputClass } from "./ChoiceQuestion.tsx";

export function TextListQuestion({
  question,
  answer,
  onChange,
}: {
  question: TextListQ;
  answer: TextListAnswer | undefined;
  onChange: (a: TextListAnswer) => void;
}) {
  const values = Array.from({ length: question.count }, (_, i) => answer?.[i] ?? "");
  return (
    <div className="max-w-[24rem] space-y-2.5">
      {values.map((v, i) => (
        <label key={i} className="block">
          <span className="mb-1 block text-[13px] text-mute">
            {question.labelPrefix} {i + 1}
          </span>
          <input
            type="text"
            value={v}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={inputClass}
          />
        </label>
      ))}
    </div>
  );
}

export function TextQuestion({
  question,
  answer,
  onChange,
}: {
  question: TextQ;
  answer: TextAnswer | undefined;
  onChange: (a: TextAnswer) => void;
}) {
  const value = answer ?? "";
  return (
    <div>
      <textarea
        value={value}
        maxLength={question.maxLength}
        rows={3}
        aria-label={question.text}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y`}
      />
      <p className="mt-1 text-right text-[13px] text-mute">
        {value.length} / {question.maxLength}
      </p>
    </div>
  );
}

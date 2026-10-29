import type { PlantNoteQuestion as PlantNoteQ, TextListQuestion as TextListQ } from "../questions.ts";
import { readPlantNote, type Answer, type PlantNoteAnswer, type TextListAnswer } from "../lib/answers.ts";
import { Check, inputClass, rowClass } from "./ChoiceQuestion.tsx";

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

const LETTERS = "ABCDE";

/**
 * A note about one plant: the respondent first picks which of their own
 * plants it is about (the non-empty entries of the source question), then
 * writes. With no plants listed yet, it says so and waits.
 */
export function PlantNoteQuestion({
  question,
  answer,
  plants,
  onChange,
}: {
  question: PlantNoteQ;
  answer: Answer | undefined;
  /** Non-empty plant names from the source question, in order. */
  plants: string[];
  onChange: (a: PlantNoteAnswer) => void;
}) {
  const note = readPlantNote(answer);
  const chosen = note.plant && plants.includes(note.plant) ? note.plant : "";
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[13px] text-mute">{question.pickLabel}</p>
        {plants.length === 0 ? (
          <p className="text-[14px] text-mute">List a plant in the question above first.</p>
        ) : (
          <div role="radiogroup" aria-label={question.pickLabel} className="space-y-0.5">
            {plants.map((p, i) => {
              const on = chosen === p;
              return (
                <button
                  key={`${p}-${i}`}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ plant: p, text: note.text })}
                  className={[rowClass, "items-center", on ? "bg-chip" : "hover:bg-chip"].join(" ")}
                >
                  <span className={`key ${on ? "key-on" : ""}`} aria-hidden>
                    {on ? <Check /> : LETTERS[i]}
                  </span>
                  <span className="flex-1">{p}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div>
        <textarea
          value={note.text}
          maxLength={question.maxLength}
          rows={3}
          aria-label={question.text}
          onChange={(e) => onChange({ plant: chosen, text: e.target.value })}
          className={`${inputClass} resize-y`}
        />
        <p className="mt-1 text-right text-[13px] text-mute">
          {note.text.length} / {question.maxLength}
        </p>
      </div>
    </div>
  );
}

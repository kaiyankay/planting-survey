import type { PlantNoteQuestion as PlantNoteQ, TextListQuestion as TextListQ } from "../questions.ts";
import { readList, readPlantNote, type Answer, type PlantNoteAnswer, type TextListAnswer } from "../lib/answers.ts";
import { Check, inputClass, rowClass } from "./ChoiceQuestion.tsx";

/** The not-applicable row: same block as any option, filled with a check when on. */
function NaRow({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className={`${rowClass} items-center ${on ? "bg-chip" : "hover:bg-chip"}`}>
      <span className={`key ${on ? "key-on" : ""}`} aria-hidden>
        {on && <Check />}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

/**
 * Up to five plant names, or the admission that the respondent cannot name
 * enough yet. Choosing the latter disables the fields but keeps what was typed,
 * so unticking it brings the names back.
 */
export function TextListQuestion({
  question,
  answer,
  onChange,
}: {
  question: TextListQ;
  answer: Answer | undefined;
  onChange: (a: TextListAnswer) => void;
}) {
  const raw = Array.isArray(answer) ? answer : answer && typeof answer === "object" && "entries" in answer ? (answer as { entries: string[] }).entries : [];
  const na = readList(answer).notApplicable;
  const values = Array.from({ length: question.count }, (_, i) => raw[i] ?? "");
  return (
    <div className="space-y-4">
      <div className={`max-w-[24rem] space-y-2.5 ${na ? "opacity-40" : ""}`}>
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
              disabled={na}
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
      {question.notApplicable && (
        <NaRow on={na} label={question.notApplicable} onToggle={() => onChange(na ? values : { not_applicable: true, entries: values })} />
      )}
    </div>
  );
}

const LETTERS = "ABCDE";

/**
 * A note about one plant: the respondent first picks which of their own
 * plants it is about (the non-empty entries of the source question), then
 * writes. When the plant list is marked not applicable, the only choice here
 * is to say the same.
 */
export function PlantNoteQuestion({
  question,
  answer,
  plants,
  sourceNotApplicable,
  onChange,
}: {
  question: PlantNoteQ;
  answer: Answer | undefined;
  /** Non-empty plant names from the source question, in order. */
  plants: string[];
  sourceNotApplicable: boolean;
  onChange: (a: PlantNoteAnswer) => void;
}) {
  const note = readPlantNote(answer);
  if (sourceNotApplicable) {
    return (
      <NaRow
        on={note.notApplicable}
        label={question.notApplicable}
        onToggle={() => onChange(note.notApplicable ? { plant: "", text: "" } : { not_applicable: true })}
      />
    );
  }
  const chosen = note.plant && plants.includes(note.plant) ? note.plant : "";
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[13px] text-mute">{question.pickLabel}</p>
        {plants.length === 0 ? (
          <p className="text-[13px] text-mute">List a plant in the question above first</p>
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

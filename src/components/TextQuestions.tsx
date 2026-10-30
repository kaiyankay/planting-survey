import { useState } from "react";
import type { LongTextQuestion as LongTextQ, PlantListQuestion as PlantListQ, PlantNoteQuestion as PlantNoteQ, ShortTextQuestion as ShortTextQ } from "../questions.ts";
import { readPlantList, readPlantNote, readText, type Answer, type PlantEntry, type PlantListAnswer, type PlantNoteAnswer } from "../lib/answers.ts";
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

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <p className="mt-1 text-right text-[13px] text-mute">
      {length} / {max}
    </p>
  );
}

/** One or two lines of text. */
export function ShortTextQuestion({ question, answer, onChange }: { question: ShortTextQ; answer: Answer | undefined; onChange: (a: string) => void }) {
  const value = typeof answer === "string" ? answer : "";
  return (
    <div>
      <textarea
        value={value}
        maxLength={question.maxLength}
        rows={question.lines ?? 1}
        aria-label={question.text}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y`}
      />
      <Counter length={value.length} max={question.maxLength} />
    </div>
  );
}

/** Several sentences, with a folded grey example above the box. */
export function LongTextQuestion({ question, answer, onChange }: { question: LongTextQ; answer: Answer | undefined; onChange: (a: string) => void }) {
  const value = typeof answer === "string" ? answer : "";
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-3">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-[13px] text-mute underline underline-offset-2 hover:text-ink">
          {open ? "Hide example" : "Example (yours can be very different)"}
        </button>
        {open && <p className="mt-2 max-w-[36rem] rounded-md bg-chip px-3 py-2 text-[14px] leading-relaxed text-mute">{question.example}</p>}
      </div>
      <textarea
        value={value}
        maxLength={question.maxLength}
        rows={6}
        aria-label={question.text}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y`}
      />
      <Counter length={value.length} max={question.maxLength} />
    </div>
  );
}

/**
 * Up to five plants, each with a name, a role and an optional reason, or the
 * admission that none apply. Choosing the latter disables the rows but keeps
 * what was typed, so unticking it brings the rows back.
 */
export function PlantListQuestion({ question, answer, onChange }: { question: PlantListQ; answer: Answer | undefined; onChange: (a: PlantListAnswer) => void }) {
  const raw: PlantEntry[] = answer && typeof answer === "object" && "entries" in answer && Array.isArray((answer as PlantListAnswer).entries) ? (answer as PlantListAnswer).entries : [];
  const na = readPlantList(answer).notApplicable;
  const rows: PlantEntry[] = Array.from({ length: question.count }, (_, i) => raw[i] ?? { name: "", role: "", why: "" });
  const update = (i: number, patch: Partial<PlantEntry>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(na ? { not_applicable: true, entries: next } : { entries: next });
  };
  return (
    <div className="space-y-4">
      <div className={`space-y-3 ${na ? "opacity-40" : ""}`}>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.8fr)_minmax(0,1.4fr)]">
            <label className="block">
              <span className="mb-1 block text-[13px] text-mute">Plant {i + 1}</span>
              <input type="text" value={r.name} maxLength={80} autoComplete="off" disabled={na} onChange={(e) => update(i, { name: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-mute">Role</span>
              <select value={r.role} disabled={na} onChange={(e) => update(i, { role: e.target.value })} className={inputClass}>
                <option value="">Choose…</option>
                {question.roles.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-mute">Why, in one line</span>
              <input type="text" value={r.why ?? ""} maxLength={160} autoComplete="off" disabled={na} onChange={(e) => update(i, { why: e.target.value })} className={inputClass} />
            </label>
          </div>
        ))}
      </div>
      <NaRow on={na} label={question.notApplicable} onToggle={() => onChange(na ? { entries: rows } : { not_applicable: true, entries: rows })} />
    </div>
  );
}

const LETTERS = "ABCDE";

/**
 * A note about one plant: the respondent first picks which of their own
 * plants it is about, then writes. When the plant list is marked not
 * applicable, the only choice here is to say the same.
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
  /** Plant names from the source question, in order. */
  plants: string[];
  sourceNotApplicable: boolean;
  onChange: (a: PlantNoteAnswer) => void;
}) {
  const note = readPlantNote(answer);
  // The box shows the text exactly as typed; readPlantNote trims only for validation and export,
  // and a trimmed value fed back into the textarea would swallow every trailing space.
  const rawText = answer && typeof answer === "object" && !Array.isArray(answer) && "text" in answer ? String((answer as { text?: string }).text ?? "") : "";
  if (sourceNotApplicable) {
    return <NaRow on={note.notApplicable} label={question.notApplicable} onToggle={() => onChange(note.notApplicable ? { plant: "", text: "", basis: "" } : { not_applicable: true })} />;
  }
  const chosen = note.plant && plants.includes(note.plant) ? note.plant : "";
  const current = { plant: chosen, text: rawText, basis: note.basis };
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
                  onClick={() => onChange({ ...current, plant: p })}
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
          value={rawText}
          maxLength={question.maxLength}
          rows={4}
          aria-label={question.text}
          onChange={(e) => onChange({ ...current, text: e.target.value })}
          className={`${inputClass} resize-y`}
        />
        <Counter length={rawText.length} max={question.maxLength} />
      </div>
      <div>
        <p className="mb-1 text-[13px] text-mute">{question.basis.label}</p>
        <div role="radiogroup" aria-label={question.basis.label} className="space-y-0.5">
          {question.basis.options.map((o, i) => {
            const on = note.basis === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...current, basis: o.key })}
                className={[rowClass, "items-center", on ? "bg-chip" : "hover:bg-chip"].join(" ")}
              >
                <span className={`key ${on ? "key-on" : ""}`} aria-hidden>
                  {LETTERS[i]}
                </span>
                <span className="flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { readText };

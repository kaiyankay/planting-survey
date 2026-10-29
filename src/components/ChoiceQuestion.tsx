import { useMemo, useRef } from "react";
import type { CheckboxQuestion, SingleQuestion } from "../questions.ts";
import type { ChoiceAnswer } from "../lib/answers.ts";
import { orderOptions } from "../lib/shuffle.ts";

type Props = {
  question: CheckboxQuestion | SingleQuestion;
  answer: ChoiceAnswer | undefined;
  onChange: (a: ChoiceAnswer) => void;
  /** Options flagged noExperienceOnly are shown only when this is true. */
  noExperience: boolean;
};

const LETTERS = "ABCDEFGHIJKLMNOP";

export const inputClass =
  "w-full rounded-md border border-line bg-field px-3 py-2 text-[15px] leading-snug transition-colors focus:border-ink";

/** One option row: key block on the left, text on the right. Shared by every choice-type question. */
export const rowClass =
  "flex min-h-10 w-full items-start gap-3 rounded-md px-2 py-1.5 text-left text-[15px] leading-snug transition-colors duration-100";

export function Check() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChoiceQuestion({ question, answer, onChange, noExperience }: Props) {
  const ordered = useMemo(() => orderOptions(question.options, question.shuffle), [question]);
  const options = ordered.filter((o) => !o.noExperienceOnly || noExperience);
  const selected = answer?.selected ?? [];
  const other = answer?.other ?? "";
  const single = question.kind === "single";
  const max = question.kind === "checkbox" ? question.max : undefined;
  const atMax = max !== undefined && selected.length >= max;
  const otherInputRef = useRef<HTMLInputElement>(null);

  function toggle(key: string) {
    const opt = options.find((o) => o.key === key)!;
    let next: string[];
    if (single) {
      next = [key];
    } else if (selected.includes(key)) {
      next = selected.filter((k) => k !== key);
    } else if (opt.exclusive) {
      next = [key];
    } else {
      const base = selected.filter((k) => !options.find((o) => o.key === k)?.exclusive);
      if (max !== undefined && base.length >= max) return;
      next = [...base, key];
    }
    const keepOther = next.some((k) => options.find((o) => o.key === k)?.other);
    onChange({ selected: next, ...(keepOther && other ? { other } : {}) });
    if (opt.other && next.includes(key)) {
      window.setTimeout(() => otherInputRef.current?.focus(), 30);
    }
  }

  return (
    <div>
      <div role={single ? "radiogroup" : "group"} aria-label={question.text} className="space-y-0.5">
        {options.map((opt, i) => {
          const isSelected = selected.includes(opt.key);
          const disabled = !single && !isSelected && atMax && !opt.exclusive;
          return (
            <div key={opt.key}>
              <button
                type="button"
                role={single ? "radio" : "checkbox"}
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => toggle(opt.key)}
                className={[rowClass, single && isSelected ? "bg-chip" : "", disabled ? "opacity-40" : "hover:bg-chip"].join(" ")}
              >
                <span className={`key mt-[1px] ${isSelected ? "key-on" : ""}`} aria-hidden>
                  {!single && isSelected ? <Check /> : LETTERS[i]}
                </span>
                <span className="flex-1">{opt.label}</span>
              </button>
              {opt.other && isSelected && (
                <div className="pb-2 pl-10 pt-1">
                  <input
                    ref={otherInputRef}
                    type="text"
                    value={other}
                    maxLength={120}
                    placeholder="Please specify"
                    aria-label={`${opt.label}, details`}
                    onChange={(e) => onChange({ selected, other: e.target.value })}
                    className={`${inputClass} max-w-[24rem]`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {max !== undefined && selected.length > 0 && (
        <p className="mt-2 text-[13px] text-mute" aria-live="polite">
          {selected.length} of {max} selected
        </p>
      )}
    </div>
  );
}

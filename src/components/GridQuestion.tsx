import type { GridQuestion as GridQ } from "../questions.ts";
import { GRID_NA, type GridAnswer } from "../lib/answers.ts";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { Check, rowClass } from "./ChoiceQuestion.tsx";

type Props = {
  question: GridQ;
  answer: GridAnswer | undefined;
  onChange: (a: GridAnswer) => void;
  desktop: boolean;
  /** Offers the question’s not-applicable row (for respondents with no experience). */
  allowNotApplicable: boolean;
};

/** The matrix needs about 600 px; below that each row stacks its four choices. */
const MATRIX_QUERY = "(min-width: 640px)";

const LETTERS = "ABCDEFGH";

/**
 * The same key block as the choice rows. In the matrix the cell has no letter,
 * so a chosen cell shows a check; in the stacked layout the letter stays and the
 * block fills, exactly like a single-choice row.
 */
function Cell({ on, letter }: { on: boolean; letter?: string }) {
  return (
    <span className={`key ${on ? "key-on" : ""}`} aria-hidden>
      {letter ?? (on ? <Check /> : null)}
    </span>
  );
}

/**
 * Wide screens: a true matrix, one header row and one circle per cell, with a
 * hairline between rows. Narrow screens: each consideration becomes a label
 * with its four choices stacked beneath it; no table and no horizontal scroll.
 */
export function GridQuestion({ question, answer, onChange, allowNotApplicable }: Props) {
  const matrix = useMediaQuery(MATRIX_QUERY);
  const value = answer ?? {};
  const na = value[GRID_NA] === "yes";
  // Choosing any cell clears the not-applicable mark.
  const set = (row: string, col: string) => {
    const { [GRID_NA]: _na, ...rest } = value;
    onChange({ ...rest, [row]: col });
  };
  const naRow = allowNotApplicable && question.notApplicable && (
    <button
      type="button"
      role="checkbox"
      aria-checked={na}
      onClick={() => onChange(na ? {} : { [GRID_NA]: "yes" })}
      className={`${rowClass} mt-3 items-center hover:bg-chip`}
    >
      <span className={`key ${na ? "key-on" : ""}`} aria-hidden>
        {na && <Check />}
      </span>
      <span className="flex-1">{question.notApplicable}</span>
    </button>
  );

  if (matrix) {
    const cols = question.columns.length;
    return (
      <div>
        <div
          role="table"
          aria-label={question.text}
          className={`grid ${na ? "opacity-40" : ""}`}
          style={{ gridTemplateColumns: `minmax(12rem, 1.5fr) repeat(${cols}, minmax(6rem, 1fr))` }}
        >
          <div role="row" className="contents">
            <span role="columnheader" className="self-end border-b border-line pb-2.5 pr-3 text-[13px] leading-snug text-mute">
              Consideration
            </span>
            {question.columns.map((c) => (
              <span key={c.key} role="columnheader" className="self-end border-b border-line px-1 pb-2.5 text-center text-[13px] leading-snug text-mute">
                {c.label}
              </span>
            ))}
          </div>
          {question.rows.map((row) => (
            <div key={row.key} role="row" className="contents">
              <span role="rowheader" className="flex items-center border-b border-line py-1.5 pr-3 text-[15px] leading-snug text-ink">
                {row.label}
              </span>
              {question.columns.map((col) => {
                const on = value[row.key] === col.key;
                return (
                  <span key={col.key} role="cell" className="flex items-center justify-center border-b border-line py-1.5">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${row.label}: ${col.label}`}
                      onClick={() => set(row.key, col.key)}
                      className="flex size-10 items-center justify-center rounded-md transition-colors hover:bg-chip"
                    >
                      <Cell on={on} />
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {naRow}
      </div>
    );
  }

  return (
    <div>
      <div className={`space-y-4 ${na ? "opacity-40" : ""}`}>
        {question.rows.map((row) => (
          <div key={row.key} role="radiogroup" aria-label={row.label}>
            <p className="mb-1 text-[16px] leading-snug text-ink">{row.label}</p>
            <div className="space-y-0.5">
              {question.columns.map((col, i) => {
                const on = value[row.key] === col.key;
                return (
                  <button
                    key={col.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set(row.key, col.key)}
                    className={[rowClass, "items-center", on ? "bg-chip" : "hover:bg-chip"].join(" ")}
                  >
                    <Cell on={on} letter={LETTERS[i]} />
                    <span className="flex-1">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {naRow}
    </div>
  );
}

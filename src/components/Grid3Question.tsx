import type { Grid3Question as Grid3Q } from "../questions.ts";
import type { GridAnswer } from "../lib/answers.ts";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { Check, rowClass } from "./ChoiceQuestion.tsx";

type Props = { question: Grid3Q; answer: GridAnswer | undefined; onChange: (a: GridAnswer) => void };

/** The matrix needs about 600 px; below that each row stacks its three choices. */
const MATRIX_QUERY = "(min-width: 640px)";

/** The same 22px block as every option, left blank; a chosen cell fills and shows a check. */
function Cell({ on }: { on: boolean }) {
  return (
    <span className={`key ${on ? "key-on" : ""}`} aria-hidden>
      {on && <Check />}
    </span>
  );
}

/**
 * Wide screens: a true matrix with one heading row (label plus a short note)
 * and one block per cell. Narrow screens: each attribute becomes a label with
 * its three choices stacked beneath it; no table and no horizontal scroll.
 */
export function Grid3Question({ question, answer, onChange }: Props) {
  const matrix = useMediaQuery(MATRIX_QUERY);
  const value = answer ?? {};
  const set = (row: string, col: string) => onChange({ ...value, [row]: col });

  if (matrix) {
    return (
      <div role="table" aria-label={question.text} className="grid" style={{ gridTemplateColumns: "minmax(12rem, 1.4fr) repeat(3, minmax(7rem, 1fr))" }}>
        <div role="row" className="contents">
          <span role="columnheader" className="self-end border-b border-line pb-2.5 pr-3 text-[13px] leading-snug text-mute">
            Attribute
          </span>
          {question.columns.map((c) => (
            <span key={c.key} role="columnheader" className="self-end border-b border-line px-1 pb-2.5 text-center text-[13px] leading-snug text-mute">
              <span className="block text-ink">{c.label}</span>
              {c.note && <span className="block">{c.note}</span>}
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
    );
  }

  return (
    <div className="space-y-4">
      {question.rows.map((row) => (
        <div key={row.key} role="radiogroup" aria-label={row.label}>
          <p className="mb-1 text-[15px] leading-snug text-ink">{row.label}</p>
          <div className="space-y-0.5">
            {question.columns.map((col) => {
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
                  <Cell on={on} />
                  <span className="flex-1">
                    {col.label}
                    {col.note && <span className="text-mute"> · {col.note}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

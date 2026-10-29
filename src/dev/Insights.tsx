import { useMemo } from "react";
import type { ResponseRow } from "../lib/answers.ts";
import { QUESTIONS_VERSION } from "../questions.ts";
import { buildInsights, requirementsExport, type QuestionResult } from "./insights.ts";
import { Bars } from "./Analytics.tsx";
import { download } from "./data.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Database insights: the survey read dimension by dimension, results kept apart from implications. */
export function Insights({ rows }: { rows: ResponseRow[] }) {
  const dims = useMemo(() => buildInsights(rows), [rows]);
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <p className="max-w-[36rem] text-[15px] leading-relaxed text-ink">
        What should the plant knowledge database contain, and how should that knowledge be organised and used? Each dimension below shows the
        survey results first, then the database implications they point to.
      </p>
      <p className="mt-2 max-w-[36rem] text-[13px] text-mute">
        Results are counts over everyone who answered the question ({rows.length} responses in all, version {QUESTIONS_VERSION}). Implications are
        suggested fields and features written by the research team and ranked by those counts. They are hypotheses to test, not conclusions.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={() => download(`database_requirements-${stamp}.json`, JSON.stringify(requirementsExport(rows), null, 2), "application/json")}
          className="rounded-md bg-fill px-3.5 py-2 text-[14px] font-medium text-on-fill"
        >
          Download database_requirements.json
        </button>
      </div>

      {dims.map((d) => (
        <section key={d.id} className="mt-14 border-t border-line pt-6">
          <h2 className="text-[18px] font-semibold text-ink">{d.title}</h2>
          <p className="mt-1 text-[14px] text-mute">{d.question}</p>

          <h3 className="mt-6 text-[13px] font-medium text-mute">Survey results</h3>
          <div className="mt-3 space-y-8">
            {d.results.map((r) => (
              <ResultBlock key={r.id} result={r} />
            ))}
          </div>

          <h3 className="mt-8 text-[13px] font-medium text-mute">Findings</h3>
          <ul className="mt-2 space-y-1.5">
            {d.findings.map((f, i) => (
              <li key={i} className="text-[14px] leading-snug text-ink">
                {f}
              </li>
            ))}
          </ul>

          <h3 className="mt-8 text-[13px] font-medium text-mute">Database implications (suggested)</h3>
          {d.implications.length === 0 ? (
            <p className="mt-2 text-[14px] text-mute">Nothing to rank yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {d.implications.map((i) => (
                <li key={`${i.question_id}-${i.option_key}`} className="flex items-baseline gap-3 rounded-md bg-chip px-3 py-2 text-[14px] leading-snug">
                  <span className="flex-1 text-ink">{i.suggestion}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-mute">
                    {i.count} · {pct(i.share)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function ResultBlock({ result }: { result: QuestionResult }) {
  if (result.kind === "choice") {
    return (
      <div>
        <p className="text-[15px] font-medium leading-snug text-ink">{result.text}</p>
        <p className="mt-0.5 text-[12px] text-mute">{result.respondents} answered</p>
        <Bars items={result.counts} max={Math.max(...result.counts.map((c) => c.count), 1)} />
      </div>
    );
  }
  const top = Math.max(...result.cells.map((c) => c.count), 1);
  return (
    <div>
      <p className="text-[15px] font-medium leading-snug text-ink">{result.text}</p>
      <p className="mt-0.5 text-[12px] text-mute">
        {result.respondents} answered{result.not_applicable > 0 ? `, ${result.not_applicable} not applicable` : ""}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="pb-2 text-left font-medium text-mute" />
              {result.columns.map((c) => (
                <th key={c.key} className="pb-2 pr-2 text-left align-bottom font-medium text-mute">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="py-1.5 pr-3 text-ink">{r.label}</td>
                {result.columns.map((c) => {
                  const cell = result.cells.find((x) => x.row === r.key && x.col === c.key)!;
                  return (
                    <td key={c.key} className="py-1.5 pr-2 tabular-nums text-ink">
                      <span
                        className="inline-block min-w-[3.25rem] rounded-[4px] px-1.5 py-0.5"
                        style={{ background: `color-mix(in oklab, var(--accent) ${Math.round((cell.count / top) * 55)}%, transparent)` }}
                      >
                        {cell.count} <span className="text-mute">{pct(cell.share)}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

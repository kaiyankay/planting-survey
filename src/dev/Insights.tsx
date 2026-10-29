import { useMemo, useState } from "react";
import type { ResponseRow } from "../lib/answers.ts";
import { buildInsights, DECISION_LABELS, requirementsExport, type Evidence, type QuestionResult, type RequirementResult } from "./insights.ts";
import { Bars } from "./Analytics.tsx";
import { download, type Decision, type DecisionStatus } from "./data.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

type Props = {
  rows: ResponseRow[];
  decisions: Decision[];
  canEdit: boolean;
  onDecide: (d: Decision) => Promise<void>;
  meta: unknown;
};

/** Database insights: survey evidence, the suggested requirements catalogue, and the researchers’ decisions, kept apart. */
export function Insights({ rows, decisions, canEdit, onDecide, meta }: Props) {
  const dims = useMemo(() => buildInsights(rows, decisions), [rows, decisions]);
  const stamp = new Date().toISOString().slice(0, 10);
  const all = dims.flatMap((d) => d.requirements);
  const decided = all.filter((r) => r.decision.status !== "proposed").length;

  return (
    <div>
      <p className="max-w-[36rem] text-[15px] leading-relaxed text-ink">
        What should the plant knowledge database contain, and how should that knowledge be organised and used? Each dimension shows three
        things apart: the survey evidence, the requirements the research team proposed beforehand, and the decision recorded for each.
      </p>
      <ul className="mt-3 max-w-[36rem] space-y-1 text-[13px] text-mute">
        <li>Shares are of the respondents who answered the question (n). An option nobody chose is zero, not unimportant.</li>
        <li>Q7 rows show how designers treat a condition; they are not turned into filters or weights.</li>
        <li>Core fields (marked) are basic botanical data a plant database needs; low counts are not grounds to exclude them.</li>
        <li>Survey results describe respondents’ practice, not verified facts about plants. Nothing here is approved automatically.</li>
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => download(`database_requirements-${stamp}.json`, JSON.stringify(requirementsExport(rows, decisions, meta), null, 2), "application/json")}
          className="rounded-md bg-fill px-3.5 py-2 text-[14px] font-medium text-on-fill"
        >
          Download database_requirements.json
        </button>
        <span className="text-[13px] text-mute">
          {all.length} requirements, {decided} decided{canEdit ? "" : " · you can read but not change decisions"}
        </span>
      </div>

      {dims.map((d) => (
        <section key={d.id} className="mt-14 border-t border-line pt-6">
          <h2 className="text-[18px] font-semibold text-ink">{d.title}</h2>
          <p className="mt-1 text-[14px] text-mute">{d.question}</p>

          <h3 className="mt-6 text-[13px] font-medium text-mute">Survey evidence</h3>
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

          <h3 className="mt-8 text-[13px] font-medium text-mute">Requirements: suggested, with evidence and decision</h3>
          {d.requirements.length === 0 ? (
            <p className="mt-2 text-[14px] text-mute">No catalogue items are attached to this dimension.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {d.requirements.map((r) => (
                <RequirementRow key={r.id} r={r} canEdit={canEdit} onDecide={onDecide} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function RequirementRow({ r, canEdit, onDecide }: { r: RequirementResult; canEdit: boolean; onDecide: (d: Decision) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [rationale, setRationale] = useState(r.decision.rationale ?? "");
  const [error, setError] = useState("");
  const strongest = [...r.evidence_results].sort((a, b) => b.share - a.share)[0];

  async function decide(status: DecisionStatus, text = rationale) {
    setError("");
    try {
      await onDecide({ requirement_id: r.id, status, rationale: text.trim() || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex-1 text-left">
          <span className="text-[15px] text-ink">{r.label}</span>
          <span className="ml-2 text-[12px] text-mute">{r.category}</span>
          {r.core && <span className="ml-2 rounded-md bg-mark px-1.5 py-0.5 text-[11px] text-ink">core</span>}
        </button>
        {strongest && (
          <span className="text-[12px] tabular-nums text-mute" title="Strongest single piece of evidence">
            Q{strongest.question_number} {strongest.count}/{strongest.n} ({pct(strongest.share)})
          </span>
        )}
        <DecisionChip status={r.decision.status} />
      </div>
      {open && (
        <div className="mt-3 space-y-3 pl-1">
          <p className="text-[12px] text-mute">
            ID <code>{r.id}</code> · category {r.category}
          </p>
          <div>
            <p className="text-[12px] text-mute">Survey evidence in this selection</p>
            <ul className="mt-1 space-y-1">
              {r.evidence_results.length === 0 && <li className="text-[13px] text-mute">None of the evidence questions were answered in this selection.</li>}
              {r.evidence_results.map((e, i) => (
                <EvidenceLine key={i} e={e} />
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-line p-3">
            <p className="text-[12px] text-mute">Research decision</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(Object.keys(DECISION_LABELS) as DecisionStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={r.decision.status === s}
                  onClick={() => decide(s)}
                  className={[
                    "rounded-md border px-2.5 py-1 text-[13px] transition-colors disabled:cursor-default",
                    r.decision.status === s ? "border-ink bg-chip text-ink" : "border-line text-mute enabled:hover:bg-chip",
                  ].join(" ")}
                >
                  {DECISION_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={rationale}
                disabled={!canEdit}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Research rationale"
                aria-label={`Rationale for ${r.label}`}
                className="min-w-0 flex-1 rounded-md border border-line bg-field px-2.5 py-1.5 text-[14px] text-ink focus:border-ink disabled:opacity-60"
              />
              {canEdit && (
                <button type="button" onClick={() => decide(r.decision.status)} className="text-[13px] underline">
                  Save
                </button>
              )}
            </div>
            {r.decision.updated_at && (
              <p className="mt-2 text-[12px] text-mute">
                Last changed {new Date(r.decision.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {r.decision.updated_by ? ` by ${r.decision.updated_by}` : ""}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-[13px] text-hint">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function EvidenceLine({ e }: { e: Evidence }) {
  if (e.distribution) {
    return (
      <li className="text-[13px] text-ink">
        Q{e.question_number} {e.label} (n = {e.n}):{" "}
        <span className="text-mute">{e.distribution.map((d) => `${d.label} ${d.count} (${pct(d.share)})`).join(" · ")}</span>
      </li>
    );
  }
  return (
    <li className="text-[13px] text-ink">
      Q{e.question_number} “{e.label}”: {e.count} of {e.n} ({pct(e.share)})
    </li>
  );
}

function DecisionChip({ status }: { status: DecisionStatus }) {
  const tone =
    status === "include" ? "border-ink text-ink" : status === "exclude" ? "border-line text-mute line-through" : status === "defer" ? "border-line text-mute" : "border-dashed border-line text-mute";
  return <span className={`rounded-md border px-2 py-0.5 text-[12px] ${tone}`}>{DECISION_LABELS[status]}</span>;
}

function ResultBlock({ result }: { result: QuestionResult }) {
  if (result.kind === "choice") {
    const { n, counts, unknown } = result.stats;
    return (
      <div>
        <p className="text-[15px] font-medium leading-snug text-ink">{result.text}</p>
        <p className="mt-0.5 text-[12px] text-mute">
          n = {n} answered{unknown > 0 ? `; ${unknown} selections from an earlier version not counted` : ""}
        </p>
        <Bars items={counts} max={Math.max(...counts.map((c) => c.count), 1)} />
      </div>
    );
  }
  const s = result.stats;
  const top = Math.max(...s.rows.flatMap((r) => r.cells.map((c) => c.count)), 1);
  return (
    <div>
      <p className="text-[15px] font-medium leading-snug text-ink">{result.text}</p>
      <p className="mt-0.5 text-[12px] text-mute">
        {s.answered} answered, {s.notApplicable} not applicable; row shares use only those who answered that row.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="pb-2 text-left font-medium text-mute" />
              <th className="pb-2 pr-2 text-right font-medium text-mute">n</th>
              {result.columns.map((c) => (
                <th key={c.key} className="pb-2 pr-2 text-left align-bottom font-medium text-mute">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="py-1.5 pr-3 text-ink">{r.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-mute">{r.n}</td>
                {r.cells.map((cell) => (
                  <td key={cell.col} className="py-1.5 pr-2 tabular-nums text-ink">
                    <span
                      className="inline-block min-w-[3.25rem] rounded-[4px] px-1.5 py-0.5"
                      style={{ background: `color-mix(in oklab, var(--accent) ${Math.round((cell.count / top) * 55)}%, transparent)` }}
                    >
                      {cell.count} <span className="text-mute">{pct(cell.share)}</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

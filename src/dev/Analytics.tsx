import { useState } from "react";
import { ALL_QUESTIONS, QUESTIONS_VERSION, SECTIONS, type Question } from "../questions.ts";
import { listEntries, toCsv, type ResponseRow } from "../lib/answers.ts";
import { choiceStats, gridStats, median, otherTexts, plantNotes } from "../lib/analysis.ts";
import { download } from "./data.ts";

type Props = { rows: ResponseRow[]; total: number; meta: unknown };

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Survey analytics over the current selection: counts with their base n, open answers, raw exports. */
export function Analytics({ rows, total, meta }: Props) {
  const durations = rows.map((r) => r.duration_seconds).filter((d): d is number => typeof d === "number");
  const med = median(durations);
  const last = rows.at(-1)?.submitted_at;
  const stamp = new Date().toISOString().slice(0, 10);

  function exportJson() {
    const bundle = {
      exported_at: new Date().toISOString(),
      questions_version: QUESTIONS_VERSION,
      filter: meta,
      responses: rows.length,
      note: "Shares are of the respondents who answered each question (n), not of all responses. Grid rows use only those who answered that row.",
      questions: ALL_QUESTIONS.map((q) => summarise(q, rows)),
    };
    download(`survey-analysis-${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json");
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Responses" value={String(rows.length)} note={rows.length !== total ? `of ${total}` : undefined} />
        <Tile label="Median time" value={med == null ? "–" : `${Math.round(med / 60)} min`} note={med == null ? undefined : `${Math.round(med)} s`} />
        <Tile label="Last response" value={last ? new Date(last).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "–"} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => download(`responses-${stamp}.csv`, "﻿" + toCsv(rows), "text/csv")} className="rounded-md bg-fill px-3.5 py-2 text-[14px] font-medium text-on-fill">
          Download CSV
        </button>
        <button type="button" onClick={exportJson} className="rounded-md border border-line px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-chip">
          Download analysis JSON
        </button>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id} className="mt-12">
          <h2 className="border-t border-line pt-5 text-[14px] font-medium text-mute">{section.title}</h2>
          <div className="mt-6 space-y-12">
            {section.questions.map((q) => (
              <QuestionSummary key={q.id} question={q} number={ALL_QUESTIONS.indexOf(q) + 1} rows={rows} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-line px-4 py-3">
      <p className="text-[12px] text-mute">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums leading-tight text-ink">{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-mute">{note}</p>}
    </div>
  );
}

export function Bars({ items, max }: { items: { key: string; label: string; count: number; share: number }[]; max: number }) {
  const top = Math.max(max, 1);
  return (
    <ul className="mt-3 space-y-2">
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 md:grid-cols-[minmax(0,18rem)_1fr_auto]">
          <span className="truncate text-[14px] text-ink" title={it.label}>
            {it.label}
          </span>
          <span className="h-2 rounded-r-[4px] bg-line" aria-hidden>
            <span className="block h-full rounded-r-[4px] bg-fill" style={{ width: `${(it.count / top) * 100}%` }} />
          </span>
          <span className="w-20 text-right text-[13px] tabular-nums text-mute">
            {it.count} <span className="text-mute/70">{pct(it.share)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuestionSummary({ question: q, number, rows }: { question: Question; number: number; rows: ResponseRow[] }) {
  return (
    <div>
      <h3 className="text-[16px] font-semibold leading-snug text-ink">
        <span className="mr-2 tabular-nums text-mute">{number}.</span>
        {q.text}
      </h3>
      <Body q={q} rows={rows} />
    </div>
  );
}

function Body({ q, rows }: { q: Question; rows: ResponseRow[] }) {
  switch (q.kind) {
    case "checkbox":
    case "single": {
      const { n, counts, unknown } = choiceStats(q, rows);
      const others = otherTexts(q, rows);
      return (
        <>
          <p className="mt-0.5 text-[12px] text-mute">
            n = {n} answered{q.kind === "checkbox" ? "; shares add to more than 100% because several options may be chosen" : ""}
            {unknown > 0 ? `; ${unknown} selections refer to options from an earlier version and are not counted` : ""}
          </p>
          <Bars items={counts} max={Math.max(...counts.map((c) => c.count), 1)} />
          {others.length > 0 && <TextList title="Other, as written" items={others} />}
        </>
      );
    }
    case "grid": {
      const s = gridStats(q, rows);
      const top = Math.max(...s.rows.flatMap((r) => r.cells.map((c) => c.count)), 1);
      return (
        <div className="mt-2 overflow-x-auto">
          <p className="text-[12px] text-mute">
            {s.answered} answered, {s.notApplicable} not applicable. Each row’s shares use only the respondents who answered that row (n).
          </p>
          <table className="mt-3 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="pb-2 text-left font-medium text-mute" />
                <th className="pb-2 pr-2 text-right font-medium text-mute">n</th>
                {q.columns.map((c) => (
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
      );
    }
    case "textlist": {
      const lists = rows.map((r) => listEntries(r.answers[q.id])).filter((l) => l.length > 0);
      return <TextList title={`${lists.length} lists, as written`} items={lists.map((l) => l.join(", "))} />;
    }
    case "plantnote": {
      const notes = plantNotes(q.id, rows);
      const unassigned = notes.filter((n) => n.plant === null).length;
      return (
        <TextList
          title={`${notes.length} notes${unassigned ? `, ${unassigned} without a plant attached (earlier version)` : ""}`}
          items={notes.map((n) => `${n.plant ?? "Unassigned note"}: ${n.text}`)}
        />
      );
    }
  }
}

export function TextList({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 5);
  return (
    <div className="mt-4">
      <p className="text-[12px] text-mute">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {shown.map((t, i) => (
          <li key={i} className="rounded-md bg-chip px-3 py-2 text-[14px] leading-snug text-ink">
            {t}
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-[13px] text-mute underline">
          {open ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

function summarise(q: Question, rows: ResponseRow[]) {
  switch (q.kind) {
    case "checkbox":
    case "single": {
      const s = choiceStats(q, rows);
      return { id: q.id, text: q.text, n: s.n, counts: s.counts, unknown_selections: s.unknown, other: otherTexts(q, rows) };
    }
    case "grid": {
      const s = gridStats(q, rows);
      return { id: q.id, text: q.text, answered: s.answered, not_applicable: s.notApplicable, rows: s.rows };
    }
    case "textlist":
      return { id: q.id, text: q.text, lists: rows.map((r) => listEntries(r.answers[q.id])).filter((l) => l.length > 0) };
    case "plantnote":
      return { id: q.id, text: q.text, notes: plantNotes(q.id, rows) };
  }
}

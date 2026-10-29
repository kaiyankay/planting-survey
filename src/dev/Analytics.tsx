import { useMemo, useState } from "react";
import { ALL_QUESTIONS, QUESTIONS_VERSION, SECTIONS, type Question } from "../questions.ts";
import { toCsv, type ChoiceAnswer, type ResponseRow } from "../lib/answers.ts";
import { choiceCounts, gridCounts, gridNotApplicable, median, otherTexts, plantTally } from "../lib/analysis.ts";
import { download } from "./data.ts";

type Props = { rows: ResponseRow[] };

const Q1 = ALL_QUESTIONS.find((q) => q.id === "q1")!;
const Q2 = ALL_QUESTIONS.find((q) => q.id === "q2")!;

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Survey analytics: counts, filters, per-question summaries and the raw exports. */
export function Analytics({ rows }: Props) {
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [experience, setExperience] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q1 = (r.answers.q1 as ChoiceAnswer | undefined)?.selected ?? [];
        const q2 = (r.answers.q2 as ChoiceAnswer | undefined)?.selected ?? [];
        return (roles.size === 0 || q1.some((k) => roles.has(k))) && (experience.size === 0 || q2.some((k) => experience.has(k)));
      }),
    [rows, roles, experience],
  );

  const durations = filtered.map((r) => r.duration_seconds).filter((d): d is number => typeof d === "number");
  const med = median(durations);
  const last = filtered.at(-1)?.submitted_at;
  const plants = useMemo(() => plantTally("q14", filtered), [filtered]);
  const stamp = new Date().toISOString().slice(0, 10);

  function toggle(set: Set<string>, key: string, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  function exportJson() {
    const bundle = {
      exported_at: new Date().toISOString(),
      questions_version: QUESTIONS_VERSION,
      filter: { roles: [...roles], experience: [...experience] },
      responses: filtered.length,
      plants,
      questions: ALL_QUESTIONS.map((q) => summarise(q, filtered)),
    };
    download(`survey-analysis-${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json");
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Responses" value={String(filtered.length)} note={filtered.length !== rows.length ? `of ${rows.length}` : undefined} />
        <Tile label="Median time" value={med == null ? "–" : `${Math.round(med / 60)} min`} note={med == null ? undefined : `${Math.round(med)} s`} />
        <Tile label="Last response" value={last ? new Date(last).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "–"} />
      </div>

      <div className="mt-8 space-y-3">
        <FilterRow
          label="Who"
          options={Q1.kind === "checkbox" ? Q1.options : []}
          active={roles}
          onToggle={(k) => toggle(roles, k, setRoles)}
        />
        <FilterRow
          label="Experience"
          options={Q2.kind === "single" ? Q2.options : []}
          active={experience}
          onToggle={(k) => toggle(experience, k, setExperience)}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download(`responses-${stamp}.csv`, "﻿" + toCsv(filtered), "text/csv")}
          className="rounded-md bg-fill px-3.5 py-2 text-[14px] font-medium text-on-fill"
        >
          Download CSV
        </button>
        <button type="button" onClick={exportJson} className="rounded-md border border-line px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-chip">
          Download analysis JSON
        </button>
      </div>

      <section className="mt-14">
        <h2 className="text-[18px] font-semibold text-ink">Plants named for Metro Vancouver</h2>
        <p className="mt-1 text-[14px] text-mute">
          From question 14, grouped by spelling only. Merging names and reviewing them happens under Plant candidates.
        </p>
        {plants.length === 0 ? (
          <p className="mt-4 text-[14px] text-mute">No plants named yet.</p>
        ) : (
          <Bars
            items={plants.slice(0, 30).map((p) => ({ key: p.name, label: p.name, count: p.count, share: p.count / (filtered.length || 1) }))}
            max={plants[0].count}
          />
        )}
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} className="mt-14">
          <h2 className="border-t border-line pt-5 text-[14px] font-medium text-mute">{section.title}</h2>
          <div className="mt-6 space-y-12">
            {section.questions.map((q) => (
              <QuestionSummary key={q.id} question={q} number={ALL_QUESTIONS.indexOf(q) + 1} rows={filtered} />
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

function FilterRow({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: { key: string; label: string }[];
  active: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-[13px] text-mute">{label}</span>
      {options.map((o) => {
        const on = active.has(o.key);
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.key)}
            className={[
              "rounded-md border px-2.5 py-1 text-[13px] leading-snug transition-colors",
              on ? "border-ink bg-chip text-ink" : "border-line text-mute hover:bg-chip",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Bars({ items, max }: { items: { key: string; label: string; count: number; share: number }[]; max: number }) {
  const top = Math.max(max, 1);
  return (
    <ul className="mt-4 space-y-2">
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
      const counts = choiceCounts(q, rows);
      const others = otherTexts(q, rows);
      return (
        <>
          <Bars items={counts} max={Math.max(...counts.map((c) => c.count), 1)} />
          {others.length > 0 && <TextList title="Other, as written" items={others} />}
        </>
      );
    }
    case "grid": {
      const cells = gridCounts(q, rows);
      const top = Math.max(...cells.map((c) => c.count), 1);
      const naCount = gridNotApplicable(q, rows);
      return (
        <div className="mt-4 overflow-x-auto">
          {naCount > 0 && (
            <p className="mb-2 text-[12px] text-mute">
              {naCount} marked this not applicable.
            </p>
          )}
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="pb-2 text-left font-medium text-mute" />
                {q.columns.map((c) => (
                  <th key={c.key} className="pb-2 pr-2 text-left align-bottom font-medium text-mute">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-ink">{r.label}</td>
                  {q.columns.map((c) => {
                    const cell = cells.find((x) => x.row === r.key && x.col === c.key)!;
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
      );
    }
    case "textlist": {
      const lists = rows.map((r) => ((r.answers[q.id] as string[] | undefined) ?? []).map((s) => s.trim()).filter(Boolean)).filter((l) => l.length > 0);
      return <TextList title={`${lists.length} lists, as written`} items={lists.map((l) => l.join(", "))} />;
    }
    case "text": {
      const texts = rows.map((r) => ((r.answers[q.id] as string | undefined) ?? "").trim()).filter(Boolean);
      return <TextList title={`${texts.length} answers`} items={texts} />;
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
    case "single":
      return { id: q.id, text: q.text, counts: choiceCounts(q, rows), other: otherTexts(q, rows) };
    case "grid":
      return { id: q.id, text: q.text, cells: gridCounts(q, rows), not_applicable: gridNotApplicable(q, rows) };
    case "textlist":
      return { id: q.id, text: q.text, lists: rows.map((r) => r.answers[q.id] ?? []) };
    case "text":
      return { id: q.id, text: q.text, answers: rows.map((r) => r.answers[q.id] ?? "").filter(Boolean) };
  }
}

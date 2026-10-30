import { useMemo, useState } from "react";
import { ALL_QUESTIONS, QUESTIONS_VERSION, SECTIONS, type Question } from "../questions.ts";
import { csvOf, plantNames, readPlantList, toCsv, type ResponseRow } from "../lib/answers.ts";
import { basisLabel, choiceStats, grid3Stats, median, notApplicableCount, openText, otherTexts, plantNotes } from "../lib/analysis.ts";
import { groupTags } from "./filters.ts";
import { download } from "./data.ts";
import { About, Bars, Button, Chip, Section, T, TextList, Tile, Toolbar, pct } from "./ui.tsx";

type Props = { rows: ResponseRow[]; total: number; meta: unknown };

/** The questions whose answers are free text, listed verbatim under Open responses. */
const OPEN_QUESTIONS = ["b4", "c3", "d1", "d2", "f2"];

/** Survey analytics over the current selection: counts with their base n, the b1 matrix, open answers verbatim, raw exports. */
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
      note: "Shares are of the respondents who answered each question (n), not of all responses. Questions a respondent was not shown are absent from their answers.",
      questions: ALL_QUESTIONS.map((q) => summarise(q, rows)),
    };
    download(`survey-analysis-${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json");
  }

  return (
    <div>
      <Toolbar summary="Every question, counted over the current selection. Open answers are listed as written, never categorised.">
        <Button primary onClick={() => download(`responses-${stamp}.csv`, "﻿" + toCsv(rows), "text/csv")}>
          Download CSV
        </Button>
        <Button onClick={exportJson}>Download analysis JSON</Button>
      </Toolbar>
      <About
        items={[
          "n is the number of respondents who answered that question; shares are fractions of n.",
          "Multiple-choice shares add to more than 100% because one person may choose several options.",
          "Respondents with no planting experience were not asked b1, section C or section F; those questions simply have a smaller n.",
          "An option nobody chose is shown as 0, not as unimportant.",
        ]}
      />

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Tile label="Responses" value={String(rows.length)} note={rows.length !== total ? `of ${total}` : undefined} />
        <Tile label="Median time" value={med == null ? "–" : `${Math.round(med / 60)} min`} note={med == null ? undefined : `${Math.round(med)} s`} />
        <Tile label="Last response" value={last ? new Date(last).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "–"} />
      </div>

      {SECTIONS.map((section) => (
        <Section key={section.id} title={section.title}>
          {section.questions.map((q) => (
            <QuestionStats key={q.id} question={q} rows={rows} />
          ))}
        </Section>
      ))}

      <OpenResponses rows={rows} stamp={stamp} />
    </div>
  );
}

/** One question’s statistics. */
export function QuestionStats({ question: q, rows }: { question: Question; rows: ResponseRow[] }) {
  return (
    <div>
      <h3 className={T.item}>
        <span className="mr-2 text-mute">{q.id}</span>
        {q.text}
      </h3>
      <div className="mt-3 space-y-4">
        <Body q={q} rows={rows} />
      </div>
    </div>
  );
}

function Body({ q, rows }: { q: Question; rows: ResponseRow[] }) {
  switch (q.kind) {
    case "checkbox":
    case "single": {
      const { n, counts } = choiceStats(q, rows);
      const others = otherTexts(q, rows);
      return (
        <>
          <p className={T.meta}>n = {n}</p>
          <Bars items={counts} max={Math.max(...counts.map((c) => c.count), 1)} />
          {others.length > 0 && <TextList label="Other, as written" items={others} />}
        </>
      );
    }
    case "grid3": {
      const s = grid3Stats(q, rows);
      return (
        <>
          <p className={T.meta}>{s.answered} answered · each row counted over its own n</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${T.meta} pb-2 text-left font-medium`} />
                  <th className={`${T.meta} pb-2 pr-2 text-right font-medium`}>n</th>
                  {q.columns.map((c) => (
                    <th key={c.key} className={`${T.meta} pb-2 pr-2 text-right font-medium`}>
                      {c.label}
                    </th>
                  ))}
                  <th className={`${T.meta} pb-2 text-right font-medium`}>Must pass share</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="py-1.5 pr-3 text-ink">{r.label}</td>
                    <td className={`${T.num} py-1.5 pr-2 text-right`}>{r.n}</td>
                    {q.columns.map((c) => (
                      <td key={c.key} className="py-1.5 pr-2 text-right tabular-nums text-ink">
                        {r.counts[c.key] ?? 0}
                      </td>
                    ))}
                    <td className="py-1.5 text-right tabular-nums text-ink">
                      <span
                        className="inline-block min-w-[3rem] rounded-[4px] px-1.5 py-0.5"
                        style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(r.mustPassShare * 55)}%, transparent)` }}
                      >
                        {pct(r.mustPassShare)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    }
    case "shorttext":
    case "longtext": {
      const texts = rows.map((r) => openText(q.id, r)).filter(Boolean);
      return <TextList label={`${texts.length} answers, as written`} items={texts} />;
    }
    case "plantlist": {
      const lists = rows.map((r) => readPlantList(r.answers[q.id])).filter((l) => !l.notApplicable && l.entries.length > 0);
      const na = notApplicableCount(q.id, rows);
      const roleLabel = (k: string) => q.roles.find((r) => r.key === k)?.label ?? k;
      return (
        <TextList
          label={`${lists.length} lists, as written${na ? ` · ${na} not applicable` : ""}`}
          items={lists.map((l) => l.entries.map((e) => `${e.name} (${roleLabel(e.role) || "no role"}${e.why ? `: ${e.why}` : ""})`).join("; "))}
        />
      );
    }
    case "plantnote": {
      const notes = plantNotes(q.id, rows);
      const na = notApplicableCount(q.id, rows);
      return (
        <TextList
          label={`${notes.length} notes${na ? ` · ${na} not applicable` : ""}`}
          items={notes.map((n) => `${n.plant ?? "No plant"}: ${n.text}${n.basis ? ` [${basisLabel(q.id, n.basis)}]` : ""}`)}
        />
      );
    }
  }
}

type ExpFilter = "all" | "none" | "experienced";

/** Every open answer, verbatim, with the respondent’s group tags; filterable by experience; one CSV for all five questions. */
function OpenResponses({ rows, stamp }: { rows: ResponseRow[]; stamp: string }) {
  const [exp, setExp] = useState<ExpFilter>("all");
  const records = useMemo(() => {
    const out: { response_id: string; question: string; a1: string; a2: string; text: string; basis: string; hasNone: boolean }[] = [];
    for (const r of rows) {
      const tags = groupTags(r);
      const hasNone = ((r.answers.a2 as { selected?: string[] } | undefined)?.selected ?? []).includes("none");
      for (const id of OPEN_QUESTIONS) {
        const text = openText(id, r);
        const basis = id === "f2" ? basisLabel(id, (r.answers.f2 as { basis?: string } | undefined)?.basis ?? "") : "";
        if (text) out.push({ response_id: r.id, question: id, a1: tags.a1.join(" | "), a2: tags.a2.join(" | "), text, basis, hasNone });
      }
    }
    return out;
  }, [rows]);
  const shown = records.filter((rec) => exp === "all" || (exp === "none" ? rec.hasNone : !rec.hasNone));

  return (
    <Section title="Open responses" sub="Every free-text answer as written, with the respondent’s groups. Nothing is categorised or counted.">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${T.meta} w-24`}>Experience</span>
        <Chip on={exp === "all"} onClick={() => setExp("all")}>
          All
        </Chip>
        <Chip on={exp === "experienced"} onClick={() => setExp("experienced")}>
          Has experience
        </Chip>
        <Chip on={exp === "none"} onClick={() => setExp("none")}>
          None yet
        </Chip>
        <span className="flex-1" />
        <Button
          onClick={() =>
            download(
              `open-responses-${stamp}.csv`,
              "﻿" + csvOf(["response_id", "question", "a1", "a2", "text"], shown.map(({ response_id, question, a1, a2, text }) => ({ response_id, question, a1, a2, text }))),
              "text/csv",
            )
          }
        >
          Download open responses CSV
        </Button>
      </div>
      {OPEN_QUESTIONS.map((id) => {
        const q = ALL_QUESTIONS.find((x) => x.id === id)!;
        const items = shown.filter((rec) => rec.question === id);
        return (
          <div key={id}>
            <h3 className={T.item}>
              <span className="mr-2 text-mute">{id}</span>
              {q.text}
            </h3>
            {items.length === 0 ? (
              <p className={`${T.meta} mt-2`}>No answers in this selection.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {items.map((rec, i) => (
                  <li key={`${rec.response_id}-${i}`} className="rounded-md bg-chip px-3 py-2">
                    <p className={`${T.body} leading-snug`}>{rec.text}</p>
                    <p className={`${T.meta} mt-1`}>
                      {rec.a1 || "no role given"} · {rec.a2 || "no experience given"}
                      {rec.basis ? ` · based on: ${rec.basis}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </Section>
  );
}

function summarise(q: Question, rows: ResponseRow[]) {
  switch (q.kind) {
    case "checkbox":
    case "single": {
      const s = choiceStats(q, rows);
      return { id: q.id, text: q.text, n: s.n, counts: s.counts, other: otherTexts(q, rows) };
    }
    case "grid3": {
      const s = grid3Stats(q, rows);
      return { id: q.id, text: q.text, answered: s.answered, rows: s.rows };
    }
    case "shorttext":
    case "longtext":
      return { id: q.id, text: q.text, answers: rows.map((r) => ({ response_id: r.id, text: openText(q.id, r) })).filter((a) => a.text) };
    case "plantlist":
      return {
        id: q.id,
        text: q.text,
        lists: rows.map((r) => ({ response_id: r.id, ...readPlantList(r.answers[q.id]) })).filter((l) => l.notApplicable || l.entries.length > 0),
        not_applicable: notApplicableCount(q.id, rows),
      };
    case "plantnote":
      return { id: q.id, text: q.text, notes: plantNotes(q.id, rows), not_applicable: notApplicableCount(q.id, rows) };
  }
}

export { plantNames };

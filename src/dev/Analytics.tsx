import { ALL_QUESTIONS, QUESTIONS_VERSION, SECTIONS, type Question } from "../questions.ts";
import { listEntries, toCsv, type ResponseRow } from "../lib/answers.ts";
import { choiceStats, gridStats, median, otherTexts, plantNotes } from "../lib/analysis.ts";
import { download } from "./data.ts";
import { About, Bars, Button, GridTable, Section, T, TextList, Tile, Toolbar } from "./ui.tsx";

type Props = { rows: ResponseRow[]; total: number; meta: unknown };

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
      <Toolbar summary="Every question, counted over the current selection. Open answers are listed as written.">
        <Button primary onClick={() => download(`responses-${stamp}.csv`, "﻿" + toCsv(rows), "text/csv")}>
          Download CSV
        </Button>
        <Button onClick={exportJson}>Download analysis JSON</Button>
      </Toolbar>
      <About
        items={[
          "n is the number of respondents who answered that question; shares are fractions of n.",
          "Multiple-choice shares add to more than 100% because one person may choose several options.",
          "Q7 counts each row over the respondents who answered that row; not-applicable and missing answers are left out.",
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
    </div>
  );
}

/** One question’s statistics, the same block wherever it appears. */
export function QuestionStats({ question: q, rows }: { question: Question; rows: ResponseRow[] }) {
  const number = ALL_QUESTIONS.indexOf(q) + 1;
  return (
    <div>
      <h3 className={T.item}>
        <span className="mr-2 text-mute">{number}</span>
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
      const { n, counts, unknown } = choiceStats(q, rows);
      const others = otherTexts(q, rows);
      return (
        <>
          <p className={T.meta}>
            n = {n}
            {unknown > 0 ? ` · ${unknown} selection${unknown === 1 ? "" : "s"} from an earlier version not counted` : ""}
          </p>
          <Bars items={counts} max={Math.max(...counts.map((c) => c.count), 1)} />
          {others.length > 0 && <TextList label="Other, as written" items={others} />}
        </>
      );
    }
    case "grid": {
      const s = gridStats(q, rows);
      return (
        <>
          <p className={T.meta}>
            {s.answered} answered · {s.notApplicable} not applicable · each row counted over its own n
          </p>
          <GridTable columns={q.columns} rows={s.rows} />
        </>
      );
    }
    case "textlist": {
      const lists = rows.map((r) => listEntries(r.answers[q.id])).filter((l) => l.length > 0);
      return <TextList label={`${lists.length} lists, as written`} items={lists.map((l) => l.join(", "))} />;
    }
    case "plantnote": {
      const notes = plantNotes(q.id, rows);
      const unassigned = notes.filter((n) => n.plant === null).length;
      return (
        <TextList
          label={`${notes.length} notes${unassigned ? ` · ${unassigned} without a plant attached (earlier version)` : ""}`}
          items={notes.map((n) => `${n.plant ?? "Unassigned"}: ${n.text}`)}
        />
      );
    }
  }
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

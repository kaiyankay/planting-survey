/**
 * Pure statistics over stored responses, shared by the developer mode, the
 * exports and the tests. One rule throughout: shares are fractions of the
 * respondents who answered the question (n), never of all responses, and
 * an option nobody chose is reported as zero, not as unimportant.
 */
import type { CheckboxQuestion, Grid3Question, SingleQuestion } from "../questions.ts";
import { normalizePlantName, plantNames, readPlantList, readPlantNote, readText, type ChoiceAnswer, type GridAnswer, type ResponseRow } from "./answers.ts";

export { normalizePlantName };

export type Count = { key: string; label: string; count: number; share: number };
export type ChoiceStats = { n: number; counts: Count[] };

export function choiceStats(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): ChoiceStats {
  const answers = rows.map((r) => r.answers[q.id] as ChoiceAnswer | undefined).filter((a): a is ChoiceAnswer => Boolean(a && a.selected.length > 0));
  const n = answers.length;
  const counts = q.options.map((o) => {
    const count = answers.filter((a) => a.selected.includes(o.key)).length;
    return { key: o.key, label: o.label, count, share: n ? count / n : 0 };
  });
  return { n, counts };
}

/** Free text typed into an "Other" option, one entry per response that gave some. */
export function otherTexts(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): string[] {
  return rows.map((r) => (r.answers[q.id] as ChoiceAnswer | undefined)?.other?.trim() ?? "").filter((t) => t.length > 0);
}

export type Grid3RowStats = {
  key: string;
  label: string;
  /** Respondents who answered this row. */
  n: number;
  counts: Record<string, number>;
  /** Share of n who said “must pass”. */
  mustPassShare: number;
};

export function grid3Stats(q: Grid3Question, rows: ResponseRow[]): { answered: number; rows: Grid3RowStats[] } {
  const grids = rows.map((r) => r.answers[q.id] as GridAnswer | undefined).filter((g): g is GridAnswer => Boolean(g && Object.keys(g).length > 0));
  return {
    answered: grids.length,
    rows: q.rows.map((row) => {
      const withRow = grids.filter((g) => Boolean(g[row.key]));
      const n = withRow.length;
      const counts: Record<string, number> = {};
      for (const c of q.columns) counts[c.key] = withRow.filter((g) => g[row.key] === c.key).length;
      return { key: row.key, label: row.label, n, counts, mustPassShare: n ? (counts.must_pass ?? 0) / n : 0 };
    }),
  };
}

export type PlantTally = { name: string; count: number; spellings: string[]; roles: Record<string, number> };

/** Plants named in a plant list, grouped by name (case and spacing ignored), most mentioned first. Not-applicable lists add nothing. */
export function plantTally(questionId: string, rows: ResponseRow[]): PlantTally[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number>; roles: Record<string, number> }>();
  for (const r of rows) {
    const list = readPlantList(r.answers[questionId]);
    if (list.notApplicable) continue;
    const seen = new Set<string>();
    for (const e of list.entries) {
      const key = normalizePlantName(e.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(key) ?? { count: 0, spellings: new Map<string, number>(), roles: {} as Record<string, number> };
      g.count++;
      g.spellings.set(e.name, (g.spellings.get(e.name) ?? 0) + 1);
      if (e.role) g.roles[e.role] = (g.roles[e.role] ?? 0) + 1;
      groups.set(key, g);
    }
  }
  return [...groups.values()]
    .map((g) => {
      const spellings = [...g.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
      return { name: spellings[0], count: g.count, spellings, roles: g.roles };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Plant notes with the plant they were attached to. Not-applicable answers are left out. */
export function plantNotes(questionId: string, rows: ResponseRow[]): { response_id: string; plant: string | null; text: string }[] {
  return rows
    .map((r) => ({ response_id: r.id, ...readPlantNote(r.answers[questionId]) }))
    .filter((n) => !n.notApplicable && n.text.length > 0)
    .map(({ response_id, plant, text }) => ({ response_id, plant, text }));
}

/** How many respondents answered a plant list or plant note with “not applicable”. */
export function notApplicableCount(questionId: string, rows: ResponseRow[]): number {
  return rows.filter((r) => readPlantList(r.answers[questionId]).notApplicable || readPlantNote(r.answers[questionId]).notApplicable).length;
}

/** The text of an open answer, whatever its kind: short, long, or a plant note. Empty when not given. */
export function openText(questionId: string, r: ResponseRow): string {
  const a = r.answers[questionId];
  if (typeof a === "string") return readText(a);
  const note = readPlantNote(a);
  return note.notApplicable ? "" : note.text;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export { plantNames };

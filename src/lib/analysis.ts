/**
 * Pure statistics over stored responses, shared by the developer mode, the
 * exports and the tests. One rule throughout: shares are fractions of the
 * respondents who answered the question (n), never of all responses, and
 * an option nobody chose is reported as zero, not as unimportant.
 */
import type { CheckboxQuestion, GridQuestion, SingleQuestion } from "../questions.ts";
import { GRID_NA, listEntries, readPlantNote, type ChoiceAnswer, type GridAnswer, type ResponseRow } from "./answers.ts";

export type Count = { key: string; label: string; count: number; share: number };

export type ChoiceStats = {
  /** Respondents who chose at least one option. */
  n: number;
  counts: Count[];
  /** Selections whose option key is not in the current questionnaire (earlier versions). */
  unknown: number;
};

export function choiceStats(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): ChoiceStats {
  const answers = rows.map((r) => r.answers[q.id] as ChoiceAnswer | undefined).filter((a): a is ChoiceAnswer => Boolean(a && a.selected.length > 0));
  const n = answers.length;
  const known = new Set(q.options.map((o) => o.key));
  let unknown = 0;
  for (const a of answers) for (const k of a.selected) if (!known.has(k)) unknown++;
  const counts = q.options.map((o) => {
    const count = answers.filter((a) => a.selected.includes(o.key)).length;
    return { key: o.key, label: o.label, count, share: n ? count / n : 0 };
  });
  return { n, counts, unknown };
}

/** Free text typed into an "Other" option, one entry per response that gave some. */
export function otherTexts(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): string[] {
  return rows
    .map((r) => (r.answers[q.id] as ChoiceAnswer | undefined)?.other?.trim() ?? "")
    .filter((t) => t.length > 0);
}

export type GridRowStats = {
  key: string;
  label: string;
  /** Respondents who answered this row (excludes not-applicable and missing). */
  n: number;
  cells: { col: string; count: number; share: number }[];
};

export type GridStats = {
  /** Respondents who answered the question in any way, including not-applicable. */
  answered: number;
  notApplicable: number;
  rows: GridRowStats[];
};

export function gridStats(q: GridQuestion, rows: ResponseRow[]): GridStats {
  const grids = rows.map((r) => r.answers[q.id] as GridAnswer | undefined).filter((g): g is GridAnswer => Boolean(g && Object.keys(g).length > 0));
  const notApplicable = grids.filter((g) => g[GRID_NA] === "yes").length;
  const usable = grids.filter((g) => g[GRID_NA] !== "yes");
  return {
    answered: grids.length,
    notApplicable,
    rows: q.rows.map((row) => {
      const withRow = usable.filter((g) => Boolean(g[row.key]));
      const n = withRow.length;
      return {
        key: row.key,
        label: row.label,
        n,
        cells: q.columns.map((col) => {
          const count = withRow.filter((g) => g[row.key] === col.key).length;
          return { col: col.key, count, share: n ? count / n : 0 };
        }),
      };
    }),
  };
}

export type PlantEntry = { name: string; count: number; spellings: string[] };

/** Case- and whitespace-insensitive key for grouping plant names. Nothing more: no fuzzy matching. */
export function normalizePlantName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’“”"]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s'.,;:-]+|[\s'.,;:-]+$/g, "")
    .trim();
}

/** Tally of plants named in a text-list question, grouped by normalized name, most common first. */
export function plantTally(questionId: string, rows: ResponseRow[]): PlantEntry[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const r of rows) {
    const seen = new Set<string>();
    for (const raw of listEntries(r.answers[questionId])) {
      const key = normalizePlantName(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(key) ?? { count: 0, spellings: new Map() };
      g.count++;
      g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
      groups.set(key, g);
    }
  }
  return [...groups.entries()]
    .map(([, g]) => {
      const spellings = [...g.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
      return { name: spellings[0], count: g.count, spellings };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Plant notes with the plant they were explicitly attached to; legacy notes come back with plant null. */
export function plantNotes(questionId: string, rows: ResponseRow[]): { response_id: string; plant: string | null; text: string; legacy: boolean }[] {
  return rows
    .map((r) => ({ response_id: r.id, ...readPlantNote(r.answers[questionId]) }))
    .filter((n) => n.text.length > 0);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Questionnaire versions present in a set of rows, newest first. */
export function versionsIn(rows: ResponseRow[]): number[] {
  return [...new Set(rows.map((r) => r.questions_version ?? 0))].sort((a, b) => b - a);
}

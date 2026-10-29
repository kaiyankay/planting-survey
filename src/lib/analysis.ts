/**
 * Pure analysis over stored responses, shared by the developer mode and tests.
 */
import type { CheckboxQuestion, GridQuestion, SingleQuestion } from "../questions.ts";
import { GRID_NA, type ChoiceAnswer, type GridAnswer, type ResponseRow, type TextListAnswer } from "./answers.ts";

export type Count = { key: string; label: string; count: number; share: number };

/** Counts per option; `share` is the fraction of respondents who chose it. */
export function choiceCounts(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): Count[] {
  const n = rows.length || 1;
  return q.options.map((o) => {
    const count = rows.filter((r) => (r.answers[q.id] as ChoiceAnswer | undefined)?.selected.includes(o.key)).length;
    return { key: o.key, label: o.label, count, share: count / n };
  });
}

/** Free text typed into an "Other" option, one entry per response that gave some. */
export function otherTexts(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): string[] {
  return rows
    .map((r) => (r.answers[q.id] as ChoiceAnswer | undefined)?.other?.trim() ?? "")
    .filter((t) => t.length > 0);
}

export type GridCell = { row: string; col: string; count: number; share: number };

export function gridCounts(q: GridQuestion, rows: ResponseRow[]): GridCell[] {
  const n = rows.length || 1;
  const out: GridCell[] = [];
  for (const row of q.rows) {
    for (const col of q.columns) {
      const count = rows.filter((r) => (r.answers[q.id] as GridAnswer | undefined)?.[row.key] === col.key).length;
      out.push({ row: row.key, col: col.key, count, share: count / n });
    }
  }
  return out;
}

/** How many respondents marked the whole grid as not applicable. */
export function gridNotApplicable(q: GridQuestion, rows: ResponseRow[]): number {
  return rows.filter((r) => (r.answers[q.id] as GridAnswer | undefined)?.[GRID_NA] === "yes").length;
}

export type PlantEntry = { name: string; count: number; spellings: string[] };

/** Case- and whitespace-insensitive key for grouping plant names. */
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
    const list = (r.answers[questionId] as TextListAnswer | undefined) ?? [];
    const seen = new Set<string>();
    for (const raw of list) {
      const key = normalizePlantName(raw ?? "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(key) ?? { count: 0, spellings: new Map() };
      g.count++;
      const spelling = raw.trim().replace(/\s+/g, " ");
      g.spellings.set(spelling, (g.spellings.get(spelling) ?? 0) + 1);
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

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

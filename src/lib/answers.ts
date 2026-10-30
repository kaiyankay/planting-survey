/**
 * Answer shapes as stored in the `answers` jsonb column, plus the pure
 * functions shared by the app (validation) and the exports (CSV).
 * No React or browser APIs in here.
 */
import { ALL_QUESTIONS, type Question } from "../questions.ts";

export type ChoiceAnswer = { selected: string[]; other?: string };
/** Row key → column key. The reserved key `na` set to "yes" marks the grid as not applicable. */
export type GridAnswer = Record<string, string>;
/**
 * A plant list: the names as typed (versions 1–4 stored the bare array).
 * From version 5 a respondent may instead say they cannot name enough
 * plants yet; the names they had typed are kept so they can change their mind.
 */
export type TextListAnswer = string[] | { not_applicable: true; entries: string[] };
/**
 * Version 3+: which of the respondent’s own plants the note is about, and the
 * note. Version 5 adds the not-applicable form, only valid when the plant list
 * itself is not applicable.
 */
export type PlantNoteAnswer = { plant: string; text: string } | { not_applicable: true };
/** Versions 1 and 2 stored the note alone, with no plant attached. */
export type LegacyTextAnswer = string;

export type Answer = ChoiceAnswer | GridAnswer | TextListAnswer | PlantNoteAnswer | LegacyTextAnswer;
export type Answers = Record<string, Answer>;

export const GRID_NA = "na";

/** Case- and whitespace-insensitive key for comparing plant names. Nothing more: no fuzzy matching. */
export function normalizePlantName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’“”"]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s'.,;:-]+|[\s'.,;:-]+$/g, "")
    .trim();
}

const clean = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "");

/** Reads a plant list in either format. */
export function readList(a: Answer | undefined): { entries: string[]; notApplicable: boolean } {
  if (a == null) return { entries: [], notApplicable: false };
  if (Array.isArray(a)) return { entries: a.map(clean).filter(Boolean), notApplicable: false };
  if (typeof a === "object" && "not_applicable" in a && "entries" in a) {
    return { entries: ((a as { entries: unknown[] }).entries ?? []).map(clean).filter(Boolean), notApplicable: true };
  }
  return { entries: [], notApplicable: false };
}

/** Non-empty entries of a plant list, trimmed, in order. Empty when the list is marked not applicable. */
export function listEntries(a: Answer | undefined): string[] {
  const l = readList(a);
  return l.notApplicable ? [] : l.entries;
}

/** Entries with duplicates removed, comparing without case or extra spaces; the first spelling is kept. */
export function distinctEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const key = normalizePlantName(e);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Reads a plant note in any format. `plant` is null when no plant is attached. */
export function readPlantNote(a: Answer | undefined): { plant: string | null; text: string; legacy: boolean; notApplicable: boolean } {
  if (a == null) return { plant: null, text: "", legacy: false, notApplicable: false };
  if (typeof a === "string") return { plant: null, text: a.trim(), legacy: true, notApplicable: false };
  if (typeof a === "object" && !Array.isArray(a)) {
    if ("not_applicable" in a && !("entries" in a)) return { plant: null, text: "", legacy: false, notApplicable: true };
    if ("text" in a) {
      const p = clean((a as { plant?: string }).plant);
      return { plant: p ? p : null, text: ((a as { text?: string }).text ?? "").trim(), legacy: false, notApplicable: false };
    }
  }
  return { plant: null, text: "", legacy: false, notApplicable: false };
}

/** Whether the note’s plant is on the respondent’s own list (when the whole answer set is available). */
function plantOnList(q: Question & { kind: "plantnote" }, plant: string | null, all?: Answers): boolean {
  if (!plant) return false;
  if (!all) return true;
  return listEntries(all[q.sourceQuestion]).some((x) => normalizePlantName(x) === normalizePlantName(plant));
}

/**
 * True when the question has enough of an answer to count as done. Every
 * question is required. Pass all answers so a plant note can be judged
 * against the plant list it depends on.
 */
export function isComplete(q: Question, a: Answer | undefined, all?: Answers): boolean {
  switch (q.kind) {
    case "checkbox":
    case "single": {
      const c = a as ChoiceAnswer | undefined;
      return Boolean(c && c.selected.length > 0);
    }
    case "grid": {
      const g = (a as GridAnswer | undefined) ?? {};
      if (g[GRID_NA] === "yes") return true;
      return q.rows.every((r) => Boolean(g[r.key]));
    }
    case "textlist": {
      const l = readList(a);
      return l.notApplicable || distinctEntries(l.entries).length >= q.min;
    }
    case "plantnote": {
      const note = readPlantNote(a);
      const sourceNa = all ? readList(all[q.sourceQuestion]).notApplicable : false;
      // Path B: the list is not applicable, so the note must say so too.
      if (sourceNa) return note.notApplicable;
      // Path A: a real note about a plant that is still on the list.
      return !note.notApplicable && note.text.length > 0 && plantOnList(q, note.plant, all);
    }
  }
}

/** Same as isComplete: only a finished question counts as answered. */
export function hasAnswer(q: Question, a: Answer | undefined, all?: Answers): boolean {
  return isComplete(q, a, all);
}

/** One-line hint shown under a question that still needs an answer. */
export function missingHint(q: Question, a?: Answer, all?: Answers): string {
  switch (q.kind) {
    case "checkbox":
      return "Choose at least one";
    case "single":
      return "Choose one";
    case "grid":
      return "Answer each row";
    case "textlist": {
      const l = readList(a);
      if (l.entries.length >= q.min && distinctEntries(l.entries).length < q.min) return `Please list ${q.min} different plants`;
      return `Please list at least ${q.min} plants`;
    }
    case "plantnote": {
      const sourceNa = all ? readList(all[q.sourceQuestion]).notApplicable : false;
      if (sourceNa) return "Tick the option above to continue";
      return "Choose one of your plants above and write a few words about it";
    }
  }
}

/** CSV column headers, in order, for the flattened export. */
export function csvColumns(): string[] {
  const cols = ["id", "submitted_at", "duration_seconds", "questions_version"];
  for (const q of ALL_QUESTIONS) {
    switch (q.kind) {
      case "grid":
        for (const r of q.rows) cols.push(`${q.id}_${r.key}`);
        break;
      case "textlist":
        for (let i = 1; i <= q.count; i++) cols.push(`${q.id}_${i}`);
        cols.push(`${q.id}_not_applicable`);
        break;
      case "plantnote":
        cols.push(`${q.id}_plant`, q.id);
        break;
      default:
        cols.push(q.id);
    }
  }
  return cols;
}

function labelOf(q: { options: { key: string; label: string; other?: boolean }[] }, key: string, other?: string) {
  const opt = q.options.find((o) => o.key === key);
  if (!opt) return key;
  if (opt.other && other && other.trim()) return `${opt.label}: ${other.trim()}`;
  return opt.label;
}

export type ResponseRow = {
  id: string;
  submitted_at: string;
  duration_seconds: number | null;
  questions_version?: number | null;
  answers: Answers;
};

/**
 * Flattens one stored response into a string per CSV column. Answer keys that
 * no longer exist in the questionnaire (for example q12 and q13 from version 1)
 * are left out rather than mapped onto other columns. A version 1 or 2 plant
 * note has no plant, so its plant column reads "Unassigned". A plant list or
 * note marked not applicable says "Not applicable"; an unanswered one is blank.
 */
export function flattenResponse(row: ResponseRow): Record<string, string> {
  const out: Record<string, string> = {
    id: row.id,
    submitted_at: row.submitted_at,
    duration_seconds: row.duration_seconds == null ? "" : String(row.duration_seconds),
    questions_version: row.questions_version == null ? "" : String(row.questions_version),
  };
  const answers = row.answers ?? {};
  for (const q of ALL_QUESTIONS) {
    const a = answers[q.id];
    switch (q.kind) {
      case "checkbox":
      case "single": {
        const c = a as ChoiceAnswer | undefined;
        out[q.id] = c ? c.selected.map((k) => labelOf(q, k, c.other)).join(" | ") : "";
        break;
      }
      case "grid": {
        const g = (a as GridAnswer | undefined) ?? {};
        const na = g[GRID_NA] === "yes";
        for (const r of q.rows) {
          const col = q.columns.find((c) => c.key === g[r.key]);
          out[`${q.id}_${r.key}`] = na ? "Not applicable" : col ? col.label : "";
        }
        break;
      }
      case "textlist": {
        const l = readList(a);
        const raw = Array.isArray(a) ? a : l.notApplicable ? (a as { entries: string[] }).entries ?? [] : [];
        for (let i = 1; i <= q.count; i++) out[`${q.id}_${i}`] = l.notApplicable ? "" : clean(raw[i - 1]);
        out[`${q.id}_not_applicable`] = l.notApplicable ? "Not applicable" : "";
        break;
      }
      case "plantnote": {
        const n = readPlantNote(a);
        out[`${q.id}_plant`] = n.notApplicable ? "Not applicable" : n.text ? (n.plant ?? "Unassigned") : "";
        out[q.id] = n.text;
        break;
      }
    }
  }
  return out;
}

export function toCsv(rows: ResponseRow[]): string {
  const cols = csvColumns();
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [cols.join(",")];
  for (const row of rows) {
    const flat = flattenResponse(row);
    lines.push(cols.map((c) => esc(flat[c] ?? "")).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

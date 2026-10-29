/**
 * Answer shapes as stored in the `answers` jsonb column, plus the pure
 * functions shared by the app (validation) and the exports (CSV).
 * No React or browser APIs in here.
 */
import { ALL_QUESTIONS, type Question } from "../questions.ts";

export type ChoiceAnswer = { selected: string[]; other?: string };
/** Row key → column key. The reserved key `na` set to "yes" marks the grid as not applicable. */
export type GridAnswer = Record<string, string>;
export type TextListAnswer = string[];
/** Version 3: which of the respondent’s own plants the note is about, and the note. */
export type PlantNoteAnswer = { plant: string; text: string };
/** Versions 1 and 2 stored the note alone, with no plant attached. */
export type LegacyTextAnswer = string;

export type Answer = ChoiceAnswer | GridAnswer | TextListAnswer | PlantNoteAnswer | LegacyTextAnswer;
export type Answers = Record<string, Answer>;

export const GRID_NA = "na";

/** Reads a plant note in either format. `plant` is null when the old format gave no plant. */
export function readPlantNote(a: Answer | undefined): { plant: string | null; text: string; legacy: boolean } {
  if (a == null) return { plant: null, text: "", legacy: false };
  if (typeof a === "string") return { plant: null, text: a.trim(), legacy: true };
  if (typeof a === "object" && !Array.isArray(a) && "text" in a) {
    const p = (a as PlantNoteAnswer).plant?.trim() ?? "";
    return { plant: p ? p : null, text: ((a as PlantNoteAnswer).text ?? "").trim(), legacy: false };
  }
  return { plant: null, text: "", legacy: false };
}

/** Non-empty entries of a text list, trimmed, in order. */
export function listEntries(a: Answer | undefined): string[] {
  return ((a as TextListAnswer | undefined) ?? []).map((s) => (s ?? "").trim().replace(/\s+/g, " ")).filter(Boolean);
}

/** True when the question has enough of an answer to count as done. Optional questions are always complete. */
export function isComplete(q: Question, a: Answer | undefined): boolean {
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
    case "textlist":
    case "plantnote":
      return true;
  }
}

/** True when the respondent has put something in, including for optional questions. */
export function hasAnswer(q: Question, a: Answer | undefined): boolean {
  switch (q.kind) {
    case "textlist":
      return listEntries(a).length > 0;
    case "plantnote":
      return readPlantNote(a).text.length > 0;
    default:
      return isComplete(q, a);
  }
}

/** Whether the respondent answered at all (the base for statistics). Grid: any cell or not-applicable. */
export function answered(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  return hasAnswer(q, a);
}

/** One-line hint shown under a question that still needs an answer. */
export function missingHint(q: Question): string {
  switch (q.kind) {
    case "checkbox":
      return "Choose at least one.";
    case "single":
      return "Choose one.";
    case "grid":
      return "Answer each row.";
    default:
      return "";
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
 * note has no plant, so its plant column reads "Unassigned".
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
        const t = (a as TextListAnswer | undefined) ?? [];
        for (let i = 1; i <= q.count; i++) out[`${q.id}_${i}`] = (t[i - 1] ?? "").trim();
        break;
      }
      case "plantnote": {
        const n = readPlantNote(a);
        out[`${q.id}_plant`] = n.text ? (n.plant ?? "Unassigned") : "";
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

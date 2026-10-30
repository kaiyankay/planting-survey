/**
 * Answer shapes as stored in the `answers` jsonb column, plus the pure
 * functions shared by the app (visibility, validation) and the exports (CSV).
 * No React or browser APIs in here.
 */
import { ALL_QUESTIONS, EXPERIENCE, SECTIONS, type PlantListQuestion, type PlantNoteQuestion, type Question } from "../questions.ts";

export type ChoiceAnswer = { selected: string[]; other?: string };
/** Row key → column key. */
export type GridAnswer = Record<string, string>;
export type TextAnswer = string;
export type PlantEntry = { name: string; role: string; why?: string };
/** The plant rows as typed, or the admission that none apply (typed rows are kept so the respondent can change their mind). */
export type PlantListAnswer = { not_applicable?: true; entries: PlantEntry[] };
/** A note about one listed plant, with how the knowledge was acquired (basis); or not applicable when the list is. */
export type PlantNoteAnswer = { plant: string; text: string; basis: string } | { not_applicable: true };

export type Answer = ChoiceAnswer | GridAnswer | TextAnswer | PlantListAnswer | PlantNoteAnswer;
export type Answers = Record<string, Answer>;

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

// ---------------------------------------------------------------------------
// Reading answers
// ---------------------------------------------------------------------------

export function readText(a: Answer | undefined): string {
  return typeof a === "string" ? a.trim() : "";
}

/** Rows with a name, cleaned, in order; plus whether the list was marked not applicable. */
export function readPlantList(a: Answer | undefined): { entries: PlantEntry[]; notApplicable: boolean } {
  if (!a || typeof a !== "object" || Array.isArray(a) || !("entries" in a)) return { entries: [], notApplicable: false };
  const raw = Array.isArray((a as PlantListAnswer).entries) ? (a as PlantListAnswer).entries : [];
  const entries = raw
    .map((e) => ({ name: clean(e?.name), role: clean(e?.role), why: clean(e?.why) || undefined }))
    .filter((e) => e.name.length > 0);
  return { entries, notApplicable: (a as PlantListAnswer).not_applicable === true };
}

/** Plant names from a list, empty when the list is not applicable. */
export function plantNames(a: Answer | undefined): string[] {
  const l = readPlantList(a);
  return l.notApplicable ? [] : l.entries.map((e) => e.name);
}

/** Entries with duplicate names removed, comparing without case or extra spaces; the first spelling is kept. */
export function distinctEntries(entries: PlantEntry[]): PlantEntry[] {
  const seen = new Set<string>();
  const out: PlantEntry[] = [];
  for (const e of entries) {
    const key = normalizePlantName(e.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function readPlantNote(a: Answer | undefined): { plant: string | null; text: string; basis: string; notApplicable: boolean } {
  if (!a || typeof a !== "object" || Array.isArray(a)) return { plant: null, text: "", basis: "", notApplicable: false };
  if ("not_applicable" in a && !("entries" in a) && !("text" in a)) return { plant: null, text: "", basis: "", notApplicable: true };
  if ("text" in a) {
    const p = clean((a as { plant?: string }).plant);
    return { plant: p || null, text: ((a as { text?: string }).text ?? "").trim(), basis: clean((a as { basis?: string }).basis), notApplicable: false };
  }
  return { plant: null, text: "", basis: "", notApplicable: false };
}

// ---------------------------------------------------------------------------
// Which questions a respondent is asked
// ---------------------------------------------------------------------------

/** False only when the experience question was answered with “None yet” alone. */
export function hasExperience(answers: Answers): boolean {
  const sel = (answers[EXPERIENCE.question] as ChoiceAnswer | undefined)?.selected ?? [];
  return !(sel.length === 1 && sel[0] === EXPERIENCE.none);
}

export function isShown(q: Question, answers: Answers): boolean {
  if (hasExperience(answers)) return true;
  const section = SECTIONS.find((s) => s.questions.includes(q));
  return !(q.requiresExperience || section?.requiresExperience);
}

/** The questions this respondent is asked, in order. Page numbers follow this list. */
export function visibleQuestions(answers: Answers): Question[] {
  return ALL_QUESTIONS.filter((q) => isShown(q, answers));
}

/** Whether a question must be answered before submitting. */
export function isRequired(q: Question): boolean {
  return q.kind === "shorttext" || q.kind === "longtext" ? q.required : true;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function plantListComplete(q: PlantListQuestion, a: Answer | undefined): boolean {
  const l = readPlantList(a);
  if (l.notApplicable) return true;
  const roles = new Set(q.roles.map((r) => r.key));
  return distinctEntries(l.entries).filter((e) => roles.has(e.role)).length >= q.min;
}

function plantNoteComplete(q: PlantNoteQuestion, a: Answer | undefined, all?: Answers): boolean {
  const note = readPlantNote(a);
  const source = all ? readPlantList(all[q.sourceQuestion]) : null;
  if (source?.notApplicable) return note.notApplicable;
  if (note.notApplicable || !note.text || !note.plant) return false;
  if (!q.basis.options.some((o) => o.key === note.basis)) return false;
  if (!source) return true;
  return source.entries.some((e) => normalizePlantName(e.name) === normalizePlantName(note.plant!));
}

/**
 * True when the question is answered well enough to submit. Optional text
 * questions are always complete. Pass all answers so a plant note can be
 * judged against the list it depends on.
 */
export function isComplete(q: Question, a: Answer | undefined, all?: Answers): boolean {
  switch (q.kind) {
    case "checkbox":
    case "single":
      return ((a as ChoiceAnswer | undefined)?.selected.length ?? 0) > 0;
    case "grid3": {
      const g = (a as GridAnswer | undefined) ?? {};
      return q.rows.every((r) => Boolean(g[r.key]));
    }
    case "shorttext":
    case "longtext":
      return q.required ? readText(a).length > 0 : true;
    case "plantlist":
      return plantListComplete(q, a);
    case "plantnote":
      return plantNoteComplete(q, a, all);
  }
}

/** Counts towards progress: a complete answer, or for optional text any text at all. */
export function hasAnswer(q: Question, a: Answer | undefined, all?: Answers): boolean {
  if ((q.kind === "shorttext" || q.kind === "longtext") && !q.required) return readText(a).length > 0;
  return isComplete(q, a, all);
}

/** One-line hint shown under a question that still needs an answer. */
export function missingHint(q: Question, a?: Answer, all?: Answers): string {
  switch (q.kind) {
    case "checkbox":
      return "Choose at least one";
    case "single":
      return "Choose one";
    case "grid3":
      return "Answer each row";
    case "shorttext":
    case "longtext":
      return "Please write something here";
    case "plantlist": {
      const l = readPlantList(a);
      const roles = new Set(q.roles.map((r) => r.key));
      const distinct = distinctEntries(l.entries);
      if (l.entries.length >= q.min && distinct.length < q.min) return `Please list ${q.min} different plants`;
      if (distinct.length >= q.min && distinct.filter((e) => roles.has(e.role)).length < q.min) return "Choose a role for each plant";
      return `Please list at least ${q.min} plant${q.min === 1 ? "" : "s"}, each with a role`;
    }
    case "plantnote": {
      const sourceNa = all ? readPlantList(all[q.sourceQuestion]).notApplicable : false;
      if (sourceNa) return "Tick the option above to continue";
      const note = readPlantNote(a);
      if (note.plant && note.text && !note.basis) return "Say what this note is based on";
      return "Choose one of your plants above, write the note and say what it is based on";
    }
  }
}

// ---------------------------------------------------------------------------
// Submission and export
// ---------------------------------------------------------------------------

/** The answers to store: only the questions this respondent was shown. Hidden questions are omitted. */
export function answersToStore(answers: Answers): Answers {
  const out: Answers = {};
  for (const q of visibleQuestions(answers)) {
    const a = answers[q.id];
    if (a === undefined) continue;
    // Plant rows left empty are just unused rows, not answers.
    if (q.kind === "plantlist") {
      const l = readPlantList(a);
      out[q.id] = l.notApplicable ? { not_applicable: true, entries: l.entries } : { entries: l.entries };
    } else out[q.id] = a;
  }
  return out;
}

/** CSV column headers, in order, for the flattened export. */
export function csvColumns(): string[] {
  const cols = ["id", "submitted_at", "duration_seconds", "questions_version"];
  for (const q of ALL_QUESTIONS) {
    switch (q.kind) {
      case "grid3":
        for (const r of q.rows) cols.push(`${q.id}_${r.key}`);
        break;
      case "plantlist":
        for (let i = 1; i <= q.count; i++) cols.push(`${q.id}_${i}_name`, `${q.id}_${i}_role`, `${q.id}_${i}_why`);
        cols.push(`${q.id}_not_applicable`);
        break;
      case "plantnote":
        cols.push(`${q.id}_plant`, q.id, `${q.id}_basis`);
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
 * Flattens one stored response into a string per CSV column. Questions the
 * respondent was not shown are blank; a plant list or note marked not
 * applicable says "Not applicable".
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
      case "grid3": {
        const g = (a as GridAnswer | undefined) ?? {};
        for (const r of q.rows) out[`${q.id}_${r.key}`] = q.columns.find((c) => c.key === g[r.key])?.label ?? "";
        break;
      }
      case "shorttext":
      case "longtext":
        out[q.id] = readText(a);
        break;
      case "plantlist": {
        const l = readPlantList(a);
        const roleLabel = (k: string) => q.roles.find((r) => r.key === k)?.label ?? k;
        for (let i = 1; i <= q.count; i++) {
          const e = l.notApplicable ? undefined : l.entries[i - 1];
          out[`${q.id}_${i}_name`] = e?.name ?? "";
          out[`${q.id}_${i}_role`] = e ? roleLabel(e.role) : "";
          out[`${q.id}_${i}_why`] = e?.why ?? "";
        }
        out[`${q.id}_not_applicable`] = l.notApplicable ? "Not applicable" : "";
        break;
      }
      case "plantnote": {
        const n = readPlantNote(a);
        out[`${q.id}_plant`] = n.notApplicable ? "Not applicable" : (n.plant ?? "");
        out[q.id] = n.text;
        out[`${q.id}_basis`] = n.notApplicable ? "Not applicable" : (q.basis.options.find((o) => o.key === n.basis)?.label ?? "");
        break;
      }
    }
  }
  return out;
}

export function toCsv(rows: ResponseRow[]): string {
  return csvOf(csvColumns(), rows.map(flattenResponse));
}

/** Generic CSV writer: the same escaping for every export. */
export function csvOf(cols: string[], records: Record<string, string>[]): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [cols.join(",")];
  for (const r of records) lines.push(cols.map((c) => esc(r[c] ?? "")).join(","));
  return lines.join("\r\n") + "\r\n";
}

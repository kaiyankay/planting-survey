/**
 * Plant candidates for the first prototype database, built from the plants
 * respondents named (q14) and the note they attached to one of them (q15),
 * combined with the reviewers’ decisions (merges, status, notes).
 * Pure functions; no I/O.
 *
 * Two kinds of information are kept apart throughout:
 *  - respondent-provided: names as typed, which plants were listed together,
 *    and the note a respondent explicitly attached to one plant;
 *  - researcher-reviewed: merges, the reviewed name, shortlist status, notes.
 *
 * Nothing here verifies a plant. Shortlisted means chosen for the prototype,
 * not botanically checked. Names are grouped only by case and spacing; a
 * common name and a scientific name become one candidate only when a
 * reviewer merges them.
 */
import { listEntries, readPlantNote, type ResponseRow } from "./answers.ts";
import { normalizePlantName } from "./analysis.ts";
import type { Review, ReviewStatus } from "../dev/data.ts";

export type Source = {
  response_id: string;
  submitted_at: string;
  /** The name as this respondent typed it. */
  raw_name: string;
  /** The other plants in the same list, as typed. */
  listed_with: string[];
  /** The respondent’s note, only when they attached it to this plant. */
  note: string | null;
};

/** A note that cannot be tied to one plant: written under questionnaire version 1 or 2. */
export type UnassignedNote = { response_id: string; submitted_at: string; listed: string[]; text: string };

export type Candidate = {
  /** Normalized key of the group (after merges, the target’s key). */
  key: string;
  /** Reviewed name if set, else the most common spelling. */
  name: string;
  reviewed_name: string | null;
  /** Every spelling respondents used, most common first. */
  raw_names: string[];
  /** Keys merged into this one by a reviewer. */
  merged_from: string[];
  /** Respondents who named it (a respondent counts once however they spelled it). */
  mentions: number;
  /** Notes explicitly attached to this plant. */
  notes_count: number;
  status: ReviewStatus;
  notes: string | null;
  sources: Source[];
};

type Group = { spellings: Map<string, number>; sources: Source[] };

function collectGroups(rows: ResponseRow[], listQuestion: string, noteQuestion: string): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const list = listEntries(r.answers[listQuestion]);
    const note = readPlantNote(r.answers[noteQuestion]);
    const noteKey = note.plant ? normalizePlantName(note.plant) : null;
    const seen = new Set<string>();
    for (const raw of list) {
      const key = normalizePlantName(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g: Group = groups.get(key) ?? { spellings: new Map(), sources: [] };
      g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
      g.sources.push({
        response_id: r.id,
        submitted_at: r.submitted_at,
        raw_name: raw,
        listed_with: list.filter((x) => x !== raw),
        note: noteKey === key && note.text ? note.text : null,
      });
      groups.set(key, g);
    }
  }
  return groups;
}

/** Notes that name no plant (old format) or name one that is not on the respondent’s list. */
export function unassignedNotes(rows: ResponseRow[], listQuestion = "q14", noteQuestion = "q15"): UnassignedNote[] {
  const out: UnassignedNote[] = [];
  for (const r of rows) {
    const note = readPlantNote(r.answers[noteQuestion]);
    if (!note.text) continue;
    const list = listEntries(r.answers[listQuestion]);
    const matches = note.plant !== null && list.some((x) => normalizePlantName(x) === normalizePlantName(note.plant!));
    if (!matches) out.push({ response_id: r.id, submitted_at: r.submitted_at, listed: list, text: note.text });
  }
  return out;
}

/** Follows merged_into links to the final target key, guarding against cycles. */
export function resolveTarget(key: string, reviews: Map<string, Review>): string {
  let current = key;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const next = reviews.get(current)?.merged_into;
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

/** True when merging `key` into `target` would create a loop (target already resolves to key). */
export function wouldCycle(key: string, target: string, reviews: Map<string, Review>): boolean {
  if (key === target) return true;
  let current = target;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    if (current === key) return true;
    const next = reviews.get(current)?.merged_into;
    if (!next) return false;
    current = next;
  }
  return true;
}

export function buildCandidates(rows: ResponseRow[], reviewList: Review[], listQuestion = "q14", noteQuestion = "q15"): Candidate[] {
  const reviews = new Map(reviewList.map((r) => [r.name_key, r]));
  const groups = collectGroups(rows, listQuestion, noteQuestion);

  type Merged = { spellings: Map<string, number>; sources: Source[]; from: string[] };
  const merged = new Map<string, Merged>();
  for (const [key, g] of groups) {
    const target = resolveTarget(key, reviews);
    const t: Merged = merged.get(target) ?? { spellings: new Map(), sources: [], from: [] };
    for (const [s, n] of g.spellings) t.spellings.set(s, (t.spellings.get(s) ?? 0) + n);
    t.sources.push(...g.sources);
    if (target !== key) t.from.push(key);
    merged.set(target, t);
  }
  // A merge target that no respondent named directly still needs to exist.
  for (const r of reviewList) {
    if (r.merged_into) {
      const t = resolveTarget(r.merged_into, reviews);
      if (!merged.has(t)) merged.set(t, { spellings: new Map(), sources: [], from: [] });
    }
  }

  return [...merged.entries()]
    .map(([key, g]) => {
      const review = reviews.get(key);
      const raw_names = [...g.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
      const sources = g.sources.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
      return {
        key,
        name: review?.reviewed_name?.trim() || raw_names[0] || key,
        reviewed_name: review?.reviewed_name ?? null,
        raw_names,
        merged_from: g.from.sort(),
        mentions: new Set(sources.map((s) => s.response_id)).size,
        notes_count: sources.filter((s) => s.note).length,
        status: review?.status ?? "candidate",
        notes: review?.notes ?? null,
        sources,
      };
    })
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}

export function candidatesExport(
  candidates: Candidate[],
  unassigned: UnassignedNote[],
  meta: { questions_version: number; responses: number; filter: unknown },
) {
  return {
    generated_at: new Date().toISOString(),
    questions_version: meta.questions_version,
    responses: meta.responses,
    filter: meta.filter,
    notes: [
      "respondent_provided: names as typed, co-listed plants, and notes a respondent explicitly attached to one plant (questionnaire version 3). Not verified plant attributes.",
      "researcher_reviewed: merges, reviewed name, status and notes made by the research team. Shortlisted means chosen for the prototype, not botanically verified.",
      "unassigned_notes: notes from versions 1–2 or notes naming a plant not on that respondent’s list; they are not attached to any candidate.",
    ],
    candidates: candidates.map((c) => ({
      key: c.key,
      respondent_provided: {
        raw_names: c.raw_names,
        mentions: c.mentions,
        sources: c.sources.map((s) => ({
          response_id: s.response_id,
          submitted_at: s.submitted_at,
          raw_name: s.raw_name,
          listed_with: s.listed_with,
          attached_note: s.note,
        })),
      },
      researcher_reviewed: {
        reviewed_name: c.reviewed_name,
        display_name: c.name,
        status: c.status,
        notes: c.notes,
        merged_from: c.merged_from,
      },
    })),
    unassigned_notes: unassigned,
  };
}

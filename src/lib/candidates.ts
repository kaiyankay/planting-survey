/**
 * Plant candidates for the first prototype database, built from the plants
 * respondents named (q14) and what they wrote about them (q15), combined with
 * the reviewers’ decisions (merges, status, notes). Pure functions; no I/O.
 *
 * Nothing here verifies a plant. A candidate is a name respondents gave,
 * with their stated reasons attached; checking the plant itself is a later,
 * sourced step.
 */
import type { ResponseRow, TextAnswer, TextListAnswer } from "./answers.ts";
import { normalizePlantName } from "./analysis.ts";
import type { Review, ReviewStatus } from "../dev/data.ts";

export type Source = {
  response_id: string;
  submitted_at: string;
  /** The name as this respondent typed it. */
  raw_name: string;
  /** The other plants in the same list, as typed. */
  listed_with: string[];
  /** Their free-text answer (q15), which may or may not be about this plant. */
  note: string;
};

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
  mentions: number;
  status: ReviewStatus;
  notes: string | null;
  sources: Source[];
};

type Group = { spellings: Map<string, number>; sources: Source[] };

function collectGroups(rows: ResponseRow[], listQuestion: string, noteQuestion: string): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const list = ((r.answers[listQuestion] as TextListAnswer | undefined) ?? []).map((s) => (s ?? "").trim().replace(/\s+/g, " ")).filter(Boolean);
    const note = ((r.answers[noteQuestion] as TextAnswer | undefined) ?? "").trim();
    const seen = new Set<string>();
    for (const raw of list) {
      const key = normalizePlantName(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g: Group = groups.get(key) ?? { spellings: new Map(), sources: [] };
      g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
      g.sources.push({ response_id: r.id, submitted_at: r.submitted_at, raw_name: raw, listed_with: list.filter((x) => x !== raw), note });
      groups.set(key, g);
    }
  }
  return groups;
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

export function buildCandidates(rows: ResponseRow[], reviewList: Review[], listQuestion = "q14", noteQuestion = "q15"): Candidate[] {
  const reviews = new Map(reviewList.map((r) => [r.name_key, r]));
  const groups = collectGroups(rows, listQuestion, noteQuestion);

  // Fold merged groups into their targets.
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
    if (r.merged_into && !merged.has(resolveTarget(r.merged_into, reviews))) {
      merged.set(resolveTarget(r.merged_into, reviews), { spellings: new Map(), sources: [], from: [] });
    }
  }

  return [...merged.entries()]
    .map(([key, g]) => {
      const review = reviews.get(key);
      const raw_names = [...g.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
      // Count respondents, not list entries, so one person naming two spellings counts once.
      const mentions = new Set(g.sources.map((s) => s.response_id)).size;
      return {
        key,
        name: review?.reviewed_name?.trim() || raw_names[0] || key,
        reviewed_name: review?.reviewed_name ?? null,
        raw_names,
        merged_from: g.from.sort(),
        mentions,
        status: review?.status ?? "candidate",
        notes: review?.notes ?? null,
        sources: g.sources.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)),
      };
    })
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}

export function candidatesExport(candidates: Candidate[], meta: { questions_version: number; responses: number }) {
  return {
    generated_at: new Date().toISOString(),
    questions_version: meta.questions_version,
    responses: meta.responses,
    note: "Names, reasons and conditions are respondents’ statements from q14 and q15, not verified plant attributes. Status and merges are reviewer decisions.",
    candidates: candidates.map((c) => ({
      key: c.key,
      reviewed_name: c.reviewed_name,
      display_name: c.name,
      raw_names: c.raw_names,
      merged_from: c.merged_from,
      mentions: c.mentions,
      status: c.status,
      notes: c.notes,
      sources: c.sources.map((s) => ({
        response_id: s.response_id,
        submitted_at: s.submitted_at,
        raw_name: s.raw_name,
        listed_with: s.listed_with,
        respondent_note: s.note,
      })),
    })),
  };
}

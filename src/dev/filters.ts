/**
 * The one selection shared by every developer-mode tab and export: who the
 * respondents are (a1, which allows several roles per person, so role groups
 * can overlap) and their experience (a2, also multiple).
 */
import { ALL_QUESTIONS } from "../questions.ts";
import type { ChoiceAnswer, ResponseRow } from "../lib/answers.ts";

export type Filter = { roles: Set<string>; experience: Set<string> };

export const DEFAULT_FILTER: Filter = { roles: new Set(), experience: new Set() };

const selected = (r: ResponseRow, id: string) => (r.answers[id] as ChoiceAnswer | undefined)?.selected ?? [];

export function applyFilter(rows: ResponseRow[], f: Filter): ResponseRow[] {
  return rows.filter((r) => {
    const a1 = selected(r, "a1");
    const a2 = selected(r, "a2");
    return (f.roles.size === 0 || a1.some((k) => f.roles.has(k))) && (f.experience.size === 0 || a2.some((k) => f.experience.has(k)));
  });
}

function labels(qid: string, keys: Iterable<string>): string[] {
  const q = ALL_QUESTIONS.find((x) => x.id === qid);
  return q && "options" in q ? [...keys].map((k) => q.options.find((o) => o.key === k)?.label ?? k) : [...keys];
}

/** JSON-friendly form of the filter, written into every export. */
export function filterMeta(f: Filter, selectedCount: number, total: number) {
  return {
    roles: labels("a1", f.roles),
    roles_note: f.roles.size > 0 ? "Respondents may hold several roles; a response matches if any selected role applies." : undefined,
    experience: labels("a2", f.experience),
    responses_selected: selectedCount,
    responses_total: total,
  };
}

/** One line for the page: what the numbers below are based on. */
export function describeFilter(f: Filter, selectedCount: number, total: number): string {
  const parts = [`${selectedCount} of ${total} responses`];
  const meta = filterMeta(f, selectedCount, total);
  if (meta.roles.length) parts.push(`roles: ${meta.roles.join(", ")}`);
  if (meta.experience.length) parts.push(`experience: ${meta.experience.join(", ")}`);
  return parts.join(" · ");
}

/** Group tags for one response, for listing open answers. */
export function groupTags(r: ResponseRow): { a1: string[]; a2: string[] } {
  return { a1: labels("a1", selected(r, "a1")), a2: labels("a2", selected(r, "a2")) };
}

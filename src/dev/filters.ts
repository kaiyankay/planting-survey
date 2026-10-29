/**
 * The one selection shared by every developer-mode tab and export: who the
 * respondents are (q1, which allows several roles per person, so role groups
 * can overlap), their experience (q2) and which questionnaire version they
 * answered. The default is the current version only, because option sets
 * differ between versions and must not be summed as if they were the same.
 */
import { ALL_QUESTIONS, QUESTIONS_VERSION } from "../questions.ts";
import type { ChoiceAnswer, ResponseRow } from "../lib/answers.ts";

export type Filter = {
  roles: Set<string>;
  experience: Set<string>;
  /** A questionnaire version, or "all". */
  version: number | "all";
};

export const DEFAULT_FILTER: Filter = { roles: new Set(), experience: new Set(), version: QUESTIONS_VERSION };

export function applyFilter(rows: ResponseRow[], f: Filter): ResponseRow[] {
  return rows.filter((r) => {
    if (f.version !== "all" && (r.questions_version ?? 0) !== f.version) return false;
    const q1 = (r.answers.q1 as ChoiceAnswer | undefined)?.selected ?? [];
    const q2 = (r.answers.q2 as ChoiceAnswer | undefined)?.selected ?? [];
    return (f.roles.size === 0 || q1.some((k) => f.roles.has(k))) && (f.experience.size === 0 || q2.some((k) => f.experience.has(k)));
  });
}

/** JSON-friendly form of the filter, written into every export. */
export function filterMeta(f: Filter, selected: number, total: number) {
  const label = (qid: string, keys: Set<string>) => {
    const q = ALL_QUESTIONS.find((x) => x.id === qid);
    return q && "options" in q ? [...keys].map((k) => q.options.find((o) => o.key === k)?.label ?? k) : [...keys];
  };
  return {
    questions_version: f.version,
    roles: label("q1", f.roles),
    roles_note: f.roles.size > 0 ? "Respondents may hold several roles; a response matches if any selected role applies." : undefined,
    experience: label("q2", f.experience),
    responses_selected: selected,
    responses_total: total,
  };
}

/** One line for the page: what the numbers below are based on. */
export function describeFilter(f: Filter, selected: number, total: number): string {
  const parts = [`${selected} of ${total} responses`];
  parts.push(f.version === "all" ? "all questionnaire versions" : `questionnaire version ${f.version}`);
  const meta = filterMeta(f, selected, total);
  if (meta.roles.length) parts.push(`roles: ${meta.roles.join(", ")}`);
  if (meta.experience.length) parts.push(`experience: ${meta.experience.join(", ")}`);
  return parts.join(" · ");
}

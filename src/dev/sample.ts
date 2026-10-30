/**
 * Deterministic sample responses for checking the developer mode without a
 * database (local development only). Most rows use the current format; a
 * few are written the way version 2 stored them, so the handling of older
 * answers can be seen too.
 */
import { ALL_QUESTIONS } from "../questions.ts";
import type { Answers, ResponseRow } from "../lib/answers.ts";

const PLANTS = [
  "Acer circinatum",
  "Vine maple",
  "Polystichum munitum",
  "Sword fern",
  "Gaultheria shallon",
  "Salal",
  "Mahonia nervosa",
  "Cornus sericea",
  "Thuja plicata",
  "Arbutus menziesii",
  "Carex obnupta",
  "Rubus spectabilis",
];

const NOTES = [
  "Holds dry shade under conifers and needs almost no care once established.",
  "Reliable structure in winter; I use it where the ground stays wet in spring.",
  "Good in a mass along a path edge, with ferns in front.",
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function sampleRows(n: number): ResponseRow[] {
  const rand = rng(7);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const rows: ResponseRow[] = [];
  for (let i = 0; i < n; i++) {
    const legacy = i % 8 === 5; // written under version 2
    const answers: Answers = {};
    for (const q of ALL_QUESTIONS) {
      switch (q.kind) {
        case "checkbox": {
          const limit = q.max ?? 3;
          const k = 1 + Math.floor(rand() * limit);
          const keys = [...q.options]
            .filter((o) => !o.exclusive && !o.noExperienceOnly)
            .sort(() => rand() - 0.5)
            .slice(0, k)
            .map((o) => o.key);
          answers[q.id] = { selected: keys, ...(keys.includes("other") ? { other: "Something else" } : {}) };
          break;
        }
        case "single":
          answers[q.id] = { selected: [pick(q.options).key] };
          break;
        case "grid":
          answers[q.id] = i % 11 === 3 ? { na: "yes" } : Object.fromEntries(q.rows.map((r) => [r.key, pick(q.columns).key]));
          break;
        case "textlist": {
          const k = 3 + Math.floor(rand() * 3);
          const names = new Set<string>();
          while (names.size < k) names.add(pick(PLANTS));
          // One in seven current-version respondents cannot name three plants yet.
          answers[q.id] = !legacy && i % 7 === 2 ? { not_applicable: true, entries: [] } : [...names];
          break;
        }
        case "plantnote": {
          const source = answers[q.sourceQuestion];
          const na = !Array.isArray(source);
          const listed = Array.isArray(source) ? source : [];
          const text = legacy && rand() < 0.4 ? "" : pick(NOTES);
          answers[q.id] = legacy ? text : na ? { not_applicable: true } : { plant: listed[0], text };
          break;
        }
      }
    }
    rows.push({
      id: `sample-${i + 1}`,
      submitted_at: new Date(Date.UTC(2026, 9, 20 + Math.floor(i / 4), 9 + (i % 9))).toISOString(),
      duration_seconds: 120 + Math.floor(rand() * 200),
      questions_version: legacy ? 2 : 5,
      answers,
    });
  }
  return rows;
}

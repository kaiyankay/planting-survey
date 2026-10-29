/**
 * Deterministic sample responses for checking the developer mode without a
 * database. Never used when Supabase is configured.
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
          answers[q.id] = Object.fromEntries(q.rows.map((r) => [r.key, pick(q.columns).key]));
          break;
        case "textlist": {
          const k = 2 + Math.floor(rand() * 4);
          const names = new Set<string>();
          while (names.size < k) names.add(pick(PLANTS));
          answers[q.id] = [...names];
          break;
        }
        case "text":
          answers[q.id] = rand() < 0.6 ? "Under big-leaf maples, with sword fern, because it holds the shade." : "";
          break;
      }
    }
    rows.push({
      id: `sample-${i + 1}`,
      submitted_at: new Date(Date.UTC(2026, 9, 20 + Math.floor(i / 4), 9 + (i % 9))).toISOString(),
      duration_seconds: 120 + Math.floor(rand() * 200),
      questions_version: 2,
      answers,
    });
  }
  return rows;
}

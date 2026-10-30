/**
 * Deterministic sample responses for checking the developer mode without a
 * database (local development only).
 */
import { ALL_QUESTIONS } from "../questions.ts";
import { answersToStore, type Answers, type PlantEntry, type ResponseRow } from "../lib/answers.ts";

const PLANTS: PlantEntry[] = [
  { name: "Acer circinatum", role: "tree", why: "Takes shade and looks good in autumn" },
  { name: "Vine maple", role: "tree" },
  { name: "Polystichum munitum", role: "perennial_grass", why: "Evergreen and nearly indestructible" },
  { name: "Sword fern", role: "perennial_grass" },
  { name: "Gaultheria shallon", role: "groundcover", why: "Dry shade" },
  { name: "Salal", role: "shrub" },
  { name: "Mahonia nervosa", role: "groundcover" },
  { name: "Cornus sericea", role: "shrub", why: "Winter stems" },
  { name: "Thuja plicata", role: "tree" },
  { name: "Arbutus menziesii", role: "tree", why: "Hard to establish but worth it" },
  { name: "Carex obnupta", role: "perennial_grass" },
  { name: "Rubus spectabilis", role: "shrub" },
];

const SHORT = ["How big it actually gets in a north-facing courtyard", "Whether it survives a wet winter in clay", "How it looks in February", "Whether deer eat it"];
const LONG = [
  "Started from the planting plan a precedent project used, then checked each plant on Missouri Botanical Garden for size and hardiness. Dropped two because they would block the sightline from the café. The list went into a Rhino layer and an Excel schedule I still have.",
  "Walked the site first, then pulled a municipal list for the street-tree bylaw. Checked light and water needs in a book, dropped the ones that needed irrigation. The final list lives in my Land F/X library now.",
];
const WORDS = ["loose, layered, mostly green", "dry meadow, fine texture", "lush shade, big leaves", "tidy evergreen structure"];
const QUERIES = ["evergreen shrubs for dry shade under cedars", "small tree under power lines, fall colour", "groundcover that tolerates foot traffic", "native plants for a wet corner that flood in spring"];
const NOTES = [
  "Used it along a shaded path on a slope; holds the soil and needs almost no care. Warn people it spreads once it is happy.",
  "Saw it in a rain garden that floods every spring; it came back each year. Looks dead in winter, so pair it with something evergreen.",
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
    const noExperience = i % 6 === 4;
    const answers: Answers = {};
    for (const q of ALL_QUESTIONS) {
      switch (q.kind) {
        case "checkbox": {
          if (q.id === "a2") {
            answers[q.id] = noExperience ? { selected: ["none"] } : { selected: [...new Set([pick(["studio", "professional", "gardening"]), pick(["studio", "gardening"])])] };
            break;
          }
          const limit = q.max ?? 3;
          const k = 1 + Math.floor(rand() * limit);
          const keys = [...q.options]
            .filter((o) => !o.exclusive)
            .sort(() => rand() - 0.5)
            .slice(0, k)
            .map((o) => o.key);
          answers[q.id] = { selected: keys, ...(keys.includes("other") ? { other: "Horticulture technician" } : {}) };
          break;
        }
        case "single":
          answers[q.id] = { selected: [pick(q.options).key] };
          break;
        case "grid3":
          answers[q.id] = Object.fromEntries(q.rows.map((r) => [r.key, pick(q.columns).key]));
          break;
        case "shorttext":
          answers[q.id] = rand() < (q.required ? 1 : 0.6) ? (q.id === "d1" ? pick(WORDS) : q.id === "d2" ? pick(QUERIES) : pick(SHORT)) : "";
          break;
        case "longtext":
          answers[q.id] = pick(LONG);
          break;
        case "plantlist": {
          if (i % 9 === 3) {
            answers[q.id] = { not_applicable: true, entries: [] };
            break;
          }
          const k = 3 + Math.floor(rand() * 3);
          const chosen = new Map<string, PlantEntry>();
          while (chosen.size < k) {
            const p = pick(PLANTS);
            chosen.set(p.name.toLowerCase(), p);
          }
          answers[q.id] = { entries: [...chosen.values()] };
          break;
        }
        case "plantnote": {
          const source = answers[q.sourceQuestion];
          const na = Boolean(source && typeof source === "object" && "not_applicable" in source);
          const first = source && typeof source === "object" && "entries" in source ? (source as { entries: PlantEntry[] }).entries[0]?.name : undefined;
          answers[q.id] = na ? { not_applicable: true } : { plant: first ?? "", text: pick(NOTES) };
          break;
        }
      }
    }
    rows.push({
      id: `sample-${i + 1}`,
      submitted_at: new Date(Date.UTC(2026, 10, 3 + Math.floor(i / 4), 9 + (i % 9))).toISOString(),
      duration_seconds: 240 + Math.floor(rand() * 300),
      questions_version: 1,
      answers: answersToStore(answers),
    });
  }
  return rows;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { basisLabel, choiceStats, grid3Stats, median, normalizePlantName, notApplicableCount, openText, plantNotes, plantTally } from "../src/lib/analysis.ts";
import { ALL_QUESTIONS, type CheckboxQuestion, type Grid3Question } from "../src/questions.ts";
import type { ResponseRow } from "../src/lib/answers.ts";
import { applyFilter, DEFAULT_FILTER, describeFilter, filterMeta, groupTags } from "../src/dev/filters.ts";

const q = <T>(id: string) => ALL_QUESTIONS.find((x) => x.id === id)! as T;
const row = (answers: ResponseRow["answers"], i: number): ResponseRow => ({
  id: String(i),
  submitted_at: "2026-11-03T00:00:00Z",
  duration_seconds: 100 + i,
  questions_version: 1,
  answers,
});

const rows = [
  row({ a1: { selected: ["mla"] }, a2: { selected: ["studio"] }, c1: { hardiness: "must_pass", light: "compared" }, c3: { selected: ["keep_both"] }, c2: { selected: ["mature_size", "conflicting"] }, d1: { entries: [{ name: "Sword fern", role: "perennial_grass" }, { name: "Salal", role: "shrub" }] }, d2: { plant: "Salal", text: "Dry shade.", basis: "observed" }, e2: "shrubs for shade" }, 1),
  row({ a1: { selected: ["mla", "designer"] }, a2: { selected: ["professional", "gardening"] }, c1: { hardiness: "must_pass" }, c2: { selected: ["mature_size"] }, d1: { entries: [{ name: "sword  fern ", role: "groundcover" }, { name: "Acer circinatum", role: "tree" }] }, d2: { plant: "", text: "", basis: "" }, e2: "" }, 2),
  row({ a1: { selected: ["instructor"] }, a2: { selected: ["none"] }, c2: { selected: ["not_looked"] }, e2: "a tree that does not drop much" }, 3),
  row({ a1: { selected: ["designer"] }, a2: { selected: ["gardening"] }, c1: { hardiness: "not_considered" }, d1: { not_applicable: true, entries: [{ name: "Salal", role: "shrub" }] }, d2: { not_applicable: true } }, 4),
];

test("choice shares use only respondents who answered the question", () => {
  const s = choiceStats(q<CheckboxQuestion>("c2"), rows);
  assert.equal(s.n, 3);
  assert.equal(s.counts.find((x) => x.key === "mature_size")?.count, 2);
  assert.equal(s.counts.find((x) => x.key === "mature_size")?.share, 2 / 3);
});

test("c1 rows count over the respondents who answered that row, with the must-pass share", () => {
  const s = grid3Stats(q<Grid3Question>("c1"), rows);
  assert.equal(s.answered, 3, "the respondent with no experience was never asked");
  const hardiness = s.rows.find((r) => r.key === "hardiness")!;
  assert.equal(hardiness.n, 3);
  assert.deepEqual(hardiness.counts, { must_pass: 2, compared: 0, not_considered: 1 });
  assert.equal(hardiness.mustPassShare, 2 / 3);
  const light = s.rows.find((r) => r.key === "light")!;
  assert.equal(light.n, 1);
  assert.equal(light.mustPassShare, 0);
  assert.equal(s.rows.find((r) => r.key === "water")!.n, 0);
});

test("plant tally merges case and spacing, keeps roles, and ignores not-applicable lists", () => {
  assert.equal(normalizePlantName("  Sword  Fern. "), "sword fern");
  const t = plantTally("d1", rows);
  assert.equal(t[0].name, "Sword fern");
  assert.equal(t[0].count, 2);
  assert.deepEqual(t[0].roles, { perennial_grass: 1, groundcover: 1 });
  assert.equal(t.find((p) => p.name === "Salal")?.count, 1, "the not-applicable respondent’s typed Salal is not a mention");
  assert.deepEqual(plantNotes("d2", rows), [{ response_id: "1", plant: "Salal", text: "Dry shade.", basis: "observed" }]);
  assert.equal(basisLabel("d2", "observed"), "Observed in person");
  assert.equal(basisLabel("d2", ""), "");
  assert.equal(notApplicableCount("d1", rows), 1);
  assert.equal(notApplicableCount("d2", rows), 1);
});

test("open text reads short, long and note answers, blank when not given", () => {
  assert.equal(openText("e2", rows[0]), "shrubs for shade");
  assert.equal(openText("e2", rows[1]), "");
  assert.equal(openText("d2", rows[0]), "Dry shade.");
  assert.equal(openText("d2", rows[3]), "");
  assert.equal(openText("b3", rows[2]), "");
});

test("filters by role (overlapping) and experience; group tags use labels", () => {
  assert.equal(applyFilter(rows, DEFAULT_FILTER).length, 4);
  const mla = applyFilter(rows, { ...DEFAULT_FILTER, roles: new Set(["mla"]) });
  const designer = applyFilter(rows, { ...DEFAULT_FILTER, roles: new Set(["designer"]) });
  assert.equal(mla.length + designer.length, 4, "one respondent is in both role groups");
  assert.equal(applyFilter(rows, { ...DEFAULT_FILTER, experience: new Set(["none"]) }).length, 1);
  assert.deepEqual(filterMeta({ ...DEFAULT_FILTER, roles: new Set(["mla"]) }, 2, 4).roles, ["MLA student"]);
  assert.match(describeFilter(DEFAULT_FILTER, 4, 4), /^4 of 4 responses$/);
  assert.deepEqual(groupTags(rows[1]), { a1: ["MLA student", "Landscape designer or landscape architect"], a2: ["Professional projects", "Personal gardening"] });
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

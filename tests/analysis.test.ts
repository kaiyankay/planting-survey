import { test } from "node:test";
import assert from "node:assert/strict";
import { choiceStats, gridStats, median, normalizePlantName, plantNotes, plantTally, versionsIn } from "../src/lib/analysis.ts";
import { ALL_QUESTIONS, type CheckboxQuestion, type GridQuestion, type SingleQuestion } from "../src/questions.ts";
import type { ResponseRow } from "../src/lib/answers.ts";
import { applyFilter, DEFAULT_FILTER, describeFilter, filterMeta } from "../src/dev/filters.ts";

const q = <T>(id: string) => ALL_QUESTIONS.find((x) => x.id === id)! as T;
const row = (answers: ResponseRow["answers"], i: number, version = 4): ResponseRow => ({
  id: String(i),
  submitted_at: "2026-10-28T00:00:00Z",
  duration_seconds: 100 + i,
  questions_version: version,
  answers,
});

const rows = [
  row({ q1: { selected: ["mla"] }, q2: { selected: ["academic"] }, q4: { selected: ["height", "zone"] }, q7: { hardiness: "rule", light: "preference" }, q14: ["Sword fern", "Salal"], q15: { plant: "Salal", text: "Dry shade." } }, 1),
  row({ q1: { selected: ["mla", "practitioner"] }, q2: { selected: ["both"] }, q4: { selected: ["height"] }, q7: { hardiness: "rule" }, q14: ["sword  fern ", "Acer circinatum"], q15: { plant: "", text: "" } }, 2),
  row({ q1: { selected: ["academic"] }, q2: { selected: ["none"] }, q4: { selected: ["rarely"] }, q7: { na: "yes" }, q14: ["Salal"], q15: "Old-style note." }, 3, 2),
  row({ q1: { selected: ["practitioner"] }, q2: { selected: ["professional"] }, q14: [] }, 4),
];

test("choice shares use only respondents who answered the question", () => {
  const s = choiceStats(q<CheckboxQuestion>("q4"), rows);
  assert.equal(s.n, 3);
  assert.equal(s.counts.find((x) => x.key === "height")?.count, 2);
  assert.equal(s.counts.find((x) => x.key === "height")?.share, 2 / 3);
  assert.equal(s.unknown, 0);
});

test("selections of options from another version are reported, not merged", () => {
  const old = [row({ q3: { selected: ["hardiness", "photos"] } }, 9, 1), row({ q3: { selected: ["site_suitability"] } }, 10)];
  const s = choiceStats(q<CheckboxQuestion>("q3"), old);
  assert.equal(s.n, 2);
  assert.equal(s.unknown, 2);
  assert.equal(s.counts.find((x) => x.key === "site_suitability")?.count, 1);
});

test("grid rows exclude not-applicable and missing respondents from their denominators", () => {
  const s = gridStats(q<GridQuestion>("q7"), rows);
  assert.equal(s.answered, 3);
  assert.equal(s.notApplicable, 1);
  const hardiness = s.rows.find((r) => r.key === "hardiness")!;
  assert.equal(hardiness.n, 2);
  assert.equal(hardiness.cells.find((c) => c.col === "rule")?.share, 1);
  const light = s.rows.find((r) => r.key === "light")!;
  assert.equal(light.n, 1);
  assert.equal(light.cells.find((c) => c.col === "preference")?.count, 1);
  const water = s.rows.find((r) => r.key === "water")!;
  assert.equal(water.n, 0);
  assert.equal(water.cells[0].share, 0);
});

test("plant tally merges case and spacing only; notes keep their explicit plant", () => {
  assert.equal(normalizePlantName("  Sword  Fern. "), "sword fern");
  const t = plantTally("q14", rows);
  assert.equal(t[0].count, 2);
  const notes = plantNotes("q15", rows);
  assert.deepEqual(notes.map((n) => [n.plant, n.legacy]), [["Salal", false], [null, true]]);
});

test("Q2: the old key both is reported as an earlier-version selection, never merged into personal", () => {
  const s = choiceStats(q<SingleQuestion>("q2"), [...rows, row({ q2: { selected: ["personal"] } }, 5)]);
  assert.equal(s.n, 5);
  assert.equal(s.unknown, 1, "one respondent chose the retired option both");
  assert.equal(s.counts.find((c) => c.key === "personal")?.count, 1);
  assert.ok(!s.counts.some((c) => c.key === "both"));
});

test("filters: default is the current version; roles may overlap; the meta describes the selection", () => {
  assert.equal(applyFilter(rows, DEFAULT_FILTER).length, 3);
  assert.equal(applyFilter(rows, { ...DEFAULT_FILTER, version: "all" }).length, 4);
  assert.equal(applyFilter(rows, { ...DEFAULT_FILTER, version: 2 }).length, 1);
  const mla = applyFilter(rows, { ...DEFAULT_FILTER, roles: new Set(["mla"]) });
  const practitioner = applyFilter(rows, { ...DEFAULT_FILTER, roles: new Set(["practitioner"]) });
  assert.equal(mla.length + practitioner.length, 4, "the same respondent appears in both role groups");
  const meta = filterMeta({ ...DEFAULT_FILTER, roles: new Set(["mla"]) }, 2, 4);
  assert.deepEqual(meta.roles, ["MLA student"]);
  assert.ok(meta.roles_note);
  assert.match(describeFilter(DEFAULT_FILTER, 3, 4), /3 of 4 responses · questionnaire version 4/);
  assert.deepEqual(versionsIn(rows), [4, 2]);
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

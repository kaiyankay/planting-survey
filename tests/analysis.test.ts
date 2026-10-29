import { test } from "node:test";
import assert from "node:assert/strict";
import { choiceCounts, gridCounts, gridNotApplicable, median, normalizePlantName, plantTally } from "../src/lib/analysis.ts";
import { ALL_QUESTIONS, type CheckboxQuestion, type GridQuestion } from "../src/questions.ts";
import type { ResponseRow } from "../src/lib/answers.ts";

const q = <T>(id: string) => ALL_QUESTIONS.find((x) => x.id === id)! as T;
const row = (answers: ResponseRow["answers"], i: number): ResponseRow => ({
  id: String(i),
  submitted_at: "2026-10-28T00:00:00Z",
  duration_seconds: 100 + i,
  questions_version: 2,
  answers,
});

const rows = [
  row({ q4: { selected: ["height", "zone"] }, q7: { hardiness: "rule" }, q14: ["Sword fern", "Salal"] }, 1),
  row({ q4: { selected: ["height"] }, q7: { hardiness: "rule" }, q14: ["sword  fern ", "Acer circinatum"] }, 2),
  row({ q4: { selected: ["rarely"] }, q7: { na: "yes" }, q14: ["Salal"] }, 3),
];

test("choice counts and shares", () => {
  const c = choiceCounts(q<CheckboxQuestion>("q4"), rows);
  assert.equal(c.find((x) => x.key === "height")?.count, 2);
  assert.equal(c.find((x) => x.key === "rarely")?.share, 1 / 3);
});

test("grid counts and not-applicable", () => {
  const g = gridCounts(q<GridQuestion>("q7"), rows);
  assert.equal(g.find((x) => x.row === "hardiness" && x.col === "rule")?.count, 2);
  assert.equal(g.find((x) => x.row === "light" && x.col === "rule")?.count, 0);
  assert.equal(gridNotApplicable(q<GridQuestion>("q7"), rows), 1);
});

test("plant tally merges case and spacing, keeps the common spelling", () => {
  assert.equal(normalizePlantName("  Sword  Fern. "), "sword fern");
  const t = plantTally("q14", rows);
  assert.equal(t[0].count, 2);
  assert.ok(["Sword fern", "Salal"].includes(t[0].name));
  assert.equal(t.find((p) => p.name === "sword fern" || p.name === "Sword fern")?.spellings.length, 2);
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

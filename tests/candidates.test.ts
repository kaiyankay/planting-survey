import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCandidates, candidatesExport, resolveTarget } from "../src/lib/candidates.ts";
import { buildInsights, requirementsExport } from "../src/dev/insights.ts";
import type { ResponseRow } from "../src/lib/answers.ts";
import type { Review } from "../src/dev/data.ts";

const row = (i: number, answers: ResponseRow["answers"]): ResponseRow => ({
  id: `r${i}`,
  submitted_at: `2026-10-2${i}T00:00:00Z`,
  duration_seconds: 100,
  questions_version: 2,
  answers,
});

const rows = [
  row(1, { q14: ["Sword fern", "Salal"], q15: "Sword fern for dry shade.", q3: { selected: ["site_suitability"] }, q7: { hardiness: "rule" } }),
  row(2, { q14: ["Polystichum munitum", "Vine maple"], q15: "", q3: { selected: ["site_suitability", "growth_size"] }, q7: { hardiness: "rule" } }),
  row(3, { q14: ["salal", "Sword  fern"], q15: "Salal under conifers.", q3: { selected: ["growth_size"] }, q7: { na: "yes" } }),
];

test("candidates group by spelling and count respondents", () => {
  const c = buildCandidates(rows, []);
  const salal = c.find((x) => x.key === "salal")!;
  assert.equal(salal.mentions, 2);
  assert.deepEqual(salal.raw_names.sort(), ["Salal", "salal"]);
  assert.equal(salal.sources.find((s) => s.response_id === "r3")?.note, "Salal under conifers.");
  assert.deepEqual(salal.sources.find((s) => s.response_id === "r1")?.listed_with, ["Sword fern"]);
});

test("a merge folds mentions, spellings and sources into the target", () => {
  const reviews: Review[] = [
    { name_key: "polystichum munitum", reviewed_name: null, status: "candidate", merged_into: "sword fern", notes: null },
    { name_key: "sword fern", reviewed_name: "Polystichum munitum (sword fern)", status: "shortlisted", merged_into: null, notes: "Common in the region" },
  ];
  const c = buildCandidates(rows, reviews);
  const fern = c.find((x) => x.key === "sword fern")!;
  assert.equal(fern.mentions, 3);
  assert.equal(fern.name, "Polystichum munitum (sword fern)");
  assert.equal(fern.status, "shortlisted");
  assert.deepEqual(fern.merged_from, ["polystichum munitum"]);
  assert.ok(!c.some((x) => x.key === "polystichum munitum"));
  assert.ok(fern.raw_names.includes("Polystichum munitum"));
});

test("merge chains resolve and cycles do not hang", () => {
  const reviews = new Map<string, Review>([
    ["a", { name_key: "a", reviewed_name: null, status: "candidate", merged_into: "b", notes: null }],
    ["b", { name_key: "b", reviewed_name: null, status: "candidate", merged_into: "c", notes: null }],
    ["c", { name_key: "c", reviewed_name: null, status: "candidate", merged_into: "a", notes: null }],
  ]);
  assert.ok(["a", "b", "c"].includes(resolveTarget("a", reviews)));
  reviews.get("c")!.merged_into = null;
  assert.equal(resolveTarget("a", reviews), "c");
});

test("candidate export keeps raw names, sources and status", () => {
  const out = candidatesExport(buildCandidates(rows, []), { questions_version: 2, responses: 3 });
  const salal = out.candidates.find((c) => c.key === "salal")!;
  assert.equal(salal.status, "candidate");
  assert.equal(salal.sources.length, 2);
  assert.equal(salal.sources[0].respondent_note, "Sword fern for dry shade.");
});

test("insights separate results from implications and respect not-applicable", () => {
  const dims = buildInsights(rows);
  const attributes = dims.find((d) => d.id === "attributes")!;
  const q3 = attributes.results.find((r) => r.id === "q3")!;
  assert.equal(q3.kind, "choice");
  assert.equal(q3.respondents, 3);
  const top = attributes.implications[0];
  assert.equal(top.question_id, "q3");
  assert.equal(top.count, 2);
  const constraints = dims.find((d) => d.id === "constraints")!;
  const q7 = constraints.results[0];
  assert.equal(q7.kind, "grid");
  if (q7.kind === "grid") assert.equal(q7.not_applicable, 1);
  assert.ok(constraints.findings.some((f) => f.startsWith("Winter hardiness: most often “Fixed requirement” (2 of 2)")));
  const out = requirementsExport(rows);
  assert.equal(out.dimensions.length, 6);
  assert.ok(out.dimensions[0].database_implications[0].evidence.count >= 1);
});

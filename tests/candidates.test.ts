import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCandidates, candidatesExport, resolveTarget, wouldCycle } from "../src/lib/candidates.ts";
import type { ResponseRow } from "../src/lib/answers.ts";
import type { Review } from "../src/dev/data.ts";

const row = (i: number, answers: ResponseRow["answers"]): ResponseRow => ({
  id: `r${i}`,
  submitted_at: `2026-11-0${i}T00:00:00Z`,
  duration_seconds: 100,
  questions_version: 1,
  answers,
});

const rows = [
  row(1, { f1: { entries: [{ name: "Sword fern", role: "perennial_grass", why: "evergreen" }, { name: "Salal", role: "shrub" }] }, f2: { plant: "Sword fern", text: "Sword fern for dry shade.", basis: "project" } }),
  row(2, { f1: { entries: [{ name: "Polystichum munitum", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] }, f2: { plant: "", text: "", basis: "" } }),
  row(3, { f1: { entries: [{ name: "salal", role: "groundcover", why: "spreads" }, { name: "Sword  fern", role: "perennial_grass" }] }, f2: { plant: "salal", text: "Salal under conifers.", basis: "observed" } }),
  row(4, { f1: { not_applicable: true, entries: [{ name: "Salal", role: "shrub" }] }, f2: { not_applicable: true } }),
];

test("candidates group by name, count respondents, keep roles and reasons, attach notes only to the chosen plant", () => {
  const c = buildCandidates(rows, []);
  const salal = c.find((x) => x.key === "salal")!;
  assert.equal(salal.mentions, 2, "the not-applicable respondent is not a mention");
  assert.deepEqual(salal.roles, { shrub: 1, groundcover: 1 });
  assert.deepEqual(salal.raw_names.sort(), ["Salal", "salal"]);
  assert.equal(salal.sources.find((s) => s.response_id === "r3")?.note, "Salal under conifers.");
  assert.equal(salal.sources.find((s) => s.response_id === "r3")?.note_basis, "observed");
  assert.equal(salal.sources.find((s) => s.response_id === "r1")?.note_basis, null);
  assert.equal(salal.sources.find((s) => s.response_id === "r3")?.why, "spreads");
  assert.equal(salal.sources.find((s) => s.response_id === "r1")?.note, null, "r1’s note is about sword fern, not salal");
  const fern = c.find((x) => x.key === "sword fern")!;
  assert.equal(fern.mentions, 2);
  assert.equal(fern.notes_count, 1);
  assert.ok(!c.some((x) => x.sources.some((s) => s.response_id === "r4")));
});

test("a merge folds mentions, roles and notes into the target", () => {
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
  assert.equal(fern.roles.perennial_grass, 3);
  assert.ok(!c.some((x) => x.key === "polystichum munitum"));
});

test("circular merges are detected and never hang", () => {
  const reviews = new Map<string, Review>([
    ["a", { name_key: "a", reviewed_name: null, status: "candidate", merged_into: "b", notes: null }],
    ["b", { name_key: "b", reviewed_name: null, status: "candidate", merged_into: null, notes: null }],
  ]);
  assert.equal(wouldCycle("b", "a", reviews), true);
  assert.equal(wouldCycle("a", "a", reviews), true);
  assert.equal(wouldCycle("c", "a", reviews), false);
  reviews.get("b")!.merged_into = "a";
  assert.ok(["a", "b"].includes(resolveTarget("a", reviews)));
});

test("export separates respondent-provided from researcher-reviewed and carries version 1", () => {
  const out = candidatesExport(buildCandidates(rows, []), { questions_version: 1, responses: 4, filter: { roles: [] } });
  assert.equal(out.questions_version, 1);
  const salal = out.candidates.find((c) => c.key === "salal")!;
  assert.equal(salal.respondent_provided.mentions, 2);
  assert.equal(salal.respondent_provided.sources[0].role, "shrub");
  assert.equal(salal.respondent_provided.sources.find((s) => s.response_id === "r3")?.note_basis, "observed");
  assert.equal(salal.researcher_reviewed.status, "candidate");
});

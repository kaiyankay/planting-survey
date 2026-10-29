import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCandidates, candidatesExport, resolveTarget, unassignedNotes, wouldCycle } from "../src/lib/candidates.ts";
import { buildInsights, REQUIREMENTS, requirementsExport } from "../src/dev/insights.ts";
import type { ResponseRow } from "../src/lib/answers.ts";
import type { Decision, Review } from "../src/dev/data.ts";

const row = (i: number, answers: ResponseRow["answers"], version = 4): ResponseRow => ({
  id: `r${i}`,
  submitted_at: `2026-10-2${i}T00:00:00Z`,
  duration_seconds: 100,
  questions_version: version,
  answers,
});

const rows = [
  row(1, { q14: ["Sword fern", "Salal"], q15: { plant: "Sword fern", text: "Sword fern for dry shade." }, q3: { selected: ["site_suitability"] }, q7: { hardiness: "rule" } }),
  row(2, { q14: ["Polystichum munitum", "Vine maple"], q15: { plant: "", text: "" }, q3: { selected: ["site_suitability", "growth_size"] }, q7: { hardiness: "rule" } }),
  row(3, { q14: ["salal", "Sword  fern"], q15: "Salal under conifers.", q3: { selected: ["growth_size"] }, q7: { na: "yes" } }, 2),
  row(4, { q14: ["Salal"], q15: { plant: "Thuja plicata", text: "Names a plant not on the list." } }),
];

test("a note is attached only to the plant the respondent chose", () => {
  const c = buildCandidates(rows, []);
  const fern = c.find((x) => x.key === "sword fern")!;
  const salal = c.find((x) => x.key === "salal")!;
  assert.equal(fern.notes_count, 1);
  assert.equal(fern.sources.find((s) => s.response_id === "r1")?.note, "Sword fern for dry shade.");
  assert.equal(salal.sources.find((s) => s.response_id === "r1")?.note, null, "the same respondent’s note must not appear under their other plant");
  assert.equal(salal.notes_count, 0);
  assert.equal(salal.mentions, 3);
});

test("old-format notes and notes naming an unlisted plant are unassigned", () => {
  const u = unassignedNotes(rows);
  assert.deepEqual(u.map((n) => n.response_id), ["r3", "r4"]);
  assert.equal(u[0].text, "Salal under conifers.");
  assert.deepEqual(u[0].listed, ["salal", "Sword fern"]);
});

test("a merge folds mentions, spellings and attached notes into the target", () => {
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
});

test("circular merges are detected and never hang", () => {
  const reviews = new Map<string, Review>([
    ["a", { name_key: "a", reviewed_name: null, status: "candidate", merged_into: "b", notes: null }],
    ["b", { name_key: "b", reviewed_name: null, status: "candidate", merged_into: null, notes: null }],
  ]);
  assert.equal(wouldCycle("b", "a", reviews), true, "b → a would loop because a already points to b");
  assert.equal(wouldCycle("a", "a", reviews), true);
  assert.equal(wouldCycle("c", "a", reviews), false);
  reviews.get("b")!.merged_into = "a";
  assert.ok(["a", "b"].includes(resolveTarget("a", reviews)), "an existing loop still resolves to something");
});

test("candidate export separates respondent-provided from researcher-reviewed", () => {
  const out = candidatesExport(buildCandidates(rows, []), unassignedNotes(rows), { questions_version: 4, responses: 4, filter: { version: 4 } });
  const fern = out.candidates.find((c) => c.key === "sword fern")!;
  assert.equal(fern.respondent_provided.sources[0].attached_note, "Sword fern for dry shade.");
  assert.equal(fern.researcher_reviewed.status, "candidate");
  assert.equal(out.unassigned_notes.length, 2);
  assert.deepEqual(out.filter, { version: 4 });
});

test("requirement catalogue has unique ids and only known evidence", () => {
  const ids = REQUIREMENTS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of REQUIREMENTS) assert.ok(r.evidence.length > 0, r.id);
});

test("insights keep evidence, suggestion and decision apart; Q7 stays a distribution; decisions round-trip to the export", () => {
  const decisions: Decision[] = [{ requirement_id: "attr.hardiness_zone", status: "include", rationale: "Needed for any Vancouver list", updated_by: "o@x", updated_at: "2026-10-29T00:00:00Z" }];
  const dims = buildInsights(rows, decisions);
  const attributes = dims.find((d) => d.id === "attributes")!;
  const zone = attributes.requirements.find((r) => r.id === "attr.hardiness_zone")!;
  assert.equal(zone.decision.status, "include");
  assert.equal(zone.core, true);
  const q7evidence = zone.evidence_results.find((e) => "row" in e.ref)!;
  assert.ok(q7evidence.distribution, "grid evidence is a distribution, not a rule");
  assert.equal(q7evidence.n, 2, "not-applicable respondent excluded from the row denominator");
  const undecided = attributes.requirements.find((r) => r.id === "attr.spacing")!;
  assert.equal(undecided.decision.status, "proposed");
  const out = requirementsExport(rows, decisions, { version: 4 });
  const exported = out.dimensions.flatMap((d) => d.requirements).find((r) => r.id === "attr.hardiness_zone")!;
  assert.equal(exported.research_decision.status, "include");
  assert.equal(exported.research_decision.rationale, "Needed for any Vancouver list");
  assert.equal(exported.category, "plant attribute");
  assert.ok(out.notes.some((n) => n.startsWith("Q7 rows")));
});

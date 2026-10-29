import { test } from "node:test";
import assert from "node:assert/strict";
import { csvColumns, flattenResponse, hasAnswer, isComplete, missingHint, readPlantNote, toCsv, type ResponseRow } from "../src/lib/answers.ts";
import { ALL_QUESTIONS, QUESTIONS_VERSION, SECTIONS } from "../src/questions.ts";

const sample: ResponseRow = {
  id: "00000000-0000-0000-0000-000000000001",
  submitted_at: "2026-10-28T10:00:00Z",
  duration_seconds: 171,
  questions_version: 4,
  answers: {
    q1: { selected: ["mla", "other"], other: "Horticulturist" },
    q2: { selected: ["academic"] },
    q11: { selected: ["web_search", "ai_tools"] },
    q3: { selected: ["site_suitability", "other"], other: 'Say "hello", then plant' },
    q4: { selected: ["rarely"] },
    q7: { hardiness: "rule", light: "preference", water: "depends", size: "rule", native: "preference", availability: "not" },
    q16: { selected: ["location"] },
    q17: { selected: ["by_site", "compare"] },
    q14: ["Acer circinatum", "", "Polystichum munitum"],
    q15: { plant: "Polystichum munitum", text: "Under big-leaf maples,\nwith sword fern." },
    // Keys from questionnaire version 1 that no longer exist must be ignored, not mapped elsewhere.
    q12: ["site", "concept"],
    q13: { selected: ["structure"] },
  },
};

test("exactly 15 questions in the agreed order, version 4", () => {
  assert.equal(QUESTIONS_VERSION, 4);
  assert.deepEqual(
    ALL_QUESTIONS.map((q) => q.id),
    ["q1", "q2", "q11", "q3", "q4", "q5", "q7", "q8", "q9", "q10", "q16", "q6", "q17", "q14", "q15"],
  );
  assert.equal(SECTIONS.length, 5);
  assert.equal(ALL_QUESTIONS.find((q) => q.id === "q15")?.kind, "plantnote");
  const q2 = ALL_QUESTIONS.find((q) => q.id === "q2")!;
  assert.ok("options" in q2 && q2.options.some((o) => o.key === "personal") && !q2.options.some((o) => o.key === "both"));
  const q4 = ALL_QUESTIONS.find((q) => q.id === "q4")!;
  assert.ok(q4.kind === "checkbox" && q4.max === undefined && q4.help === "Choose all that apply");
  const q16 = ALL_QUESTIONS.find((q) => q.id === "q16")!;
  assert.ok(q16.kind === "checkbox" && q16.max === undefined);
  const q8 = ALL_QUESTIONS.find((q) => q.id === "q8")!;
  assert.ok(q8.kind === "checkbox" && q8.max === 3);
  const q10 = ALL_QUESTIONS.find((q) => q.id === "q10")!;
  assert.ok(q10.kind === "checkbox" && q10.max === 3 && q10.text.includes("which types of information would you most want to save"));
});

test("columns follow the question order; the plant note gets a plant column; removed questions are absent", () => {
  const cols = csvColumns();
  assert.deepEqual(cols.slice(0, 4), ["id", "submitted_at", "duration_seconds", "questions_version"]);
  assert.equal(cols.indexOf("q11") < cols.indexOf("q3"), true);
  assert.ok(cols.includes("q7_hardiness"));
  assert.deepEqual(cols.slice(-2), ["q15_plant", "q15"]);
  assert.ok(!cols.some((c) => c.startsWith("q12") || c.startsWith("q13")));
});

test("flatten resolves keys to labels and keeps the chosen plant beside its note", () => {
  const flat = flattenResponse(sample);
  assert.equal(flat.q1, "MLA student | Other: Horticulturist");
  assert.equal(flat.q11, "General web search | AI tools");
  assert.equal(flat.q4, "I rarely use measurements");
  assert.equal(flat.q7_water, "Depends on the project");
  assert.equal(flat.q14_2, "");
  assert.equal(flat.q15_plant, "Polystichum munitum");
  assert.equal(flat.q15, "Under big-leaf maples,\nwith sword fern.");
  assert.equal(flat.q12, undefined);
});

test("a version 2 note (plain string) stays readable and is marked unassigned, never attached to a plant", () => {
  const legacy: ResponseRow = { ...sample, questions_version: 2, answers: { ...sample.answers, q15: "Salal for dry shade." } };
  const note = readPlantNote(legacy.answers.q15);
  assert.deepEqual(note, { plant: null, text: "Salal for dry shade.", legacy: true });
  const flat = flattenResponse(legacy);
  assert.equal(flat.q15_plant, "Unassigned");
  assert.equal(flat.q15, "Salal for dry shade.");
  assert.equal(flattenResponse({ ...sample, answers: { ...sample.answers, q15: "" } }).q15_plant, "");
});

test("grid marked not applicable exports as such", () => {
  const flat = flattenResponse({ ...sample, answers: { q7: { na: "yes" } } });
  assert.equal(flat.q7_hardiness, "Not applicable");
  assert.equal(flat.q7_availability, "Not applicable");
});

test("csv escapes quotes and newlines", () => {
  const csv = toCsv([sample]);
  assert.ok(csv.includes('| Other: Say ""hello"", then plant"'));
  assert.ok(csv.includes('"Under big-leaf maples,\nwith sword fern."'));
  assert.equal(csv.split("\r\n").length, 3);
});

test("every question is required; Q14 needs three plants, Q15 a listed plant and a note", () => {
  const q = (id: string) => ALL_QUESTIONS.find((x) => x.id === id)!;
  assert.equal(isComplete(q("q1"), undefined), false);
  assert.equal(isComplete(q("q1"), { selected: ["mla"] }), true);
  assert.equal(isComplete(q("q7"), { hardiness: "rule" }), false);
  assert.equal(isComplete(q("q7"), { na: "yes" }), true);
  // Q14: at least three non-blank names; whitespace does not count.
  assert.equal(isComplete(q("q14"), undefined), false);
  assert.equal(isComplete(q("q14"), ["Salal", "  ", "Sword fern"]), false);
  assert.equal(isComplete(q("q14"), ["Salal", "Sword fern", "Vine maple"]), true);
  assert.equal(isComplete(q("q14"), ["Salal", "Sword fern", "Vine maple", "", ""]), true);
  // Q15: a chosen plant and a non-blank note; the plant must still be on the list.
  const all = { q14: ["Salal", "Sword fern", "Vine maple"] };
  assert.equal(isComplete(q("q15"), undefined, all), false);
  assert.equal(isComplete(q("q15"), { plant: "Salal", text: "   " }, all), false);
  assert.equal(isComplete(q("q15"), { plant: "", text: "Shade." }, all), false);
  assert.equal(isComplete(q("q15"), { plant: "Salal", text: "Shade." }, all), true);
  assert.equal(isComplete(q("q15"), { plant: "Thuja plicata", text: "Shade." }, all), false, "a plant no longer on the list must be re-chosen");
  assert.equal(isComplete(q("q15"), "legacy text", all), false, "an old note without a plant is not a complete answer");
  // Progress counts only finished questions.
  const answered = (answers: Record<string, unknown>) => ALL_QUESTIONS.filter((x) => hasAnswer(x, answers[x.id] as never, answers as never)).length;
  assert.equal(answered({}), 0);
  assert.equal(answered({ q1: { selected: ["mla"] }, q14: ["Salal", "Sword fern"] }), 1);
  assert.equal(answered({ q1: { selected: ["mla"] }, q14: ["Salal", "Sword fern", "Vine maple"], q15: { plant: "Salal", text: "Shade." } }), 3);
  assert.equal(missingHint(q("q14")), "Please list at least 3 plants");
});

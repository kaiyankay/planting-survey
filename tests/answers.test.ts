import { test } from "node:test";
import assert from "node:assert/strict";
import { csvColumns, flattenResponse, hasAnswer, isComplete, toCsv, type ResponseRow } from "../src/lib/answers.ts";
import { ALL_QUESTIONS, SECTIONS } from "../src/questions.ts";

const sample: ResponseRow = {
  id: "00000000-0000-0000-0000-000000000001",
  submitted_at: "2026-10-28T10:00:00Z",
  duration_seconds: 171,
  questions_version: 2,
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
    q15: "Under big-leaf maples,\nwith sword fern.",
    // Keys from questionnaire version 1 that no longer exist must be ignored, not mapped elsewhere.
    q12: ["site", "concept"],
    q13: { selected: ["structure"] },
  },
};

test("exactly 15 questions in the agreed order", () => {
  assert.deepEqual(
    ALL_QUESTIONS.map((q) => q.id),
    ["q1", "q2", "q11", "q3", "q4", "q5", "q7", "q8", "q9", "q10", "q16", "q6", "q17", "q14", "q15"],
  );
  assert.equal(SECTIONS.length, 5);
  assert.ok(!ALL_QUESTIONS.some((q) => q.kind === ("ranking" as string)));
});

test("columns follow the question order with expanded grid and text list, no removed questions", () => {
  const cols = csvColumns();
  assert.deepEqual(cols.slice(0, 4), ["id", "submitted_at", "duration_seconds", "questions_version"]);
  assert.equal(cols.indexOf("q11") < cols.indexOf("q3"), true);
  assert.ok(cols.includes("q7_hardiness"));
  assert.ok(cols.includes("q16") && cols.includes("q17"));
  assert.ok(cols.includes("q14_5"));
  assert.ok(!cols.some((c) => c.startsWith("q12") || c.startsWith("q13")));
});

test("flatten resolves keys to labels and joins multi-selects", () => {
  const flat = flattenResponse(sample);
  assert.equal(flat.q1, "MLA student | Other: Horticulturist");
  assert.equal(flat.q2, "Academic or studio projects only");
  assert.equal(flat.q11, "General web search | AI tools");
  assert.equal(flat.q4, "I rarely use measurements");
  assert.equal(flat.q7_water, "Depends on the project");
  assert.equal(flat.q14_2, "");
  assert.equal(flat.q14_3, "Polystichum munitum");
  assert.equal(flat.q5, "");
  assert.equal(flat.q12, undefined);
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

test("completeness and answered rules", () => {
  const q = (id: string) => ALL_QUESTIONS.find((x) => x.id === id)!;
  assert.equal(isComplete(q("q1"), undefined), false);
  assert.equal(isComplete(q("q1"), { selected: ["mla"] }), true);
  assert.equal(isComplete(q("q7"), { hardiness: "rule" }), false);
  assert.equal(isComplete(q("q7"), { na: "yes" }), true);
  assert.equal(isComplete(q("q14"), undefined), true);
  assert.equal(hasAnswer(q("q14"), ["", " "]), false);
  assert.equal(hasAnswer(q("q14"), ["Salal"]), true);
  assert.equal(hasAnswer(q("q15"), ""), false);
  assert.equal(hasAnswer(q("q15"), "Shade."), true);
});

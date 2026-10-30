import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answersToStore,
  csvColumns,
  distinctEntries,
  flattenResponse,
  hasAnswer,
  hasExperience,
  isComplete,
  isRequired,
  missingHint,
  readPlantList,
  readPlantNote,
  toCsv,
  visibleQuestions,
  type Answers,
  type ResponseRow,
} from "../src/lib/answers.ts";
import { ALL_QUESTIONS, QUESTIONS_VERSION, SECTIONS } from "../src/questions.ts";

const q = (id: string) => ALL_QUESTIONS.find((x) => x.id === id)!;

const full: Answers = {
  a1: { selected: ["mla", "other"], other: "Horticulturist" },
  a2: { selected: ["studio", "gardening"] },
  b1: Object.fromEntries((q("b1") as { rows: { key: string }[] }).rows.map((r) => [r.key, "must_pass"])),
  b2: { selected: ["mature_size", "conflicting"] },
  b3: "",
  c1: { selected: ["development"] },
  c2: { selected: ["databases", "colleagues"] },
  c3: "Started from a precedent, checked sizes, dropped two for the wires, list went into Excel.",
  d1: "",
  d2: "evergreen shrubs for dry shade",
  e1: { selected: ["location", "season"] },
  e2: { selected: ["sources", "local_project"] },
  f1: { entries: [{ name: "Salal", role: "shrub", why: "dry shade" }, { name: "Sword fern", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] },
  f2: { plant: "Salal", text: "Used it on a slope; spreads once happy." },
};

const sample: ResponseRow = { id: "r1", submitted_at: "2026-11-03T10:00:00Z", duration_seconds: 410, questions_version: 1, answers: full };

test("fourteen questions in six sections, version 1, ids as in the spec", () => {
  assert.equal(QUESTIONS_VERSION, 1);
  assert.deepEqual(
    ALL_QUESTIONS.map((x) => x.id),
    ["a1", "a2", "b1", "b2", "b3", "c1", "c2", "c3", "d1", "d2", "e1", "e2", "f1", "f2"],
  );
  assert.deepEqual(
    SECTIONS.map((s) => s.id),
    ["about", "needs", "workflow", "asking", "trust", "plants"],
  );
  assert.deepEqual(
    ALL_QUESTIONS.map((x) => x.kind),
    ["checkbox", "checkbox", "grid3", "checkbox", "shorttext", "single", "checkbox", "longtext", "shorttext", "shorttext", "checkbox", "checkbox", "plantlist", "plantnote"],
  );
  assert.deepEqual(ALL_QUESTIONS.filter((x) => !isRequired(x)).map((x) => x.id), ["b3", "d1"]);
});

test("respondents with no experience are not shown b1, section C or section F; everyone else sees all 14", () => {
  assert.deepEqual(visibleQuestions({ a2: { selected: ["none"] } }).map((x) => x.id), ["a1", "a2", "b2", "b3", "d1", "d2", "e1", "e2"]);
  assert.equal(visibleQuestions({}).length, 14, "before a2 is answered everything is shown");
  assert.equal(visibleQuestions({ a2: { selected: ["gardening"] } }).length, 14, "personal gardening counts as experience");
  assert.equal(hasExperience({ a2: { selected: ["none"] } }), false);
  assert.equal(hasExperience({ a2: { selected: ["none", "studio"] } }), true);
});

test("hidden questions are omitted from what is stored; shown ones are kept", () => {
  const stored = answersToStore({ ...full, a2: { selected: ["none"] } });
  assert.deepEqual(Object.keys(stored).sort(), ["a1", "a2", "b2", "b3", "c1", "d1", "d2", "e1", "e2"].filter((k) => k !== "c1").sort());
  assert.equal(stored.b1, undefined);
  assert.equal(stored.f1, undefined);
  assert.equal(Object.keys(answersToStore(full)).length, 14);
  const trimmed = answersToStore({ ...full, f1: { entries: [{ name: "Salal", role: "shrub" }, { name: "", role: "" }, { name: " Sword fern ", role: "tree", why: " " }] } });
  assert.deepEqual(trimmed.f1, { entries: [{ name: "Salal", role: "shrub", why: undefined }, { name: "Sword fern", role: "tree", why: undefined }] }, "empty plant rows are dropped and names cleaned");
});

test("csv columns expand b1 rows and f1 rows; the open-text questions are single columns", () => {
  const cols = csvColumns();
  assert.deepEqual(cols.slice(0, 4), ["id", "submitted_at", "duration_seconds", "questions_version"]);
  assert.ok(cols.includes("b1_hardiness") && cols.includes("b1_invasive"));
  assert.ok(cols.includes("f1_1_name") && cols.includes("f1_5_why") && cols.includes("f1_not_applicable"));
  assert.deepEqual(cols.slice(-2), ["f2_plant", "f2"]);
  for (const id of ["b3", "c3", "d1", "d2"]) assert.ok(cols.includes(id));
});

test("flatten writes labels, roles and the note’s plant; hidden questions stay blank", () => {
  const flat = flattenResponse(sample);
  assert.equal(flat.a1, "MLA student | Other: Horticulturist");
  assert.equal(flat.b1_light, "Must pass");
  assert.equal(flat.c1, "During design development");
  assert.equal(flat.f1_1_name, "Salal");
  assert.equal(flat.f1_1_role, "Shrub");
  assert.equal(flat.f1_1_why, "dry shade");
  assert.equal(flat.f1_2_why, "");
  assert.equal(flat.f1_not_applicable, "");
  assert.equal(flat.f2_plant, "Salal");
  assert.equal(flat.questions_version, "1");
  const none = flattenResponse({ ...sample, answers: answersToStore({ ...full, a2: { selected: ["none"] } }) });
  assert.equal(none.b1_light, "");
  assert.equal(none.c3, "");
  assert.equal(none.f1_1_name, "");
  assert.equal(none.d2, "evergreen shrubs for dry shade");
  const csv = toCsv([sample]);
  assert.equal(csv.split("\r\n").length, 3);
});

test("f1 needs three different names each with a role; case and spacing do not make a name different", () => {
  const f1 = q("f1");
  assert.deepEqual(
    distinctEntries([
      { name: "Salal", role: "shrub" },
      { name: " salal ", role: "shrub" },
      { name: "SALAL", role: "tree" },
      { name: "Sword  fern", role: "perennial_grass" },
    ]).map((e) => e.name),
    ["Salal", "Sword  fern"],
  );
  const dup = { entries: [{ name: "Salal", role: "shrub" }, { name: "salal", role: "shrub" }, { name: "Sword fern", role: "perennial_grass" }] };
  assert.equal(isComplete(f1, dup), false);
  assert.equal(missingHint(f1, dup), "Please list 3 different plants");
  const noRole = { entries: [{ name: "Salal", role: "shrub" }, { name: "Sword fern", role: "" }, { name: "Vine maple", role: "tree" }] };
  assert.equal(isComplete(f1, noRole), false);
  assert.equal(missingHint(f1, noRole), "Choose a role for each plant");
  assert.equal(isComplete(f1, { entries: [{ name: "Salal", role: "shrub" }, { name: "Sword fern", role: "not_sure" }, { name: "Vine maple", role: "tree" }] }), true, "Not sure is a valid role");
  assert.equal(isComplete(f1, { entries: [{ name: "  ", role: "tree" }, { name: "Salal", role: "shrub" }] }), false);
  assert.equal(isComplete(f1, { not_applicable: true, entries: [{ name: "Salal", role: "" }] }), true);
  assert.deepEqual(readPlantList({ not_applicable: true, entries: [{ name: "Salal", role: "" }] }), { entries: [{ name: "Salal", role: "", why: undefined }], notApplicable: true });
});

test("f2 follows f1: a listed plant plus text, or not applicable when f1 is", () => {
  const f2 = q("f2");
  const withPlants = { f1: { entries: [{ name: "Salal", role: "shrub" }, { name: "Sword fern", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] } };
  assert.equal(isComplete(f2, { plant: "salal", text: "Spreads." }, withPlants), true);
  assert.equal(isComplete(f2, { plant: "Thuja plicata", text: "Spreads." }, withPlants), false);
  assert.equal(isComplete(f2, { plant: "Salal", text: "  " }, withPlants), false);
  assert.equal(isComplete(f2, { not_applicable: true }, withPlants), false);
  const na = { f1: { not_applicable: true as const, entries: [] } };
  assert.equal(isComplete(f2, { not_applicable: true }, na), true);
  assert.equal(isComplete(f2, { plant: "Salal", text: "x" }, na), false);
  assert.equal(missingHint(f2, undefined, na), "Tick the option above to continue");
  assert.deepEqual(readPlantNote({ not_applicable: true }), { plant: null, text: "", notApplicable: true });
});

test("progress counts complete answers and optional text only when written; required text must be non-blank", () => {
  const count = (answers: Answers) => visibleQuestions(answers).filter((x) => hasAnswer(x, answers[x.id], answers)).length;
  assert.equal(count({}), 0);
  assert.equal(count(full), 12, "b3 and d1 are blank, so 12 of 14");
  assert.equal(count({ ...full, b3: "Whether deer eat it", d1: "loose, green" }), 14);
  assert.equal(isComplete(q("c3"), "   "), false);
  assert.equal(isComplete(q("b3"), ""), true);
  assert.equal(hasAnswer(q("b3"), ""), false);
  assert.equal(missingHint(q("d2")), "Please write something here");
});

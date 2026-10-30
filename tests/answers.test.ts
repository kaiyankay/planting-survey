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
  a3: { selected: ["metro_vancouver"] },
  b1: Object.fromEntries((q("b1") as { rows: { key: string }[] }).rows.map((r) => [r.key, "must_pass"])),
  b2: { selected: ["mature_size", "conflicting"] },
  b3: { selected: ["keep_both"] },
  b4: "",
  c1: { selected: ["development"] },
  c2: { selected: ["databases", "colleagues"] },
  c3: "Started from a precedent, checked sizes, dropped two for the wires, list went into Excel.",
  d1: "",
  d2: "evergreen shrubs for dry shade",
  e1: { selected: ["location", "season"] },
  e2: { selected: ["sources", "local_project"] },
  f1: { entries: [{ name: "Salal", role: "shrub", why: "dry shade" }, { name: "Sword fern", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] },
  f2: { plant: "Salal", text: "Used it on a slope; spreads once happy.", basis: "project" },
};

const sample: ResponseRow = { id: "r1", submitted_at: "2026-11-03T10:00:00Z", duration_seconds: 410, questions_version: 1, answers: full };

test("sixteen questions in six sections, version 1, ids and order as in the spec", () => {
  assert.equal(QUESTIONS_VERSION, 1);
  assert.deepEqual(
    ALL_QUESTIONS.map((x) => x.id),
    ["a1", "a2", "a3", "b1", "b2", "b3", "b4", "c1", "c2", "c3", "f1", "f2", "d1", "d2", "e1", "e2"],
  );
  assert.deepEqual(
    SECTIONS.map((s) => s.id),
    ["about", "needs", "workflow", "plants", "asking", "trust"],
  );
  assert.deepEqual(
    ALL_QUESTIONS.map((x) => x.kind),
    ["checkbox", "checkbox", "single", "grid3", "checkbox", "single", "shorttext", "single", "checkbox", "longtext", "plantlist", "plantnote", "shorttext", "shorttext", "checkbox", "checkbox"],
  );
  assert.deepEqual(ALL_QUESTIONS.filter((x) => !isRequired(x)).map((x) => x.id), ["b4", "d1"]);
  const b1 = q("b1");
  assert.ok(b1.kind === "grid3" && b1.columns.map((c) => c.key).join() === "must_pass,compared,not_considered" && b1.help);
  const c1 = q("c1");
  assert.ok(c1.kind === "single" && c1.options.some((o) => o.key === "someone_else"));
  const c2 = q("c2");
  assert.ok(c2.kind === "checkbox" && c2.max === 3 && c2.options.length === 9 && c2.options.some((o) => o.key === "nursery_suppliers"));
  const e2 = q("e2");
  assert.ok(e2.kind === "checkbox" && e2.max === 2 && e2.help === "Choose up to 2");
  const f1 = q("f1");
  assert.ok(f1.kind === "plantlist" && f1.min === 1);
  const f2 = q("f2");
  assert.ok(f2.kind === "plantnote" && f2.basis.options.map((o) => o.key).join() === "project,observed,read,mixed");
});

test("respondents with no experience are not shown b1, section C or section F; everyone else sees all 14", () => {
  assert.deepEqual(visibleQuestions({ a2: { selected: ["none"] } }).map((x) => x.id), ["a1", "a2", "a3", "b2", "b3", "b4", "d1", "d2", "e1", "e2"]);
  assert.equal(visibleQuestions({}).length, 16, "before a2 is answered everything is shown");
  assert.equal(visibleQuestions({ a2: { selected: ["gardening"] } }).length, 16, "personal gardening counts as experience");
  assert.equal(hasExperience({ a2: { selected: ["none"] } }), false);
  assert.equal(hasExperience({ a2: { selected: ["none", "studio"] } }), true);
});

test("hidden questions are omitted from what is stored; shown ones are kept", () => {
  const stored = answersToStore({ ...full, a2: { selected: ["none"] } });
  assert.deepEqual(Object.keys(stored).sort(), ["a1", "a2", "a3", "b2", "b3", "b4", "d1", "d2", "e1", "e2"]);
  assert.equal(stored.b1, undefined);
  assert.equal(stored.f1, undefined);
  assert.equal(Object.keys(answersToStore(full)).length, 16);
  const trimmed = answersToStore({ ...full, f1: { entries: [{ name: "Salal", role: "shrub" }, { name: "", role: "" }, { name: " Sword fern ", role: "tree", why: " " }] } });
  assert.deepEqual(trimmed.f1, { entries: [{ name: "Salal", role: "shrub", why: undefined }, { name: "Sword fern", role: "tree", why: undefined }] }, "empty plant rows are dropped and names cleaned");
});

test("csv columns expand b1 rows and f1 rows; the open-text questions are single columns", () => {
  const cols = csvColumns();
  assert.deepEqual(cols.slice(0, 4), ["id", "submitted_at", "duration_seconds", "questions_version"]);
  assert.ok(cols.includes("b1_hardiness") && cols.includes("b1_invasive"));
  assert.ok(cols.includes("f1_1_name") && cols.includes("f1_5_why") && cols.includes("f1_not_applicable"));
  assert.ok(cols.includes("f2_plant") && cols.includes("f2") && cols.includes("f2_basis"));
  assert.ok(cols.indexOf("f2") < cols.indexOf("d1"), "f1 and f2 come before section D");
  for (const id of ["b3", "b4", "c3", "d1", "d2"]) assert.ok(cols.includes(id));
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
  assert.equal(flat.f2_basis, "Used in my own project");
  assert.equal(flat.b3, "Keep both values and note the range");
  assert.equal(flat.questions_version, "1");
  const none = flattenResponse({ ...sample, answers: answersToStore({ ...full, a2: { selected: ["none"] } }) });
  assert.equal(none.b1_light, "");
  assert.equal(none.c3, "");
  assert.equal(none.f1_1_name, "");
  assert.equal(none.d2, "evergreen shrubs for dry shade");
  const csv = toCsv([sample]);
  assert.equal(csv.split("\r\n").length, 3);
});

test("f1 needs at least one plant with a role; duplicate names (case and spacing ignored) do not count twice", () => {
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
  assert.equal(isComplete(f1, { entries: [{ name: "Salal", role: "shrub" }] }), true, "one plant with a role passes");
  assert.equal(isComplete(f1, { entries: [{ name: "Salal", role: "shrub" }, { name: "salal", role: "tree" }] }), true, "a duplicate does not hurt, it just counts once");
  const noRole = { entries: [{ name: "Salal", role: "" }] };
  assert.equal(isComplete(f1, noRole), false);
  assert.equal(missingHint(f1, noRole), "Choose a role for each plant");
  assert.equal(isComplete(f1, { entries: [{ name: "Salal", role: "not_sure" }] }), true, "Not sure is a valid role");
  assert.equal(isComplete(f1, { entries: [{ name: "  ", role: "tree" }] }), false);
  assert.equal(missingHint(f1, { entries: [] }), "Please list at least 1 plants, each with a role".replace("1 plants", "1 plant"));
  assert.equal(isComplete(f1, { not_applicable: true, entries: [{ name: "Salal", role: "" }] }), true);
  assert.deepEqual(readPlantList({ not_applicable: true, entries: [{ name: "Salal", role: "" }] }), { entries: [{ name: "Salal", role: "", why: undefined }], notApplicable: true });
});

test("f2 follows f1: a listed plant, text and a basis; or not applicable when f1 is", () => {
  const f2 = q("f2");
  const withPlants = { f1: { entries: [{ name: "Salal", role: "shrub" }, { name: "Sword fern", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] } };
  assert.equal(isComplete(f2, { plant: "salal", text: "Spreads.", basis: "observed" }, withPlants), true);
  assert.equal(isComplete(f2, { plant: "salal", text: "Spreads.", basis: "" }, withPlants), false, "no basis, not complete");
  assert.equal(isComplete(f2, { plant: "salal", text: "Spreads.", basis: "guess" }, withPlants), false, "unknown basis key");
  assert.equal(missingHint(f2, { plant: "Salal", text: "Spreads.", basis: "" }, withPlants), "Say what this note is based on");
  assert.equal(isComplete(f2, { plant: "Thuja plicata", text: "Spreads.", basis: "read" }, withPlants), false);
  assert.equal(isComplete(f2, { plant: "Salal", text: "  ", basis: "read" }, withPlants), false);
  assert.equal(isComplete(f2, { not_applicable: true }, withPlants), false);
  const na = { f1: { not_applicable: true as const, entries: [] } };
  assert.equal(isComplete(f2, { not_applicable: true }, na), true);
  assert.equal(isComplete(f2, { plant: "Salal", text: "x", basis: "project" }, na), false);
  assert.equal(missingHint(f2, undefined, na), "Tick the option above to continue");
  assert.deepEqual(readPlantNote({ not_applicable: true }), { plant: null, text: "", basis: "", notApplicable: true });
  assert.deepEqual(readPlantNote({ plant: " Salal ", text: " x ", basis: "mixed" }), { plant: "Salal", text: "x", basis: "mixed", notApplicable: false });
});

test("progress counts only the required questions shown: all of them done is 100% whatever the optional ones hold", () => {
  const required = (answers: Answers) => visibleQuestions(answers).filter(isRequired);
  const done = (answers: Answers) => required(answers).filter((x) => hasAnswer(x, answers[x.id], answers)).length;
  assert.equal(required(full).length, 14);
  assert.equal(done(full), 14, "b4 and d1 are blank but optional");
  assert.equal(required({ a2: { selected: ["none"] } }).length, 8);
  assert.equal(done({ ...full, a2: { selected: ["none"] } }), 8);
  assert.equal(done({}), 0);
  assert.equal(isComplete(q("c3"), "   "), false);
  assert.equal(isComplete(q("b4"), ""), true);
  assert.equal(hasAnswer(q("b4"), ""), false);
  assert.equal(missingHint(q("d2")), "Please write something here");
});

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
  c1: Object.fromEntries((q("c1") as { rows: { key: string }[] }).rows.map((r) => [r.key, "must_pass"])),
  c2: { selected: ["mature_size", "conflicting"] },
  c3: { selected: ["keep_both"] },
  c4: "",
  b1: { selected: ["development"] },
  b2: { selected: ["databases", "colleagues"] },
  b3: "Started from a precedent, checked sizes, dropped two for the wires, list went into Excel.",
  e1: "",
  e2: "evergreen shrubs for dry shade",
  f1: { selected: ["location", "season"] },
  f2: { selected: ["sources", "local_project"] },
  d1: { entries: [{ name: "Salal", role: "shrub", why: "dry shade" }, { name: "Sword fern", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] },
  d2: { plant: "Salal", text: "Used it on a slope; spreads once happy.", basis: "project" },
};

const sample: ResponseRow = { id: "r1", submitted_at: "2026-11-03T10:00:00Z", duration_seconds: 410, questions_version: 1, answers: full };

test("fifteen questions in six sections, version 1, ids and order as in the spec", () => {
  assert.equal(QUESTIONS_VERSION, 1);
  assert.deepEqual(
    ALL_QUESTIONS.map((x) => x.id),
    ["a1", "a2", "b1", "b2", "b3", "c1", "c2", "c3", "c4", "d1", "d2", "e1", "e2", "f1", "f2"],
  );
  assert.deepEqual(
    SECTIONS.map((s) => s.id),
    ["about", "workflow", "knowledge", "plants", "asking", "trust"],
  );
  assert.deepEqual(
    ALL_QUESTIONS.map((x) => x.kind),
    ["checkbox", "checkbox", "single", "checkbox", "longtext", "grid3", "checkbox", "single", "shorttext", "plantlist", "plantnote", "shorttext", "shorttext", "checkbox", "checkbox"],
  );
  assert.equal(q("c1").text, "In the project you just described, how did each attribute enter the decision?");
  assert.ok(!ALL_QUESTIONS.some((x) => x.id === "a3"));
  assert.deepEqual(ALL_QUESTIONS.filter((x) => !isRequired(x)).map((x) => x.id), ["c4", "e1"]);
  const c1 = q("c1");
  assert.ok(c1.kind === "grid3" && c1.columns.map((c) => c.key).join() === "must_pass,compared,not_considered" && c1.help);
  const b1 = q("b1");
  assert.ok(b1.kind === "single" && b1.options.some((o) => o.key === "someone_else"));
  const b2 = q("b2");
  assert.ok(b2.kind === "checkbox" && b2.max === 3 && b2.options.length === 9 && b2.options.some((o) => o.key === "nursery_suppliers"));
  const f2 = q("f2");
  assert.ok(f2.kind === "checkbox" && f2.max === 2 && f2.help === "Choose up to 2");
  const d1 = q("d1");
  assert.ok(d1.kind === "plantlist" && d1.min === 1);
  const d2 = q("d2");
  assert.ok(d2.kind === "plantnote" && d2.basis.options.map((o) => o.key).join() === "project,observed,read,mixed");
});

test("respondents with no experience are not shown c1, section C or section F; everyone else sees all 14", () => {
  assert.deepEqual(visibleQuestions({ a2: { selected: ["none"] } }).map((x) => x.id), ["a1", "a2", "c2", "c3", "c4", "e1", "e2", "f1", "f2"]);
  assert.equal(visibleQuestions({}).length, 15, "before a2 is answered everything is shown");
  assert.equal(visibleQuestions({ a2: { selected: ["gardening"] } }).length, 15, "personal gardening counts as experience");
  assert.equal(hasExperience({ a2: { selected: ["none"] } }), false);
  assert.equal(hasExperience({ a2: { selected: ["none", "studio"] } }), true);
});

test("hidden questions are omitted from what is stored; shown ones are kept", () => {
  const stored = answersToStore({ ...full, a2: { selected: ["none"] } });
  assert.deepEqual(Object.keys(stored).sort(), ["a1", "a2", "c2", "c3", "c4", "e1", "e2", "f1", "f2"]);
  assert.equal(stored.b3, undefined);
  assert.equal(stored.c1, undefined);
  assert.equal(stored.d1, undefined);
  assert.equal(Object.keys(answersToStore(full)).length, 15);
  const trimmed = answersToStore({ ...full, d1: { entries: [{ name: "Salal", role: "shrub" }, { name: "", role: "" }, { name: " Sword fern ", role: "tree", why: " " }] } });
  assert.deepEqual(trimmed.d1, { entries: [{ name: "Salal", role: "shrub", why: undefined }, { name: "Sword fern", role: "tree", why: undefined }] }, "empty plant rows are dropped and names cleaned");
});

test("csv columns expand c1 rows and d1 rows; the open-text questions are single columns", () => {
  const cols = csvColumns();
  assert.deepEqual(cols.slice(0, 4), ["id", "submitted_at", "duration_seconds", "questions_version"]);
  assert.ok(cols.includes("c1_hardiness") && cols.includes("c1_invasive"));
  assert.ok(cols.includes("d1_1_name") && cols.includes("d1_5_why") && cols.includes("d1_not_applicable"));
  assert.ok(cols.includes("d2_plant") && cols.includes("d2") && cols.includes("d2_basis"));
  assert.ok(cols.indexOf("d2") < cols.indexOf("e1"), "d1 and d2 come before section E");
  assert.ok(cols.indexOf("b3") < cols.indexOf("c1_hardiness"), "section B comes before section C");
  assert.ok(!cols.includes("a3"));
  for (const id of ["c3", "c4", "b3", "e1", "e2"]) assert.ok(cols.includes(id));
});

test("flatten writes labels, roles and the note’s plant; hidden questions stay blank", () => {
  const flat = flattenResponse(sample);
  assert.equal(flat.a1, "MLA student | Other: Horticulturist");
  assert.equal(flat.c1_light, "Must pass");
  assert.equal(flat.b1, "During design development");
  assert.equal(flat.d1_1_name, "Salal");
  assert.equal(flat.d1_1_role, "Shrub");
  assert.equal(flat.d1_1_why, "dry shade");
  assert.equal(flat.d1_2_why, "");
  assert.equal(flat.d1_not_applicable, "");
  assert.equal(flat.d2_plant, "Salal");
  assert.equal(flat.d2_basis, "Used in my own project");
  assert.equal(flat.c3, "Keep both values and note the range");
  assert.equal(flat.questions_version, "1");
  const none = flattenResponse({ ...sample, answers: answersToStore({ ...full, a2: { selected: ["none"] } }) });
  assert.equal(none.c1_light, "");
  assert.equal(none.b3, "");
  assert.equal(none.d1_1_name, "");
  assert.equal(none.e2, "evergreen shrubs for dry shade");
  const csv = toCsv([sample]);
  assert.equal(csv.split("\r\n").length, 3);
});

test("d1 needs at least one plant with a role; duplicate names (case and spacing ignored) do not count twice", () => {
  const d1 = q("d1");
  assert.deepEqual(
    distinctEntries([
      { name: "Salal", role: "shrub" },
      { name: " salal ", role: "shrub" },
      { name: "SALAL", role: "tree" },
      { name: "Sword  fern", role: "perennial_grass" },
    ]).map((e) => e.name),
    ["Salal", "Sword  fern"],
  );
  assert.equal(isComplete(d1, { entries: [{ name: "Salal", role: "shrub" }] }), true, "one plant with a role passes");
  assert.equal(isComplete(d1, { entries: [{ name: "Salal", role: "shrub" }, { name: "salal", role: "tree" }] }), true, "a duplicate does not hurt, it just counts once");
  const noRole = { entries: [{ name: "Salal", role: "" }] };
  assert.equal(isComplete(d1, noRole), false);
  assert.equal(missingHint(d1, noRole), "Choose a role for each plant");
  assert.equal(isComplete(d1, { entries: [{ name: "Salal", role: "not_sure" }] }), true, "Not sure is a valid role");
  assert.equal(isComplete(d1, { entries: [{ name: "  ", role: "tree" }] }), false);
  assert.equal(missingHint(d1, { entries: [] }), "Please list at least 1 plants, each with a role".replace("1 plants", "1 plant"));
  assert.equal(isComplete(d1, { not_applicable: true, entries: [{ name: "Salal", role: "" }] }), true);
  assert.deepEqual(readPlantList({ not_applicable: true, entries: [{ name: "Salal", role: "" }] }), { entries: [{ name: "Salal", role: "", why: undefined }], notApplicable: true });
});

test("d2 follows d1: a listed plant, text and a basis; or not applicable when d1 is", () => {
  const d2 = q("d2");
  const withPlants = { d1: { entries: [{ name: "Salal", role: "shrub" }, { name: "Sword fern", role: "perennial_grass" }, { name: "Vine maple", role: "tree" }] } };
  assert.equal(isComplete(d2, { plant: "salal", text: "Spreads.", basis: "observed" }, withPlants), true);
  assert.equal(isComplete(d2, { plant: "salal", text: "Spreads.", basis: "" }, withPlants), false, "no basis, not complete");
  assert.equal(isComplete(d2, { plant: "salal", text: "Spreads.", basis: "guess" }, withPlants), false, "unknown basis key");
  assert.equal(missingHint(d2, { plant: "Salal", text: "Spreads.", basis: "" }, withPlants), "Say what this note is based on");
  assert.equal(isComplete(d2, { plant: "Thuja plicata", text: "Spreads.", basis: "read" }, withPlants), false);
  assert.equal(isComplete(d2, { plant: "Salal", text: "  ", basis: "read" }, withPlants), false);
  assert.equal(isComplete(d2, { not_applicable: true }, withPlants), false);
  const na = { d1: { not_applicable: true as const, entries: [] } };
  assert.equal(isComplete(d2, { not_applicable: true }, na), true);
  assert.equal(isComplete(d2, { plant: "Salal", text: "x", basis: "project" }, na), false);
  assert.equal(missingHint(d2, undefined, na), "Tick the option above to continue");
  assert.deepEqual(readPlantNote({ not_applicable: true }), { plant: null, text: "", basis: "", notApplicable: true });
  assert.deepEqual(readPlantNote({ plant: " Salal ", text: " x ", basis: "mixed" }), { plant: "Salal", text: "x", basis: "mixed", notApplicable: false });
});

test("progress counts only the required questions shown: all of them done is 100% whatever the optional ones hold", () => {
  const required = (answers: Answers) => visibleQuestions(answers).filter(isRequired);
  const done = (answers: Answers) => required(answers).filter((x) => hasAnswer(x, answers[x.id], answers)).length;
  assert.equal(required(full).length, 13);
  assert.equal(done(full), 13, "c4 and e1 are blank but optional");
  assert.equal(required({ a2: { selected: ["none"] } }).length, 7);
  assert.equal(done({ ...full, a2: { selected: ["none"] } }), 7);
  assert.equal(done({}), 0);
  assert.equal(isComplete(q("b3"), "   "), false);
  assert.equal(isComplete(q("c4"), ""), true);
  assert.equal(hasAnswer(q("c4"), ""), false);
  assert.equal(missingHint(q("e2")), "Please write something here");
});

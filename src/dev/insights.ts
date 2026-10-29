/**
 * Database Insights: the survey read as evidence for what a plant knowledge
 * database should contain and how it should be organised.
 *
 * Three things are kept apart on purpose:
 *  - Survey evidence: counts and shares computed from the responses, with the
 *    number of respondents each share is based on.
 *  - Suggested implication: the REQUIREMENTS catalogue below, written by the
 *    research team before seeing results. Each item names the survey options
 *    that count as evidence for it. The survey ranks items; it never adds or
 *    removes them.
 *  - Research decision: a status and rationale the researchers record for
 *    each item (stored in the database, see data.ts). Every item starts as
 *    Proposed; nothing here approves anything.
 */
import { ALL_QUESTIONS, QUESTIONS_VERSION, type Question } from "../questions.ts";
import type { ResponseRow } from "../lib/answers.ts";
import { choiceStats, gridStats, otherTexts, type ChoiceStats, type GridStats } from "../lib/analysis.ts";
import type { Decision, DecisionStatus } from "./data.ts";

export type Dimension = { id: string; title: string; question: string; questions: string[] };

export const DIMENSIONS: Dimension[] = [
  { id: "attributes", title: "Plant attributes", question: "Which quantitative and qualitative attributes matter most?", questions: ["q3", "q4", "q5"] },
  { id: "constraints", title: "Design constraints", question: "Which conditions act as requirements, and which as preferences?", questions: ["q7"] },
  { id: "gaps", title: "Knowledge gaps", question: "Which information is hard to obtain or verify?", questions: ["q8"] },
  { id: "personal", title: "Personal knowledge", question: "How do people keep their own experience, and what would they record?", questions: ["q9", "q10"] },
  { id: "context", title: "Contextual knowledge", question: "What context makes someone else’s observation usable?", questions: ["q16"] },
  { id: "retrieval", title: "Knowledge retrieval", question: "How do people describe what they want, and how would they search?", questions: ["q6", "q17"] },
];

export type Category = "plant attribute" | "qualitative description" | "observation" | "retrieval feature";

/** A survey option counted as evidence for a requirement. Grid rows are evidence of how a condition is treated, not of a filter rule. */
export type EvidenceRef = { question: string; option: string } | { question: string; row: string };

export type Requirement = {
  id: string;
  label: string;
  category: Category;
  dimension: string;
  evidence: EvidenceRef[];
  /** Basic botanical fields a plant database needs regardless of votes; low counts are not grounds for exclusion. */
  core?: boolean;
};

export const REQUIREMENTS: Requirement[] = [
  // Plant attributes
  { id: "attr.scientific_name", label: "Scientific and common names", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q17", option: "by_name" }], core: true },
  { id: "attr.hardiness_zone", label: "Hardiness zone", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "zone" }, { question: "q3", option: "site_suitability" }, { question: "q7", row: "hardiness" }], core: true },
  { id: "attr.light", label: "Light requirement", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "site_suitability" }, { question: "q7", row: "light" }], core: true },
  { id: "attr.water", label: "Water requirement", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "site_suitability" }, { question: "q7", row: "water" }], core: true },
  { id: "attr.soil", label: "Soil tolerance", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "site_suitability" }], core: true },
  { id: "attr.mature_height", label: "Mature height", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "height" }, { question: "q3", option: "growth_size" }, { question: "q7", row: "size" }], core: true },
  { id: "attr.mature_spread", label: "Mature spread", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "spread" }, { question: "q3", option: "growth_size" }, { question: "q7", row: "size" }], core: true },
  { id: "attr.spacing", label: "Planting spacing or density", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "spacing" }] },
  { id: "attr.growth_rate", label: "Growth rate", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "growth_rate" }, { question: "q3", option: "growth_size" }] },
  { id: "attr.years_to_effect", label: "Years to intended effect", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "years_to_effect" }] },
  { id: "attr.purchase_size", label: "Size at purchase (pot size, caliper)", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q4", option: "purchase_size" }, { question: "q3", option: "availability_specs" }] },
  { id: "attr.native_status", label: "Native status", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "ecology_native" }, { question: "q7", row: "native" }], core: true },
  { id: "attr.ecological_value", label: "Ecological value (habitat, pollinators)", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "ecology_native" }, { question: "q6", option: "ecological" }] },
  { id: "attr.maintenance", label: "Maintenance needs", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "maintenance_performance" }] },
  { id: "attr.problems", label: "Known problems (pests, disease, invasiveness)", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "maintenance_performance" }] },
  { id: "attr.availability", label: "Nursery availability and cost", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "availability_specs" }, { question: "q7", row: "availability" }, { question: "q8", option: "availability_cost" }] },
  { id: "attr.combinations", label: "Companion plants and alternatives", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "combinations" }, { question: "q17", option: "alternatives" }] },
  { id: "attr.precedents", label: "Precedent projects and places where it is used", category: "plant attribute", dimension: "attributes", evidence: [{ question: "q3", option: "real_projects" }, { question: "q17", option: "projects" }] },
  // Qualitative description
  { id: "desc.form", label: "Form and habit", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "form" }, { question: "q3", option: "appearance" }] },
  { id: "desc.texture", label: "Texture (fine to coarse)", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "texture" }] },
  { id: "desc.foliage", label: "Foliage colour", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "foliage" }] },
  { id: "desc.flower", label: "Flower colour and timing", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "flower" }, { question: "q3", option: "appearance" }] },
  { id: "desc.seasonal", label: "Autumn and winter interest", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "autumn_winter" }, { question: "q3", option: "appearance" }] },
  { id: "desc.character", label: "Character tags (wild, formal, lush …)", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "character" }, { question: "q6", option: "mood" }] },
  { id: "desc.mass", label: "Reading in a mass or at a distance", category: "qualitative description", dimension: "attributes", evidence: [{ question: "q5", option: "mass" }] },
  { id: "desc.photos", label: "Photographs by season and age", category: "qualitative description", dimension: "gaps", evidence: [{ question: "q8", option: "photos" }, { question: "q10", option: "photos" }] },
  // Observations (knowledge gaps, personal records, context)
  { id: "obs.local_growth", label: "Observed growth and size under local conditions", category: "observation", dimension: "gaps", evidence: [{ question: "q8", option: "local_growth" }] },
  { id: "obs.long_term", label: "Long-term performance and maintenance experience", category: "observation", dimension: "gaps", evidence: [{ question: "q8", option: "long_term" }, { question: "q10", option: "performance" }, { question: "q10", option: "maintenance" }] },
  { id: "obs.combinations", label: "How plants performed together", category: "observation", dimension: "gaps", evidence: [{ question: "q8", option: "together" }, { question: "q10", option: "combinations" }] },
  { id: "obs.failures", label: "Site-specific problems and failures", category: "observation", dimension: "gaps", evidence: [{ question: "q8", option: "site_problems" }, { question: "q10", option: "warning" }] },
  { id: "obs.supplier", label: "Where it was bought and at what size", category: "observation", dimension: "personal", evidence: [{ question: "q10", option: "where_to_buy" }] },
  { id: "obs.rating", label: "Personal rating or tags", category: "observation", dimension: "personal", evidence: [{ question: "q10", option: "rating" }] },
  { id: "obs.import_lists", label: "Import personal lists, spreadsheets and plant schedules", category: "observation", dimension: "personal", evidence: [{ question: "q9", option: "own_list" }, { question: "q9", option: "project_files" }] },
  { id: "obs.images", label: "Attach saved images and precedent boards", category: "observation", dimension: "personal", evidence: [{ question: "q9", option: "images" }] },
  { id: "obs.quick_capture", label: "Quick capture of notes (much is only remembered)", category: "observation", dimension: "personal", evidence: [{ question: "q9", option: "notes" }, { question: "q9", option: "memory" }, { question: "q9", option: "lost" }] },
  { id: "obs.location", label: "Observation: location or region", category: "observation", dimension: "context", evidence: [{ question: "q16", option: "location" }] },
  { id: "obs.site_conditions", label: "Observation: site conditions", category: "observation", dimension: "context", evidence: [{ question: "q16", option: "site_conditions" }] },
  { id: "obs.plant_age", label: "Observation: plant age or years since planting", category: "observation", dimension: "context", evidence: [{ question: "q16", option: "plant_age" }] },
  { id: "obs.date", label: "Observation: date or season", category: "observation", dimension: "context", evidence: [{ question: "q16", option: "date_season" }] },
  { id: "obs.maintenance_practice", label: "Observation: maintenance practices", category: "observation", dimension: "context", evidence: [{ question: "q16", option: "maintenance" }] },
  { id: "obs.source", label: "Observation: observer or source", category: "observation", dimension: "context", evidence: [{ question: "q16", option: "source" }], core: true },
  // Retrieval features
  { id: "find.name", label: "Search by plant name", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "by_name" }, { question: "q6", option: "names" }] },
  { id: "find.site", label: "Filter by site conditions", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "by_site" }, { question: "q6", option: "site" }] },
  { id: "find.visual", label: "Search by visual character or atmosphere", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "by_visual" }, { question: "q6", option: "mood" }, { question: "q6", option: "colour" }] },
  { id: "find.ecology", label: "Search by ecological function", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "by_ecology" }, { question: "q6", option: "ecological" }] },
  { id: "find.spatial", label: "Filter by spatial role (screen, canopy, groundcover, edge)", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q6", option: "spatial" }] },
  { id: "find.references", label: "Search from reference projects or images", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q6", option: "references" }, { question: "q17", option: "projects" }] },
  { id: "find.compare", label: "Side-by-side attribute comparison", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "compare" }] },
  { id: "find.alternatives", label: "Similar or alternative plants", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "alternatives" }] },
  { id: "find.own_records", label: "Search own records and observations", category: "retrieval feature", dimension: "retrieval", evidence: [{ question: "q17", option: "own_records" }] },
];

export const DECISION_LABELS: Record<DecisionStatus, string> = { proposed: "Proposed", include: "Include", defer: "Defer", exclude: "Exclude" };

export type QuestionResult =
  | { id: string; text: string; kind: "choice"; stats: ChoiceStats; other: string[] }
  | { id: string; text: string; kind: "grid"; stats: GridStats; columns: { key: string; label: string }[] };

export type Evidence = {
  ref: EvidenceRef;
  /** For a grid row, the label of the row; for an option, its label. */
  label: string;
  question_number: number;
  n: number;
  count: number;
  share: number;
  /** Grid rows only: distribution across the columns. */
  distribution?: { col: string; label: string; count: number; share: number }[];
};

export type RequirementResult = Requirement & { evidence_results: Evidence[]; decision: Decision };

export type DimensionResult = {
  id: string;
  title: string;
  question: string;
  results: QuestionResult[];
  findings: string[];
  requirements: RequirementResult[];
};

const byId = (id: string): Question => ALL_QUESTIONS.find((q) => q.id === id)!;
const numberOf = (id: string) => ALL_QUESTIONS.findIndex((q) => q.id === id) + 1;
const pct = (x: number) => `${Math.round(x * 100)}%`;

function resultFor(q: Question, rows: ResponseRow[]): QuestionResult {
  if (q.kind === "grid") return { id: q.id, text: q.text, kind: "grid", stats: gridStats(q, rows), columns: q.columns };
  if (q.kind === "checkbox" || q.kind === "single") return { id: q.id, text: q.text, kind: "choice", stats: choiceStats(q, rows), other: otherTexts(q, rows) };
  throw new Error(`Question ${q.id} has no options to count`);
}

/** Plain statements of what the counts show, with their base n. Nothing about importance. */
export function findingsFor(result: QuestionResult): string[] {
  const num = numberOf(result.id);
  if (result.kind === "choice") {
    const { n, counts, unknown } = result.stats;
    if (n === 0) return [`Q${num}: no answers in this selection.`];
    const top = [...counts].filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
    const line = `Q${num} (n = ${n}): most chosen ${top.map((c) => `${c.label} (${c.count}, ${pct(c.share)})`).join("; ")}.`;
    return unknown > 0 ? [line, `Q${num}: ${unknown} selection${unknown === 1 ? "" : "s"} refer to options from an earlier questionnaire version and are not counted above.`] : [line];
  }
  const { answered, notApplicable, rows } = result.stats;
  if (answered === 0) return [`Q${num}: no answers in this selection.`];
  const out = [`Q${num}: ${answered} answered, ${notApplicable} not applicable; row shares use only those who answered that row.`];
  for (const row of rows) {
    if (row.n === 0) continue;
    const best = [...row.cells].sort((a, b) => b.count - a.count)[0];
    const col = result.columns.find((c) => c.key === best.col)!;
    out.push(`${row.label} (n = ${row.n}): most often “${col.label}” (${best.count}, ${pct(best.share)}).`);
  }
  return out;
}

function evidenceFor(ref: EvidenceRef, results: Map<string, QuestionResult>): Evidence | null {
  const r = results.get(ref.question);
  if (!r) return null;
  if ("option" in ref) {
    if (r.kind !== "choice") return null;
    const c = r.stats.counts.find((x) => x.key === ref.option);
    if (!c) return null;
    return { ref, label: c.label, question_number: numberOf(ref.question), n: r.stats.n, count: c.count, share: c.share };
  }
  if (r.kind !== "grid") return null;
  const row = r.stats.rows.find((x) => x.key === ref.row);
  if (!row) return null;
  const treated = row.cells.filter((c) => c.col !== "not").reduce((s, c) => s + c.count, 0);
  return {
    ref,
    label: row.label,
    question_number: numberOf(ref.question),
    n: row.n,
    count: treated,
    share: row.n ? treated / row.n : 0,
    distribution: row.cells.map((c) => ({ col: c.col, label: r.columns.find((x) => x.key === c.col)?.label ?? c.col, count: c.count, share: c.share })),
  };
}

/** Results for every question any dimension uses, computed once per selection. */
export function questionResults(rows: ResponseRow[]): Map<string, QuestionResult> {
  const ids = new Set(DIMENSIONS.flatMap((d) => d.questions));
  for (const r of REQUIREMENTS) for (const e of r.evidence) ids.add(e.question);
  return new Map([...ids].map((id) => [id, resultFor(byId(id), rows)]));
}

export function buildInsights(rows: ResponseRow[], decisions: Decision[]): DimensionResult[] {
  const results = questionResults(rows);
  const decided = new Map(decisions.map((d) => [d.requirement_id, d]));
  return DIMENSIONS.map((d) => {
    const dimResults = d.questions.map((id) => results.get(id)!);
    return {
      id: d.id,
      title: d.title,
      question: d.question,
      results: dimResults,
      findings: dimResults.flatMap(findingsFor),
      requirements: REQUIREMENTS.filter((r) => r.dimension === d.id).map((r) => ({
        ...r,
        evidence_results: r.evidence.map((e) => evidenceFor(e, results)).filter((e): e is Evidence => e !== null),
        decision: decided.get(r.id) ?? { requirement_id: r.id, status: "proposed", rationale: null },
      })),
    };
  });
}

export function requirementsExport(rows: ResponseRow[], decisions: Decision[], filter: unknown) {
  const dims = buildInsights(rows, decisions);
  return {
    generated_at: new Date().toISOString(),
    questions_version: QUESTIONS_VERSION,
    responses: rows.length,
    filter,
    notes: [
      "survey_evidence: counts from the responses in this selection; shares are of the respondents who answered the question (n). An option nobody chose is zero, not unimportant.",
      "suggested_implication: the requirements catalogue written by the research team; the survey ranks it and never adds or removes items.",
      "research_decision: status and rationale recorded by the researchers. Proposed means not yet decided. Nothing is approved automatically.",
      "Q7 rows are evidence of how designers treat a condition; they are not converted into filters or weights.",
      "core: basic botanical fields a plant database needs; low survey counts are not grounds for excluding them.",
      "Survey results describe respondents’ practice and preferences, not verified facts about plants.",
    ],
    dimensions: dims.map((d) => ({
      id: d.id,
      title: d.title,
      question: d.question,
      survey_evidence: d.results.map((r) =>
        r.kind === "choice"
          ? { question_id: r.id, text: r.text, n: r.stats.n, counts: r.stats.counts, unknown_selections: r.stats.unknown, other: r.other }
          : { question_id: r.id, text: r.text, answered: r.stats.answered, not_applicable: r.stats.notApplicable, rows: r.stats.rows },
      ),
      findings: d.findings,
      requirements: d.requirements.map((r) => ({
        id: r.id,
        label: r.label,
        category: r.category,
        core: Boolean(r.core),
        suggested_implication: { evidence: r.evidence },
        survey_evidence: r.evidence_results,
        research_decision: { status: r.decision.status, rationale: r.decision.rationale, updated_by: r.decision.updated_by ?? null, updated_at: r.decision.updated_at ?? null },
      })),
    })),
  };
}

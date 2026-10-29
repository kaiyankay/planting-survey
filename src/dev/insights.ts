/**
 * Database Insights: the survey read as evidence for what a plant knowledge
 * database should contain and how it should be organised.
 *
 * Two things are kept apart on purpose:
 *  - Survey results: counts and shares computed from the responses.
 *  - Database implications: suggestions written here, in IMPLICATIONS, keyed
 *    by the option respondents could choose. They are design hypotheses that
 *    the counts rank, not findings the survey proved.
 */
import { ALL_QUESTIONS, QUESTIONS_VERSION, type CheckboxQuestion, type GridQuestion, type Question, type SingleQuestion } from "../questions.ts";
import type { ResponseRow } from "../lib/answers.ts";
import { choiceCounts, gridCounts, gridNotApplicable, type Count, type GridCell } from "../lib/analysis.ts";

export type Dimension = {
  id: string;
  title: string;
  question: string;
  questions: string[];
};

export const DIMENSIONS: Dimension[] = [
  {
    id: "attributes",
    title: "Plant attributes",
    question: "Which quantitative and qualitative attributes matter most?",
    questions: ["q3", "q4", "q5"],
  },
  {
    id: "constraints",
    title: "Design constraints",
    question: "Which conditions act as hard requirements, and which as preferences?",
    questions: ["q7"],
  },
  {
    id: "gaps",
    title: "Knowledge gaps",
    question: "Which information is hard to obtain or verify?",
    questions: ["q8"],
  },
  {
    id: "personal",
    title: "Personal knowledge",
    question: "How do people keep their own experience, and what would they record?",
    questions: ["q9", "q10"],
  },
  {
    id: "context",
    title: "Contextual knowledge",
    question: "What context makes someone else’s observation usable?",
    questions: ["q16"],
  },
  {
    id: "retrieval",
    title: "Knowledge retrieval",
    question: "How do people describe what they want, and how would they search?",
    questions: ["q6", "q17"],
  },
];

/** Suggested field or feature per option. Written by the research team; ranked by the survey. */
export const IMPLICATIONS: Record<string, Record<string, string>> = {
  q3: {
    site_suitability: "Fields: hardiness zone, light, water and soil tolerance",
    growth_size: "Fields: mature height and spread, growth rate, size at 5 and 10 years",
    appearance: "Fields: form, texture, foliage and flower colour, seasonal interest; photos by season",
    maintenance_performance: "Fields: maintenance needs, known problems, long-term performance notes",
    ecology_native: "Fields: native status, ecological value, habitat and pollinator roles",
    combinations: "Relations: companion plants and alternatives",
    availability_specs: "Fields: nursery availability, cost, planting size and spacing",
    real_projects: "Relations: precedent projects and local observations, with location",
    other: "Read the free-text answers before adding fields",
  },
  q4: {
    height: "Field: mature height",
    spread: "Field: mature spread",
    spacing: "Field: planting spacing or density",
    growth_rate: "Field: growth rate",
    years_to_effect: "Field: years to intended effect",
    zone: "Field: hardiness zone",
    purchase_size: "Field: size at purchase (pot size, caliper)",
    rarely: "Numbers can sit behind the main view rather than lead it",
  },
  q5: {
    texture: "Field: texture (fine to coarse)",
    form: "Field: form and habit",
    foliage: "Field: foliage colour",
    flower: "Field: flower colour and timing",
    autumn_winter: "Field: autumn and winter interest",
    character: "Field: character tags (wild, formal, lush …)",
    mass: "Field: reading in mass or at distance; mass-planting photos",
  },
  q8: {
    local_growth: "Capture observed size and growth under local conditions, with location and plant age",
    long_term: "Capture performance and maintenance over years, not only at planting",
    photos: "Photo library organised by season and age",
    together: "Record combinations and how they performed",
    availability_cost: "Track nursery availability and cost, dated",
    site_problems: "Record failures and site-specific problems",
    other: "Read the free-text answers",
  },
  q9: {
    own_list: "Import personal plant lists and spreadsheets",
    project_files: "Link plant schedules from past projects",
    images: "Store images and precedent boards against plants",
    notes: "Personal notes attached to a plant",
    memory: "Make capture quick: much of this knowledge is only remembered",
    ask: "Shared records between colleagues",
    lost: "Retrieval matters: notes must be searchable",
  },
  q10: {
    performance: "Record type: performance in a named project",
    maintenance: "Record type: maintenance actually needed",
    combinations: "Record type: combinations that worked",
    where_to_buy: "Record type: supplier and size bought",
    warning: "Record type: warning or caveat",
    rating: "Record type: personal rating or tags",
    photos: "Record type: own photos",
    nothing: "Personal records stay optional",
  },
  q16: {
    location: "Observation field: location or region",
    site_conditions: "Observation field: site conditions",
    plant_age: "Observation field: plant age or years since planting",
    date_season: "Observation field: date or season",
    maintenance: "Observation field: maintenance practices",
    source: "Observation field: observer or source",
    other: "Read the free-text answers",
  },
  q6: {
    mood: "Search by mood or atmosphere tags",
    colour: "Search by colour theme",
    references: "Search from reference projects or images",
    names: "Search by plant name",
    ecological: "Filter by ecological function",
    spatial: "Filter by spatial role (screen, canopy, groundcover, edge)",
    site: "Filter by site conditions",
  },
  q17: {
    by_name: "Feature: name search",
    by_site: "Feature: filter by site conditions",
    by_visual: "Feature: search by visual character or atmosphere",
    by_ecology: "Feature: search by ecological function",
    compare: "Feature: side-by-side attribute comparison",
    alternatives: "Feature: similar or alternative plants",
    projects: "Feature: browse real projects that used a plant",
    own_records: "Feature: search own records and observations",
    other: "Read the free-text answers",
  },
};

/** What each Q7 column means for the database, if it is the most common answer for a row. */
export const GRID_IMPLICATIONS: Record<string, string> = {
  rule: "hard filter",
  preference: "weighted preference",
  depends: "project-level setting",
  not: "optional field",
};

export type Implication = { question_id: string; option_key: string; suggestion: string; count: number; share: number };

export type QuestionResult =
  | { id: string; text: string; kind: "choice"; counts: Count[]; respondents: number }
  | { id: string; text: string; kind: "grid"; cells: GridCell[]; not_applicable: number; respondents: number; rows: { key: string; label: string }[]; columns: { key: string; label: string }[] };

export type DimensionResult = {
  id: string;
  title: string;
  question: string;
  results: QuestionResult[];
  findings: string[];
  implications: Implication[];
};

const byId = (id: string): Question => ALL_QUESTIONS.find((q) => q.id === id)!;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Respondents who gave any answer to the question (the base for shares). */
function answeredCount(q: Question, rows: ResponseRow[]): number {
  return rows.filter((r) => r.answers[q.id] !== undefined).length;
}

function choiceResult(q: CheckboxQuestion | SingleQuestion, rows: ResponseRow[]): QuestionResult {
  const answered = rows.filter((r) => r.answers[q.id] !== undefined);
  return { id: q.id, text: q.text, kind: "choice", counts: choiceCounts(q, answered), respondents: answered.length };
}

function gridResult(q: GridQuestion, rows: ResponseRow[]): QuestionResult {
  const answered = rows.filter((r) => r.answers[q.id] !== undefined);
  return {
    id: q.id,
    text: q.text,
    kind: "grid",
    cells: gridCounts(q, answered),
    not_applicable: gridNotApplicable(q, answered),
    respondents: answered.length,
    rows: q.rows,
    columns: q.columns,
  };
}

function topChoices(counts: Count[], n = 3): Count[] {
  return [...counts].filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, n);
}

/** Plain statements of what the counts show. No interpretation beyond the numbers. */
function findingsFor(result: QuestionResult, displayNumber: number): string[] {
  if (result.respondents === 0) return [`Q${displayNumber}: no answers yet.`];
  if (result.kind === "choice") {
    const top = topChoices(result.counts);
    if (top.length === 0) return [`Q${displayNumber}: no options chosen.`];
    return [`Q${displayNumber}, ${result.respondents} answered: ${top.map((c) => `${c.label} (${c.count}, ${pct(c.share)})`).join("; ")}.`];
  }
  const out: string[] = [];
  const base = result.respondents - result.not_applicable;
  for (const row of result.rows) {
    const cells = result.cells.filter((c) => c.row === row.key);
    const best = [...cells].sort((a, b) => b.count - a.count)[0];
    if (!best || best.count === 0) continue;
    const col = result.columns.find((c) => c.key === best.col)!;
    out.push(`${row.label}: most often “${col.label}” (${best.count} of ${base}).`);
  }
  if (result.not_applicable > 0) out.push(`${result.not_applicable} marked the whole question not applicable.`);
  return out.length ? [`Q${displayNumber}, ${result.respondents} answered.`, ...out] : [`Q${displayNumber}: no cells chosen.`];
}

/** Options chosen by at least a quarter of those who answered, or the top three, each with its suggestion. */
function implicationsFor(result: QuestionResult): Implication[] {
  if (result.kind === "choice") {
    const map = IMPLICATIONS[result.id] ?? {};
    const sorted = [...result.counts].filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
    return sorted
      .filter((c, i) => (c.share >= 0.25 || i < 3) && map[c.key])
      .map((c) => ({ question_id: result.id, option_key: c.key, suggestion: map[c.key], count: c.count, share: c.share }));
  }
  const base = result.respondents - result.not_applicable || 1;
  return result.rows.flatMap((row) => {
    const cells = result.cells.filter((c) => c.row === row.key);
    const best = [...cells].sort((a, b) => b.count - a.count)[0];
    if (!best || best.count === 0) return [];
    return [
      {
        question_id: result.id,
        option_key: `${row.key}:${best.col}`,
        suggestion: `${row.label}: treat as a ${GRID_IMPLICATIONS[best.col]}`,
        count: best.count,
        share: best.count / base,
      },
    ];
  });
}

export function buildInsights(rows: ResponseRow[]): DimensionResult[] {
  return DIMENSIONS.map((d) => {
    const results = d.questions.map((id) => {
      const q = byId(id);
      if (q.kind === "grid") return gridResult(q, rows);
      if (q.kind === "checkbox" || q.kind === "single") return choiceResult(q, rows);
      throw new Error(`Dimension ${d.id} lists a question without options: ${id}`);
    });
    const findings = results.flatMap((r) => findingsFor(r, ALL_QUESTIONS.findIndex((q) => q.id === r.id) + 1));
    const implications = results.flatMap(implicationsFor).sort((a, b) => b.share - a.share);
    return { id: d.id, title: d.title, question: d.question, results, findings, implications };
  });
}

export function requirementsExport(rows: ResponseRow[]) {
  const dims = buildInsights(rows);
  return {
    generated_at: new Date().toISOString(),
    questions_version: QUESTIONS_VERSION,
    responses: rows.length,
    note: "Survey results are counts from the responses. Database implications are suggested fields and features written by the research team and ranked by those counts; they are not validated conclusions.",
    dimensions: dims.map((d) => ({
      id: d.id,
      title: d.title,
      question: d.question,
      survey_results: d.results.map((r) =>
        r.kind === "choice"
          ? { question_id: r.id, text: r.text, respondents: r.respondents, counts: r.counts }
          : { question_id: r.id, text: r.text, respondents: r.respondents, not_applicable: r.not_applicable, cells: r.cells },
      ),
      findings: d.findings,
      database_implications: d.implications.map((i) => ({
        suggestion: i.suggestion,
        evidence: { question_id: i.question_id, option_key: i.option_key, count: i.count, share: i.share },
      })),
    })),
  };
}

export { answeredCount };

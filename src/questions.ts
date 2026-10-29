/**
 * All survey content lives here. Edit wording freely; the `key` fields are what
 * get stored and exported, so keep those stable once responses exist.
 *
 * Question ids (q1, q11, q16 …) are storage keys, not display numbers. The
 * number a respondent sees is the question's position in SECTIONS.
 *
 * Bump QUESTIONS_VERSION whenever you change wording or options in a way that
 * affects how answers should be read. Every response records the version it
 * was answered under.
 *
 * Version 2 (2026-10-29): questions reordered; q3 options replaced; q11's
 * "AI tools or web search" split into two options; q12 (stage order) and q13
 * (decide first) removed; q16 and q17 added; q4 and q7 gain a not-applicable
 * choice shown only to respondents with no experience.
 *
 * Version 3 (2026-10-29): q15 asks the respondent to pick which of their q14
 * plants the note is about; stored as { plant, text } instead of a string.
 *
 * Version 4 (2026-10-29): q2 option "both" replaced by "personal" (personal
 * planting or gardening experience); q14 and q15 became required (at least
 * three plants; a chosen plant with a note); q4 and q16 lost their
 * three-selection cap; q10 reworded.
 */

export const QUESTIONS_VERSION = 4;

/** Versions whose answers the developer mode knows how to read. */
export const KNOWN_VERSIONS = [1, 2, 3, 4] as const;

export const SURVEY_TITLE = "How you work with plants";

export const INTRO = {
  lead: "We’re exploring whether AI could support planting design. Before building anything, we want to understand how designers work with plants today.",
  note: "About 3 minutes, anonymous.",
};

export const CLOSING = {
  title: "Thank you.",
  body: "Your answers have been saved.",
};

/** Q2 answer that means the respondent has no planting design experience yet. */
export const NO_EXPERIENCE = { question: "q2", key: "none" };

export type Option = {
  key: string;
  label: string;
  /** Selecting this clears all others in the question, and vice versa. */
  exclusive?: boolean;
  /** Shows an inline text field when selected. */
  other?: boolean;
  /** Stays at the end in the given order when the question is shuffled. */
  fixed?: boolean;
  /** Shown only to respondents with no planting design experience (see NO_EXPERIENCE). */
  noExperienceOnly?: boolean;
};

export type CheckboxQuestion = {
  kind: "checkbox";
  id: string;
  text: string;
  help?: string;
  options: Option[];
  /** Maximum number of selections; omit for “choose all that apply”. */
  max?: number;
  shuffle?: boolean;
};

export type SingleQuestion = {
  kind: "single";
  id: string;
  text: string;
  help?: string;
  options: Option[];
  shuffle?: boolean;
};

export type GridQuestion = {
  kind: "grid";
  id: string;
  text: string;
  help?: string;
  columns: { key: string; label: string }[];
  rows: { key: string; label: string }[];
  /** Respondents with no experience may mark the whole grid as not applicable. */
  notApplicable?: string;
};

export type TextListQuestion = {
  kind: "textlist";
  id: string;
  text: string;
  help?: string;
  count: number;
  /** Fewest non-empty entries needed for the answer to count. */
  min: number;
  labelPrefix: string;
};

/** A note about one plant chosen from the respondent’s own list in another question. */
export type PlantNoteQuestion = {
  kind: "plantnote";
  id: string;
  text: string;
  help?: string;
  /** The textlist question whose non-empty entries become the choices. */
  sourceQuestion: string;
  pickLabel: string;
  maxLength: number;
};

export type Question = CheckboxQuestion | SingleQuestion | GridQuestion | TextListQuestion | PlantNoteQuestion;

export type Section = {
  id: string;
  title: string;
  /** Short line shown above the first question of the section. */
  help?: string;
  questions: Question[];
};

export const SECTIONS: Section[] = [
  {
    id: "about",
    title: "About you",
    questions: [
      {
        kind: "checkbox",
        id: "q1",
        text: "Which of the following describe you?",
        help: "Choose all that apply",
        options: [
          { key: "mla", label: "MLA student" },
          { key: "other_student", label: "Student in another discipline" },
          { key: "practitioner", label: "Practicing landscape designer / landscape architect" },
          { key: "academic", label: "Professor, instructor or researcher" },
          { key: "other", label: "Other", other: true, fixed: true },
        ],
      },
      {
        kind: "single",
        id: "q2",
        text: "What planting design experience do you have?",
        options: [
          { key: "none", label: "None yet" },
          { key: "academic", label: "Academic or studio projects only" },
          { key: "professional", label: "Professional projects only" },
          { key: "personal", label: "Personal planting or gardening experience" },
        ],
      },
    ],
  },
  {
    id: "attributes",
    title: "Plant knowledge and attributes",
    questions: [
      {
        kind: "checkbox",
        id: "q11",
        text: "Which sources do you rely on most for plant information?",
        help: "Choose up to 3",
        max: 3,
        shuffle: true,
        options: [
          { key: "databases", label: "Online plant databases (e.g. Missouri Botanical Garden, RHS, E-Flora BC)" },
          { key: "books", label: "Books and reference manuals" },
          { key: "catalogues", label: "Nursery catalogues" },
          { key: "municipal_lists", label: "Municipal or regional plant lists" },
          { key: "precedents", label: "Precedent projects and site visits" },
          { key: "people", label: "Colleagues, instructors or mentors" },
          { key: "own_notes", label: "My own notes and past projects" },
          { key: "web_search", label: "General web search" },
          { key: "ai_tools", label: "AI tools" },
        ],
      },
      {
        kind: "checkbox",
        id: "q3",
        text: "What do you most want to know about a plant?",
        help: "Choose up to 3",
        max: 3,
        shuffle: true,
        options: [
          { key: "site_suitability", label: "Site suitability: climate, light, water and soil" },
          { key: "growth_size", label: "Growth and size over time" },
          { key: "appearance", label: "Visual appearance and seasonal character" },
          { key: "maintenance_performance", label: "Maintenance, common problems and long-term performance" },
          { key: "ecology_native", label: "Ecological value and native status" },
          { key: "combinations", label: "Plant combinations and alternatives" },
          { key: "availability_specs", label: "Nursery availability, cost and planting specifications" },
          { key: "real_projects", label: "Real projects, local observations and examples of use" },
          { key: "other", label: "Other", other: true, fixed: true },
        ],
      },
      {
        kind: "checkbox",
        id: "q4",
        text: "Which measurements do you use when designing a planting?",
        help: "Choose all that apply",
        options: [
          { key: "height", label: "Mature height" },
          { key: "spread", label: "Mature spread" },
          { key: "spacing", label: "Spacing or planting density" },
          { key: "growth_rate", label: "Growth rate" },
          { key: "years_to_effect", label: "Years until it reaches the intended effect" },
          { key: "zone", label: "Hardiness zone" },
          { key: "purchase_size", label: "Size at purchase (pot size, caliper)" },
          { key: "rarely", label: "I rarely use measurements", exclusive: true, fixed: true },
          { key: "not_yet", label: "Not applicable, I haven’t designed a planting yet", exclusive: true, fixed: true, noExperienceOnly: true },
        ],
      },
      {
        kind: "checkbox",
        id: "q5",
        text: "When choosing plants for their appearance, which characteristics matter most?",
        help: "Choose up to 3",
        max: 3,
        shuffle: true,
        options: [
          { key: "texture", label: "Texture, fine or coarse" },
          { key: "form", label: "Form and habit" },
          { key: "foliage", label: "Foliage colour" },
          { key: "flower", label: "Flower colour and timing" },
          { key: "autumn_winter", label: "Autumn and winter interest" },
          { key: "character", label: "Overall character, such as wild, formal or lush" },
          { key: "mass", label: "How it reads in a mass or from a distance" },
        ],
      },
      {
        kind: "grid",
        id: "q7",
        text: "When selecting plants, how do you usually treat the following considerations?",
        columns: [
          { key: "rule", label: "Fixed requirement" },
          { key: "preference", label: "Preference" },
          { key: "depends", label: "Depends on the project" },
          { key: "not", label: "Not considered / Not sure" },
        ],
        rows: [
          { key: "hardiness", label: "Winter hardiness" },
          { key: "light", label: "Light requirements" },
          { key: "water", label: "Water requirements" },
          { key: "size", label: "Mature size" },
          { key: "native", label: "Native to the region" },
          { key: "availability", label: "Local nursery availability" },
        ],
        notApplicable: "Not applicable, I haven’t selected plants for a design yet",
      },
    ],
  },
  {
    id: "gaps",
    title: "Knowledge gaps and personal experience",
    questions: [
      {
        kind: "checkbox",
        id: "q8",
        text: "Which types of plant information have you found most difficult to obtain or verify?",
        help: "Choose up to 3",
        max: 3,
        shuffle: true,
        options: [
          { key: "local_growth", label: "Actual growth and mature size under local conditions" },
          { key: "long_term", label: "Long-term performance and maintenance experience" },
          { key: "photos", label: "Photographs across seasons and growth stages" },
          { key: "together", label: "How plants perform together" },
          { key: "availability_cost", label: "Reliable local availability and cost" },
          { key: "site_problems", label: "Site-specific problems, limitations or failures" },
          { key: "other", label: "Other", other: true, fixed: true },
          { key: "not_searched", label: "I haven’t searched for this information yet", exclusive: true, fixed: true },
        ],
      },
      {
        kind: "checkbox",
        id: "q9",
        text: "How do you currently keep or retrieve what you’ve learned about plants?",
        help: "Choose all that apply",
        options: [
          { key: "own_list", label: "My own plant list or spreadsheet" },
          { key: "project_files", label: "Past project or studio files, including plant schedules" },
          { key: "images", label: "Saved images or precedent boards" },
          { key: "notes", label: "Personal notes" },
          { key: "memory", label: "I remember it" },
          { key: "ask", label: "I ask a colleague or classmate" },
          { key: "lost", label: "I usually can’t find it again" },
          { key: "not_yet", label: "I haven’t had this situation yet", exclusive: true, fixed: true },
        ],
      },
      {
        kind: "checkbox",
        id: "q10",
        text: "If recording your own plant knowledge were easy, which types of information would you most want to save?",
        help: "Choose up to 3",
        max: 3,
        options: [
          { key: "performance", label: "How it performed in a specific project" },
          { key: "maintenance", label: "What maintenance it really needed" },
          { key: "combinations", label: "Combinations that worked" },
          { key: "where_to_buy", label: "Where to buy it and at what size" },
          { key: "warning", label: "A warning or caveat" },
          { key: "rating", label: "My own rating or tags" },
          { key: "photos", label: "Photos I took" },
          { key: "nothing", label: "Nothing, the standard information is enough", exclusive: true, fixed: true },
        ],
      },
      {
        kind: "checkbox",
        id: "q16",
        text: "If a database includes someone’s observation or experience with a plant, which contextual details would help you judge whether it applies to your project?",
        help: "Choose all that apply",
        shuffle: true,
        options: [
          { key: "location", label: "Location or region" },
          { key: "site_conditions", label: "Site conditions (light, soil, water, etc.)" },
          { key: "plant_age", label: "Plant age or years since planting" },
          { key: "date_season", label: "Date or season of observation" },
          { key: "maintenance", label: "Maintenance practices" },
          { key: "source", label: "Observer or information source" },
          { key: "other", label: "Other", other: true, fixed: true },
        ],
      },
    ],
  },
  {
    id: "using",
    title: "Using plant knowledge",
    questions: [
      {
        kind: "checkbox",
        id: "q6",
        text: "How do you usually describe the planting you have in mind?",
        help: "Choose up to 2",
        max: 2,
        shuffle: true,
        options: [
          { key: "mood", label: "Mood or atmosphere words" },
          { key: "colour", label: "A colour theme" },
          { key: "references", label: "Reference projects or images" },
          { key: "names", label: "Specific plant names" },
          { key: "ecological", label: "Ecological functions (habitat, stormwater, pollinators)" },
          { key: "spatial", label: "Spatial terms (screen, canopy, groundcover, edge)" },
          { key: "site", label: "Site conditions" },
        ],
      },
      {
        kind: "checkbox",
        id: "q17",
        text: "If you were using a plant knowledge database, which ways of finding information would be most useful for your design work?",
        help: "Choose up to 3",
        max: 3,
        shuffle: true,
        options: [
          { key: "by_name", label: "Search by plant name" },
          { key: "by_site", label: "Filter plants by site conditions" },
          { key: "by_visual", label: "Search by visual characteristics or design atmosphere" },
          { key: "by_ecology", label: "Search by ecological function" },
          { key: "compare", label: "Compare plant attributes and differences" },
          { key: "alternatives", label: "Find similar or alternative plants" },
          { key: "projects", label: "Explore real projects where plants have been used" },
          { key: "own_records", label: "Search my own past plant records and observations" },
          { key: "other", label: "Other", other: true, fixed: true },
        ],
      },
    ],
  },
  {
    id: "vancouver",
    title: "Plants in Metro Vancouver",
    questions: [
      {
        kind: "textlist",
        id: "q14",
        text: "Which 3–5 plants do you personally prefer to use or consider for planting design in Metro Vancouver?",
        help: "Common or scientific names are fine. You do not need to consider a specific site",
        count: 5,
        min: 3,
        labelPrefix: "Plant",
      },
      {
        kind: "plantnote",
        id: "q15",
        text: "Pick one plant from your list. Why do you prefer it, and under what site conditions would you use it?",
        help: "You may also mention other plants you would combine it with",
        sourceQuestion: "q14",
        pickLabel: "Which plant is this about?",
        maxLength: 300,
      },
    ],
  },
];

export const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

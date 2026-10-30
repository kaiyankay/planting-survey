/**
 * All survey content lives here. Edit wording freely.
 *
 * Question ids (a1, b1, f2 …) are storage keys only: they are what the
 * database and the exports use, and they never appear on the page. The number
 * a respondent sees is the question’s position among the questions shown to
 * them, generated in App.tsx. Option keys are stored too, so keep them stable
 * once responses exist.
 *
 * The full specification, with the reasoning behind every question, is in
 * docs/survey-spec.md.
 */

export const QUESTIONS_VERSION = 1;

/** Versions whose answers the developer mode knows how to read. */
export const KNOWN_VERSIONS = [1] as const;

export const SURVEY_TITLE = "How you work with plants";

export const INTRO = {
  lead: "We’re building a plant knowledge database for Metro Vancouver and want to understand how people actually choose plants today.",
  note: "About 7 minutes, anonymous. Studio projects and your own garden both count as experience.",
};

export const CLOSING = {
  title: "Thank you.",
  body: "Your answers have been saved.",
};

/** The experience question and the option that means none: it decides which questions are shown. */
export const EXPERIENCE = { question: "a2", none: "none" };

export type Option = {
  key: string;
  label: string;
  /** Selecting this clears all others in the question, and vice versa. */
  exclusive?: boolean;
  /** Shows an inline text field when selected. */
  other?: boolean;
  /** Stays at the end in the given order when the question is shuffled. */
  fixed?: boolean;
};

type Base = {
  id: string;
  text: string;
  help?: string;
  /** Hidden, and not asked, when the respondent has no planting experience. */
  requiresExperience?: boolean;
};

export type CheckboxQuestion = Base & {
  kind: "checkbox";
  options: Option[];
  /** Maximum number of selections; omit for “choose all that apply”. */
  max?: number;
  shuffle?: boolean;
};

export type SingleQuestion = Base & {
  kind: "single";
  options: Option[];
  shuffle?: boolean;
};

/** A matrix with three fixed columns; every row must be answered. */
export type Grid3Question = Base & {
  kind: "grid3";
  columns: { key: "must_pass" | "compared" | "rarely"; label: string; note: string }[];
  rows: { key: string; label: string }[];
};

export type ShortTextQuestion = Base & {
  kind: "shorttext";
  required: boolean;
  maxLength: number;
  /** Visual height, one or two lines. */
  lines?: 1 | 2;
};

export type LongTextQuestion = Base & {
  kind: "longtext";
  required: boolean;
  maxLength: number;
  /** Shown in grey above the box, folded by default. */
  example: string;
};

export type PlantListQuestion = Base & {
  kind: "plantlist";
  count: number;
  /** Fewest different plant names needed, each with a role. */
  min: number;
  roles: { key: string; label: string }[];
  /** Exclusive way out for respondents who have not chosen plants here yet. */
  notApplicable: string;
};

export type PlantNoteQuestion = Base & {
  kind: "plantnote";
  /** The plantlist question whose entries become the choices. */
  sourceQuestion: string;
  pickLabel: string;
  maxLength: number;
  /** The only choice offered when the source list is not applicable. */
  notApplicable: string;
};

export type Question = CheckboxQuestion | SingleQuestion | Grid3Question | ShortTextQuestion | LongTextQuestion | PlantListQuestion | PlantNoteQuestion;

export type Section = {
  id: string;
  title: string;
  /** The whole section is hidden when the respondent has no planting experience. */
  requiresExperience?: boolean;
  questions: Question[];
};

export const SECTIONS: Section[] = [
  {
    id: "about",
    title: "About you",
    questions: [
      {
        kind: "checkbox",
        id: "a1",
        text: "Which describe you?",
        help: "Choose all that apply",
        options: [
          { key: "mla", label: "MLA student" },
          { key: "related_student", label: "Student in a related field (architecture, planning, horticulture, forestry…)" },
          { key: "designer", label: "Landscape designer or landscape architect" },
          { key: "instructor", label: "Instructor or researcher" },
          { key: "other", label: "Other", other: true, fixed: true },
        ],
      },
      {
        kind: "checkbox",
        id: "a2",
        text: "Your planting experience",
        help: "Choose all that apply",
        options: [
          { key: "studio", label: "Studio or academic projects" },
          { key: "professional", label: "Professional projects" },
          { key: "gardening", label: "Personal gardening" },
          { key: "none", label: "None yet", exclusive: true, fixed: true },
        ],
      },
    ],
  },
  {
    id: "needs",
    title: "What you need to know",
    questions: [
      {
        kind: "grid3",
        id: "b1",
        text: "When you shortlist a plant, how does each attribute enter your decision?",
        requiresExperience: true,
        columns: [
          { key: "must_pass", label: "Must pass", note: "I exclude plants that fail" },
          { key: "compared", label: "Compared later", note: "Matters when choosing between candidates" },
          { key: "rarely", label: "Rarely look at it", note: "" },
        ],
        rows: [
          { key: "hardiness", label: "Hardiness" },
          { key: "light", label: "Light" },
          { key: "water", label: "Water and drainage" },
          { key: "height", label: "Mature height" },
          { key: "spread", label: "Mature spread" },
          { key: "time_to_size", label: "Time to reach the intended size" },
          { key: "seasonal", label: "Seasonal appearance" },
          { key: "maintenance", label: "Maintenance needs" },
          { key: "ecological", label: "Native or ecological value" },
          { key: "invasive", label: "Invasive or problematic status" },
        ],
      },
      {
        kind: "checkbox",
        id: "b2",
        text: "Which have you tried to find and couldn’t, or didn’t trust?",
        help: "Choose all that apply",
        shuffle: true,
        options: [
          { key: "mature_size", label: "Real mature size under local conditions" },
          { key: "long_term", label: "Long-term performance and maintenance" },
          { key: "ages_seasons", label: "How it looks at different ages and seasons" },
          { key: "with_others", label: "How it behaves alongside other plants" },
          { key: "availability_cost", label: "Local availability and cost" },
          { key: "conflicting", label: "Conflicting information between sources" },
          { key: "not_looked", label: "I haven’t looked for plant information yet", exclusive: true, fixed: true },
        ],
      },
      {
        kind: "shorttext",
        id: "b3",
        text: "Briefly, one specific thing about a plant you wanted to know and couldn’t find.",
        help: "Optional",
        required: false,
        maxLength: 300,
        lines: 2,
      },
    ],
  },
  {
    id: "workflow",
    title: "How you work now",
    requiresExperience: true,
    questions: [
      {
        kind: "single",
        id: "c1",
        text: "In a typical project, when do you actually settle on plant species?",
        options: [
          { key: "concept", label: "During concept design" },
          { key: "development", label: "During design development" },
          { key: "planting_plan", label: "When preparing the planting plan" },
          { key: "no_clear_moment", label: "It keeps changing, no clear moment" },
        ],
      },
      {
        kind: "checkbox",
        id: "c2",
        text: "Where do you look when choosing plants?",
        help: "Choose up to 3",
        max: 3,
        shuffle: true,
        options: [
          { key: "databases", label: "Online plant databases" },
          { key: "books", label: "Books and manuals" },
          { key: "municipal_lists", label: "Municipal or regional plant lists" },
          { key: "software_libraries", label: "Software plant libraries (Landmark, Land F/X…)" },
          { key: "colleagues", label: "Colleagues or instructors" },
          { key: "own_projects", label: "My own past projects" },
          { key: "web_search", label: "General web search" },
          { key: "ai_chat", label: "AI chat tools" },
        ],
      },
      {
        kind: "longtext",
        id: "c3",
        text: "Think of the last time you chose plants for a design or your own garden. Tell us how it went, in a few sentences.",
        help: "Mention where you started, what you checked, anything you dropped and why, and where the final list ended up",
        required: true,
        maxLength: 1500,
        example:
          "I started from a planting plan the studio gave us as precedent, then checked each plant on Missouri Botanical Garden for size and hardiness. I dropped two because they’d get too tall for the overhead wires. The final list went into a Rhino layer and an Excel schedule, which I still have but haven’t opened since.",
      },
    ],
  },
  {
    id: "asking",
    title: "How you’d ask",
    questions: [
      {
        kind: "shorttext",
        id: "d1",
        text: "Before you know which plants you’ll use, write 3–5 words or phrases you’d use to describe the planting you want.",
        help: "Optional",
        required: false,
        maxLength: 200,
        lines: 2,
      },
      {
        kind: "shorttext",
        id: "d2",
        text: "If a plant database understood plain language, write one search you would actually type.",
        required: true,
        maxLength: 200,
        lines: 2,
      },
    ],
  },
  {
    id: "trust",
    title: "Trusting knowledge from others",
    questions: [
      {
        kind: "checkbox",
        id: "e1",
        text: "When reading someone else’s note about a plant, which details do you need before trusting it for your own project?",
        help: "Choose all that apply",
        shuffle: true,
        options: [
          { key: "location", label: "Location" },
          { key: "site_conditions", label: "Site conditions" },
          { key: "plant_age", label: "Plant age or years since planting" },
          { key: "season", label: "Season observed" },
          { key: "maintenance", label: "Maintenance it received" },
          { key: "author", label: "Who wrote it and their experience" },
        ],
      },
      {
        kind: "checkbox",
        id: "e2",
        text: "If an AI tool suggested a plant, what would make you take it seriously?",
        help: "Choose 2",
        max: 2,
        shuffle: true,
        options: [
          { key: "sources", label: "It shows its sources" },
          { key: "local_project", label: "It shows a local project using the plant" },
          { key: "first_hand", label: "It shows someone’s first-hand experience" },
          { key: "reasoning", label: "It explains its reasoning" },
          { key: "nothing", label: "Nothing, I’d verify it myself anyway", exclusive: true, fixed: true },
        ],
      },
    ],
  },
  {
    id: "plants",
    title: "Your plants",
    requiresExperience: true,
    questions: [
      {
        kind: "plantlist",
        id: "f1",
        text: "Name 3–5 plants you’d consider for Metro Vancouver.",
        help: "Common or scientific names are fine",
        count: 5,
        min: 3,
        roles: [
          { key: "tree", label: "Tree" },
          { key: "shrub", label: "Shrub" },
          { key: "perennial_grass", label: "Perennial or grass" },
          { key: "groundcover", label: "Groundcover" },
          { key: "not_sure", label: "Not sure" },
        ],
        notApplicable: "I haven’t selected plants for a design in this region yet",
      },
      {
        kind: "plantnote",
        id: "f2",
        text: "Pick one plant from your list and write the note you’d leave for a colleague: where you used or saw it, how it performed, and anything you’d warn them about.",
        sourceQuestion: "f1",
        pickLabel: "Which plant is this about?",
        maxLength: 300,
        notApplicable: "Not applicable, I haven’t selected plants for a design in this region yet",
      },
    ],
  },
];

export const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

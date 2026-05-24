export type AgentName =
  // Journalism mode
  | "legal_skeptic"
  | "data_expert"
  | "human_rights"
  | "clarity"
  | "partisan"
  | "question_master"
  // Essays mode
  | "thesis_editor"
  | "evidence_quotation"
  | "prose_style"
  | "structure_editor"
  | "logic_auditor"
  | "counterargument"
  | "citation_editor";

export type Severity = "high" | "medium" | "low";

export type Mode = "journalism" | "essays";
export type CitationStyle = "mla" | "apa" | "chicago" | "turabian" | "none";

export interface Critique {
  agent: AgentName;
  text_quote: string;
  span: [number, number];
  issue_label: string;
  question: string;
  why_it_matters: string;
  fix_suggestion?: string | null;
  replacement?: string | null;   // literal drop-in text for one-click Accept
  severity: Severity;
  _id?: string;                  // client-assigned stable id (survives span shifts)
}

export interface AgentMeta {
  label: string;             // "Anne — Legal Skeptic"
  shortLabel: string;        // "Legal Skeptic"
  firstName: string;         // "Anne"
  brandHex: string;          // strong color — borders, underlines
  highlightHex: string;      // soft tint — editor highlight fill
  borderClass: string;       // sidebar card left-border (Tailwind class)
  available: boolean;
  kind: "flagger" | "questioner";  // questioner = Sol: asks, never corrects
  tagline: string;
  lookFor: string[];
  mode: Mode;                // which mode this editor belongs to
}


export const AGENTS: Record<AgentName, AgentMeta> = {
  legal_skeptic: {
    label: "Anne — Legal Skeptic",
    shortLabel: "Legal Skeptic",
    firstName: "Anne",
    brandHex: "#EC4899",
    highlightHex: "#FBCFE8",
    borderClass: "border-agent-legal",
    available: true,
    kind: "flagger",
    mode: "journalism",
    tagline:
      "Reviews your draft for legal risk. Catches defamation traps, weak sourcing on serious claims, and missing right of reply.",
    lookFor: [
      "Criminal verbs without an indictment, audit, or named second source",
      "Specific allegations resting on a single anonymous source",
      "Missing or perfunctory right of reply",
      "Characterizations stated as fact (\"cover-up\", \"scheme\")",
    ],
  },
  data_expert: {
    label: "Peter — Data Expert",
    shortLabel: "Data Expert",
    firstName: "Peter",
    brandHex: "#0F172A",
    highlightHex: "#CBD5E1",
    borderClass: "border-agent-data",
    available: true,
    kind: "flagger",
    mode: "journalism",
    tagline:
      "Checks the numbers and the facts in your story. Catches misleading statistics, false causation, wrong titles, mis-quotation, and order-of-magnitude errors.",
    lookFor: [
      "Causation claimed where only correlation is shown",
      "Poll leads or deltas inside the margin of error",
      "Wrong office or title in the lede or attribution",
      "Mis-quotation, order-of-magnitude errors, internal date inconsistencies",
    ],
  },
  human_rights: {
    label: "Joe — Human Rights Advocate",
    shortLabel: "Human Rights",
    firstName: "Joe",
    brandHex: "#6366F1",
    highlightHex: "#C7D2FE",
    borderClass: "border-agent-rights",
    available: true,
    kind: "flagger",
    mode: "journalism",
    tagline:
      "Protects your sources. Flags privacy risks, exposure of vulnerable people, and trauma framing that can come back to haunt the people in your story.",
    lookFor: [
      "Identifying-detail combinations that build a public dossier",
      "Trauma used as a hook with no consent infrastructure",
      "Loss of agency over headlines, pull quotes, social cards",
      "Predictable locations of vulnerable sources",
    ],
  },
  clarity: {
    label: "Clara — Clarity Critique",
    shortLabel: "Clarity",
    firstName: "Clara",
    brandHex: "#10B981",
    highlightHex: "#A7F3D0",
    borderClass: "border-agent-clarity",
    available: true,
    kind: "flagger",
    mode: "journalism",
    tagline:
      "Keeps your writing readable. Catches jargon, passive voice, buried ledes, and sentences your reader will not finish.",
    lookFor: [
      "Passive-voice accountability dodges",
      "Acronym pileup that loses the cast of characters",
      "Unexplained units without a comparison",
      "Ambiguous pronouns and missing context",
    ],
  },
  partisan: {
    label: "Parker — Partisan Checker",
    shortLabel: "Partisan",
    firstName: "Parker",
    brandHex: "#EF4444",
    highlightHex: "#FECACA",
    borderClass: "border-agent-partisan",
    available: true,
    kind: "flagger",
    mode: "journalism",
    tagline:
      "Hardens your story against bad-faith attacks. Spots loaded adjectives, buried rebuttals, and smear-by-association before critics do.",
    lookFor: [
      "Subject's rebuttal buried below paragraph five",
      "Smear by proximity without a functional link",
      "Loaded adjectives in the reporter's voice",
      "Asymmetric treatment of two named parties",
    ],
  },
  question_master: {
    label: "Sol — Question Master",
    shortLabel: "Question Master",
    firstName: "Sol",
    brandHex: "#F59E0B",
    highlightHex: "#FDE68A",
    borderClass: "border-agent-question",
    available: true,
    kind: "questioner",
    mode: "journalism",
    tagline:
      "Asks the deep questions you missed. Does not correct anything; pushes you toward bigger angles, stronger framings, and the story under the story.",
    lookFor: [
      "The unexamined premise the whole story stands on",
      "The follow-up the reporter never asked the source",
      "The bigger frame: what is this really a story about?",
      "Why this story, why now, and who decided it was news",
    ],
  },

  // Essays mode roster
  thesis_editor: {
    label: "Theo — Thesis Editor",
    shortLabel: "Thesis",
    firstName: "Theo",
    brandHex: "#7C3AED",
    highlightHex: "#DDD6FE",
    borderClass: "border-violet-500",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Stress-tests your argument. Catches topic-not-thesis openings, claims too broad to defend, and a body that argues something other than what the intro promised.",
    lookFor: [
      "Topic statement standing in for a defensible thesis",
      "Thesis no reasonable reader would dispute",
      "Body paragraphs that argue a different claim than the intro states",
      "Missing stakes: defensible, but no \"so what\"",
    ],
  },
  evidence_quotation: {
    label: "Evan — Evidence & Quotation",
    shortLabel: "Evidence",
    firstName: "Evan",
    brandHex: "#0EA5E9",
    highlightHex: "#BAE6FD",
    borderClass: "border-sky-500",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Audits the evidence under your claims. Flags dropped quotations, evidence that does not match the claim, and the counter-passage you ignored.",
    lookFor: [
      "Dropped quotation: no signal phrase, no analysis after it",
      "Evidence supports an adjacent claim, not the stated one",
      "Cherry-picked passage with the obvious counter-passage ignored",
      "Paraphrase that distorts the source",
    ],
  },
  prose_style: {
    label: "Will — Prose & Style",
    shortLabel: "Prose & Style",
    firstName: "Will",
    brandHex: "#14B8A6",
    highlightHex: "#99F6E4",
    borderClass: "border-teal-500",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Tightens the sentence. Catches nominalizations, buried subjects, hedge stacks, and throat-clearing openers.",
    lookFor: [
      "Verbs hidden inside nouns (\"made a decision to\" for \"decided\")",
      "Hedge stacks that erase the writer's own position",
      "Throat-clearing openers (\"In today's society\")",
      "Passive voice that hides who acts",
    ],
  },
  structure_editor: {
    label: "Stella — Structure",
    shortLabel: "Structure",
    firstName: "Stella",
    brandHex: "#D97706",
    highlightHex: "#FED7AA",
    borderClass: "border-amber-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Reads the architecture. Spots Frankenstein paragraphs, out-of-order moves, mismatched intro and conclusion, and the buried lede.",
    lookFor: [
      "Paragraph carrying three different sub-arguments",
      "Topic sentence missing; reader has to infer the claim",
      "Later paragraph depends on a fact introduced too late",
      "Strongest move buried mid-essay and never returned to",
    ],
  },
  logic_auditor: {
    label: "Logan — Logic Auditor",
    shortLabel: "Logic",
    firstName: "Logan",
    brandHex: "#0891B2",
    highlightHex: "#A5F3FC",
    borderClass: "border-cyan-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Audits the reasoning. Catches sequence-mistaken-for-cause, key terms that shift meaning, and conclusions that do not follow.",
    lookFor: [
      "Sequence read as causation (post hoc)",
      "Key term shifts meaning across the essay",
      "Generalization at a scope the evidence does not support",
      "Conclusion that does not follow from the cited passage",
    ],
  },
  counterargument: {
    label: "Cass — Counter-argument",
    shortLabel: "Counter",
    firstName: "Cass",
    brandHex: "#C026D3",
    highlightHex: "#F5D0FE",
    borderClass: "border-fuchsia-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Brings in the strongest version of the other side. Flags missing naysayers, straw counters, and hand-wave rebuttals.",
    lookFor: [
      "No counter-argument anywhere in a contested thesis",
      "Straw counter the strongest critic would not hold",
      "\"Some argue X\" with no actual engagement",
      "Concession that, taken seriously, would undermine the thesis",
    ],
  },
  citation_editor: {
    label: "Kate — Citation Editor",
    shortLabel: "Citations",
    firstName: "Kate",
    brandHex: "#57534E",
    highlightHex: "#D6D3D1",
    borderClass: "border-stone-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Enforces your citation style. Catches missing citations on direct quotes, mixed styles, and works-cited entries that do not match the rules.",
    lookFor: [
      "Direct quotation with no citation of any kind",
      "Mixed citation styles inside one essay",
      "Wrong format for the declared style (MLA / APA / Chicago / Turabian)",
      "Body citation with no matching back-matter entry",
    ],
  },
};

export const MODE_AGENTS: Record<Mode, AgentName[]> = {
  journalism: [
    "legal_skeptic",
    "data_expert",
    "human_rights",
    "clarity",
    "partisan",
    "question_master",
  ],
  essays: [
    "thesis_editor",
    "evidence_quotation",
    "prose_style",
    "structure_editor",
    "logic_auditor",
    "counterargument",
    "citation_editor",
  ],
};

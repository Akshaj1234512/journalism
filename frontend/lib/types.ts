export type AgentName =
  // Journalism mode
  | "legal_skeptic"
  | "data_expert"
  | "human_rights"
  | "clarity"
  | "partisan"
  | "question_master"
  // Essays core (always runs)
  | "thesis_editor"
  | "evidence_quotation"
  | "prose_style"
  | "structure_editor"
  | "logic_auditor"
  | "citation_editor"
  // Purpose editors — exactly one runs per essay, picked by essay_type
  | "argumentative_editor"
  | "analytical_editor"
  | "narrative_editor"
  | "research_editor"
  | "rhetorical_editor";

export type Severity = "high" | "medium" | "low";

export type Mode = "journalism" | "essays";
export type CitationStyle = "mla" | "apa" | "chicago" | "turabian" | "none";
export type EssayType =
  | "argumentative"
  | "analytical"
  | "narrative"
  | "research"
  | "rhetorical"
  | "none";

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
    label: "Sol — Creative Editor",
    shortLabel: "Creative",
    firstName: "Sol",
    brandHex: "#F59E0B",
    highlightHex: "#FDE68A",
    borderClass: "border-agent-question",
    available: true,
    kind: "flagger",
    mode: "journalism",
    tagline:
      "Spots the small creative moves the draft is one beat away from making. Flags metaphors set up and abandoned, conventional examples where unexpected ones would land harder, safe words where the sentence is reaching for sharpness, and patterns the writing opens but doesn't close.",
    lookFor: [
      "Metaphor set up and not extended",
      "Conventional example where an unexpected one would land harder",
      "Safe word in a sentence reaching for sharpness",
      "Pattern opened but not closed; voice flat at the stake moment",
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
    label: "Logan — Logic & Counter-argument",
    shortLabel: "Logic",
    firstName: "Logan",
    brandHex: "#0891B2",
    highlightHex: "#A5F3FC",
    borderClass: "border-cyan-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Audits the reasoning and the engagement with opposing views. Catches sequence-as-cause, shifted key terms, missing counter-arguments, hand-wave rebuttals, and concessions that should have changed the claim.",
    lookFor: [
      "Sequence read as causation, or correlation asserted as mechanism",
      "Key term that shifts meaning across the essay",
      "No counter-argument anywhere in a contested thesis",
      "Hand-wave rebuttal or concession that doesn't modify the claim",
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

  // Purpose editors — exactly one runs per essay, picked by essay_type.
  argumentative_editor: {
    label: "Ari — Argumentative Editor",
    shortLabel: "Argument",
    firstName: "Ari",
    brandHex: "#EA580C",
    highlightHex: "#FED7AA",
    borderClass: "border-orange-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Reads your essay as an argument. Catches claims that list rather than compound, hidden warrants, wrong audience, and conclusions that overreach or underreach what the body actually built.",
    lookFor: [
      "Points listed in parallel that never compound into a case",
      "Hidden warrant: the assumption linking evidence to claim",
      "Concession that does not modify the claim",
      "Conclusion that overreaches or underreaches the body",
    ],
  },
  analytical_editor: {
    label: "Anya — Analytical Editor",
    shortLabel: "Analysis",
    firstName: "Anya",
    brandHex: "#9333EA",
    highlightHex: "#E9D5FF",
    borderClass: "border-purple-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Reads your essay as analysis. Catches summary masquerading as analysis, missing close-reading, sweeping claims without pattern, and interpretations the text could not actually push back on.",
    lookFor: [
      "Summary or paraphrase where analysis was required",
      "Generalization without close attention to the text",
      "One moment over-extracted with no supporting pattern",
      "Reading so safe it carries no interpretive risk",
    ],
  },
  narrative_editor: {
    label: "Nora — Personal-Essay Editor",
    shortLabel: "Narrative",
    firstName: "Nora",
    brandHex: "#DB2777",
    highlightHex: "#FBCFE8",
    borderClass: "border-pink-600",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Reads your essay as personal narrative. Catches summary instead of scene, lessons stated rather than earned, false vulnerability, and the generic voice that buries what only you could write.",
    lookFor: [
      "Telling the reader what to feel instead of showing the moment",
      "Lesson handed to the reader rather than earned by the writing",
      "Voice flattened into the generic college-essay register",
      "The 'everyone essay': could be written by any applicant",
    ],
  },
  research_editor: {
    label: "Reese — Research Editor",
    shortLabel: "Research",
    firstName: "Reese",
    brandHex: "#0F766E",
    highlightHex: "#CCFBF1",
    borderClass: "border-teal-700",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Reads your essay as a research contribution. Catches source-by-source summary, sources that do not talk to each other, citation thickets, and an essay that reports the field without entering it.",
    lookFor: [
      "Sources summarized one after another with no synthesis",
      "Writer's voice missing; the paragraph is ventriloquism",
      "Wrong source type for the weight of the claim",
      "Reports that scholars disagree without entering the disagreement",
    ],
  },
  rhetorical_editor: {
    label: "Rhea — Rhetorical-Analysis Editor",
    shortLabel: "Rhetoric",
    firstName: "Rhea",
    brandHex: "#B91C1C",
    highlightHex: "#FECACA",
    borderClass: "border-red-700",
    available: true,
    kind: "flagger",
    mode: "essays",
    tagline:
      "Reads your essay as rhetorical analysis. Catches device-spotting without effect, missing audience or moment (kairos), and 'ethos / pathos / logos' used as labels instead of analyzed work.",
    lookFor: [
      "Devices named without analysis of what they do",
      "Audience or moment (kairos) missing from the reading",
      "Greek-term inflation: ethos / pathos / logos as labels, not analysis",
      "Conclusion that restates instead of landing a claim",
    ],
  },
};

// Base roster per mode. For essays, the matching purpose editor (and Sol)
// are appended at runtime by getEssaysRoster() based on the writer's chosen
// essay_type. Sol is always part of the essays rail; the purpose editor only
// appears when a type is picked.
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
    "citation_editor",
  ],
};

export const PURPOSE_EDITOR_BY_TYPE: Record<
  Exclude<EssayType, "none">,
  AgentName
> = {
  argumentative: "argumentative_editor",
  analytical: "analytical_editor",
  narrative: "narrative_editor",
  research: "research_editor",
  rhetorical: "rhetorical_editor",
};

export function getEssaysRoster(essayType: EssayType): AgentName[] {
  const roster: AgentName[] = [...MODE_AGENTS.essays, "question_master"];
  if (essayType !== "none") {
    roster.push(PURPOSE_EDITOR_BY_TYPE[essayType]);
  }
  return roster;
}

export interface EssayTypeChoice {
  value: EssayType;
  label: string;       // short pill label
  examples: string;    // examples shown in the dropdown
}

export const ESSAY_TYPE_CHOICES: EssayTypeChoice[] = [
  {
    value: "none",
    label: "Not sure / skip",
    examples: "no purpose editor will run",
  },
  {
    value: "argumentative",
    label: "Argumentative",
    examples: "op-ed, policy paper, persuasive essay, debate brief",
  },
  {
    value: "analytical",
    label: "Analytical",
    examples: "literary analysis, history paper, film essay, art critique",
  },
  {
    value: "narrative",
    label: "Personal",
    examples: "college admissions essay, memoir, reflective writing",
  },
  {
    value: "research",
    label: "Research",
    examples: "research paper, AP synthesis essay, source-based paper",
  },
  {
    value: "rhetorical",
    label: "Rhetorical",
    examples: "speech / ad / text breakdown, AP English Lang prompt",
  },
];

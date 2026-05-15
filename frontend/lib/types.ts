export type AgentName =
  | "legal_skeptic"
  | "data_expert"
  | "human_rights"
  | "clarity"
  | "partisan"
  | "question_master";

export type Severity = "high" | "medium" | "low";

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
}

/* ─── Review modes ─────────────────────────────────────────────────────────
   The Red Room's differentiator vs a generic AI editor is that *different
   stories deserve different reviews*. Each mode is just a preset of which
   agents run for this article. Modes are saved in localStorage so the user
   can keep the one that fits their beat.
─────────────────────────────────────────────────────────────────────────── */

export type ReviewMode = "brief" | "standard" | "deep" | "custom";

export interface ReviewModeMeta {
  id: ReviewMode;
  label: string;
  description: string;
  agents: AgentName[];   // empty array signals "user-controlled"
  estSeconds: string;    // rough wall-clock expectation
}

export const REVIEW_MODES: ReviewModeMeta[] = [
  {
    id: "brief",
    label: "Brief",
    description: "Anne and Parker only. The fastest read, for breaking news and short turnarounds.",
    agents: ["legal_skeptic", "partisan"],
    estSeconds: "~30s",
  },
  {
    id: "standard",
    label: "Standard",
    description: "All five flagging editors. The default newsroom review.",
    agents: ["legal_skeptic", "data_expert", "human_rights", "clarity", "partisan"],
    estSeconds: "~60s",
  },
  {
    id: "deep",
    label: "Deep",
    description: "The full room, including Sol's generative questions. For investigative drafts and long-form.",
    agents: ["legal_skeptic", "data_expert", "human_rights", "clarity", "partisan", "question_master"],
    estSeconds: "~90s",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Whatever you have toggled on in the rail.",
    agents: [],
    estSeconds: "varies",
  },
];

export const ALL_AGENT_NAMES: AgentName[] = [
  "legal_skeptic",
  "data_expert",
  "human_rights",
  "clarity",
  "partisan",
  "question_master",
];

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
    tagline:
      "Media-libel attorney. Reads every draft assuming the subject will sue.",
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
    tagline:
      "Data journalist who deflates editorialized numbers and overstated causation.",
    lookFor: [
      "Causation claimed where only correlation is shown",
      "Poll leads or deltas inside the margin of error",
      "Magnitude adjectives without a denominator",
      "Mean reported where median is the convention",
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
    tagline:
      "Came up in human rights reporting. Asks what happens to the source six months after publication.",
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
    tagline:
      "Reads drafts as a smart but distracted reader and flags every sentence that loses them.",
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
    tagline:
      "Reads every draft as the subject's media consultant. Removes unforced errors hostile critics will weaponize.",
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
    tagline:
      "Does not correct anything. Asks the deep question the reporter never thought to ask.",
    lookFor: [
      "The unexamined premise the whole story stands on",
      "The follow-up the reporter never asked the source",
      "The bigger frame: what is this really a story about?",
      "Why this story, why now, and who decided it was news",
    ],
  },
};

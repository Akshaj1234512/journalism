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
    tagline:
      "Checks the numbers in your story. Catches misleading statistics, false causation, and figures presented without context.",
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
    tagline:
      "Asks the deep questions you missed. Does not correct anything; pushes you toward bigger angles, stronger framings, and the story under the story.",
    lookFor: [
      "The unexamined premise the whole story stands on",
      "The follow-up the reporter never asked the source",
      "The bigger frame: what is this really a story about?",
      "Why this story, why now, and who decided it was news",
    ],
  },
};

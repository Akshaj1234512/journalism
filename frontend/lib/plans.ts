import { AgentName } from "./types";

export type Plan = "free" | "basic" | "pro" | "team";

// Editors included on the free tier — the shared craft layer that runs in
// both modes (Theo, Will, Stella, Logan, Evan, Sol) plus Kate. Locked behind
// paid tiers: the four journalism specialists (Anne, Peter, Joe, Parker) and
// the five purpose editors (Ari, Anya, Nora, Reese, Rhea).
//
// Free users feel the full multi-editor experience on any draft; the
// upgrade pulls them toward the genre specialists their work actually needs.
export const FREE_AGENTS: AgentName[] = [
  "thesis_editor",
  "prose_style",
  "structure_editor",
  "logic_auditor",
  "evidence_quotation",
  "question_master",
  "citation_editor",
];

// New accounts get a 14-day trial of the Basic tier. Long enough to use the
// specialist editors on a few real drafts; short enough to maintain urgency.
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: Plan = "basic";

export interface PlanInfo {
  id: Plan;
  label: string;
  priceMonthly: number;
  reviewsPerWeek: number;          // 3, 10, 20, 50
  reviewsPerMonth: number;         // pre-computed: reviewsPerWeek * 4 (clean 4-week month)
  overagePerReview: number;        // $ per extra review after included; 0 = hard cap
  maxArticleWords: number;         // hard cap on draft length per review
  seats: number;                   // base seats included
  extraSeatPriceMonthly: number;   // $ per additional seat (Team only)
  unlocksAllEditors: boolean;
  unlocksPurposeEditor: boolean;
  unlocksJournalismSpecialists: boolean;
  unlocksCitationStyle: boolean;
  unlocksAssignmentPrompt: boolean;
  unlocksDraftHistory: boolean;
  unlocksPriorityQueue: boolean;
  unlocksBrandedPdf: boolean;
  popular: boolean;
}

export const PLANS: Record<Plan, PlanInfo> = {
  free: {
    id: "free",
    label: "Free",
    priceMonthly: 0,
    reviewsPerWeek: 3,
    reviewsPerMonth: 12,
    overagePerReview: 0,                   // hard cap
    maxArticleWords: 1500,                 // typical short essay / news brief / Common App essay
    seats: 1,
    extraSeatPriceMonthly: 0,
    unlocksAllEditors: false,
    unlocksPurposeEditor: false,
    unlocksJournalismSpecialists: false,
    unlocksCitationStyle: false,
    unlocksAssignmentPrompt: false,
    unlocksDraftHistory: false,
    unlocksPriorityQueue: false,
    unlocksBrandedPdf: false,
    popular: false,
  },
  basic: {
    id: "basic",
    label: "Basic",
    priceMonthly: 15,
    reviewsPerWeek: 10,
    reviewsPerMonth: 40,
    overagePerReview: 0.69,
    maxArticleWords: 2000,                 // covers most college essays + journalism
    seats: 1,
    extraSeatPriceMonthly: 0,
    unlocksAllEditors: true,
    unlocksPurposeEditor: true,
    unlocksJournalismSpecialists: true,
    unlocksCitationStyle: true,
    unlocksAssignmentPrompt: true,
    unlocksDraftHistory: false,
    unlocksPriorityQueue: false,
    unlocksBrandedPdf: false,
    popular: true,
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceMonthly: 25,
    reviewsPerWeek: 20,
    reviewsPerMonth: 80,
    overagePerReview: 0.59,
    maxArticleWords: 2500,                 // longer essays, longer features
    seats: 1,
    extraSeatPriceMonthly: 0,
    unlocksAllEditors: true,
    unlocksPurposeEditor: true,
    unlocksJournalismSpecialists: true,
    unlocksCitationStyle: true,
    unlocksAssignmentPrompt: true,
    unlocksDraftHistory: true,
    unlocksPriorityQueue: true,
    unlocksBrandedPdf: false,
    popular: false,
  },
  team: {
    id: "team",
    label: "Team",
    priceMonthly: 59,
    reviewsPerWeek: 50,                    // shared across the team
    reviewsPerMonth: 200,
    overagePerReview: 0.49,
    maxArticleWords: 3000,                 // term papers, research-paper sections
    seats: 5,
    extraSeatPriceMonthly: 9,              // each extra seat adds 10 reviews/week
    unlocksAllEditors: true,
    unlocksPurposeEditor: true,
    unlocksJournalismSpecialists: true,
    unlocksCitationStyle: true,
    unlocksAssignmentPrompt: true,
    unlocksDraftHistory: true,
    unlocksPriorityQueue: true,
    unlocksBrandedPdf: true,
    popular: false,
  },
};

// Display order, cheapest first.
export const PLAN_ORDER: Plan[] = ["free", "basic", "pro", "team"];

// True when the writer's plan grants access to a given editor.
export function planIncludesAgent(plan: Plan, agent: AgentName): boolean {
  if (PLANS[plan].unlocksAllEditors) return true;
  return FREE_AGENTS.includes(agent);
}

// "$12" / "Free" — short price label for plan cards.
export function priceLabel(plan: PlanInfo): string {
  return plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}`;
}

// "10 reviews/week (43/month), then $0.69 each" — the included-reviews row.
export function reviewQuotaLabel(plan: PlanInfo): string {
  const weekly = `${plan.reviewsPerWeek} reviews/week`;
  const monthly = ` (${plan.reviewsPerMonth}/month)`;
  if (plan.overagePerReview === 0) {
    return `${weekly}${monthly} (hard cap)`;
  }
  return `${weekly}${monthly}, then $${plan.overagePerReview.toFixed(2)} each`;
}

// "5 seats, $9/seat after" for Team. Empty for individual plans.
export function seatsLabel(plan: PlanInfo): string {
  if (plan.seats <= 1) return "Single seat";
  if (plan.extraSeatPriceMonthly === 0) return `${plan.seats} seats included`;
  return `${plan.seats} seats included, then $${plan.extraSeatPriceMonthly}/seat (each adds 10 reviews/week to the pool)`;
}

// "Up to 2,500 words per review" — the draft-length cap row.
export function wordCapLabel(plan: PlanInfo): string {
  return `Up to ${plan.maxArticleWords.toLocaleString()} words per draft`;
}

// Simple word-count: split on whitespace, drop empties.
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

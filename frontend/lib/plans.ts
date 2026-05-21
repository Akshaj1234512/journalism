import { AgentName } from "./types";

export type Plan = "free" | "writer" | "pro" | "team";

// Editors included on the free tier. Paid tiers unlock all six. The three
// gated editors (Anne/legal, Joe/human-rights, Sol/questions) are the
// distinctive ones — that gap is the upgrade pull.
export const FREE_AGENTS: AgentName[] = ["clarity", "data_expert", "partisan"];

// A new account may take one 7-day trial. It unlocks the Writer tier — the
// most basic paid plan, which still includes all six editors.
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN: Plan = "writer";

export interface PlanInfo {
  id: Plan;
  label: string;
  priceMonthly: number;
  reviewsPerMonth: number;
  agentCount: number;
  tagline: string;
  popular: boolean;
}

export const PLANS: Record<Plan, PlanInfo> = {
  free: {
    id: "free",
    label: "Free",
    priceMonthly: 0,
    reviewsPerMonth: 5,
    agentCount: 3,
    tagline: "Try the room before you commit.",
    popular: false,
  },
  writer: {
    id: "writer",
    label: "Writer",
    priceMonthly: 12,
    reviewsPerMonth: 20,
    agentCount: 6,
    tagline: "For a working writer.",
    popular: true,
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceMonthly: 29,
    reviewsPerMonth: 75,
    agentCount: 6,
    tagline: "For frequent filers and small desks.",
    popular: false,
  },
  team: {
    id: "team",
    label: "Team",
    priceMonthly: 79,
    reviewsPerMonth: 250,
    agentCount: 6,
    tagline: "For a newsroom desk reviewing every day.",
    popular: false,
  },
};

// Display order, cheapest first.
export const PLAN_ORDER: Plan[] = ["free", "writer", "pro", "team"];

// True when a plan grants access to a given editor.
export function planIncludesAgent(plan: Plan, agent: AgentName): boolean {
  return plan === "free" ? FREE_AGENTS.includes(agent) : true;
}

// "$12" / "Free" — short price label.
export function priceLabel(plan: PlanInfo): string {
  return plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}`;
}

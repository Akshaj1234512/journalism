"use client";

import Link from "next/link";
import { useState } from "react";

import {
  FREE_AGENTS,
  PLAN_ORDER,
  PLANS,
  TRIAL_DAYS,
  planIncludesAgent,
  type Plan,
} from "@/lib/plans";
import { createClient } from "@/lib/supabase/client";
import { AGENTS, type AgentName } from "@/lib/types";

// Free editors first, then the three gated ones.
const AGENT_ORDER: AgentName[] = [
  ...FREE_AGENTS,
  ...(Object.keys(AGENTS) as AgentName[]).filter(
    (a) => !FREE_AGENTS.includes(a),
  ),
];

interface Props {
  email: string;
  plan: Plan;
  reviewsUsed: number;
  quotaResetAt: string | null;
  memberSince: string | null;
}

export function AccountView({
  email,
  plan,
  reviewsUsed,
  quotaResetAt,
  memberSince,
}: Props) {
  const [signingOut, setSigningOut] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const current = PLANS[plan];
  const used = Math.min(reviewsUsed, current.reviewsPerMonth);
  const pct = Math.min(100, Math.round((used / current.reviewsPerMonth) * 100));
  const initial = email[0]?.toUpperCase() ?? "?";

  async function onSignOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  function comingSoon() {
    setNote(
      "Plan changes and the free trial activate once payment setup is complete — that's the next step we're building.",
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-7 py-4">
        <Link href="/" className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
            Pre-publication review
          </div>
          <div className="mt-0.5 font-serif text-xl italic tracking-tight text-neutral-900">
            The <span style={{ color: "#DC2626" }}>Red Room</span>
          </div>
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
        >
          ← Back to the editor
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-serif text-3xl text-neutral-900">Account</h1>

        {/* Profile */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-semibold text-white"
              style={{ backgroundColor: "#DC2626" }}
            >
              {initial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-neutral-900">
                {email}
              </div>
              <div className="text-[12.5px] text-neutral-500">
                Member since {fmtMonth(memberSince)}
              </div>
            </div>
          </div>
        </section>

        {/* Current plan + usage */}
        <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Current plan
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl text-neutral-900">
                  {current.label}
                </span>
                <span className="text-[13px] text-neutral-500">
                  {current.priceMonthly === 0
                    ? "Free"
                    : `$${current.priceMonthly} / month`}
                </span>
              </div>
            </div>
            <span
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                plan === "free"
                  ? "bg-neutral-100 text-neutral-600"
                  : "bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              {plan === "free" ? "Free tier" : "Paid"}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="font-medium text-neutral-700">
                Reviews this month
              </span>
              <span className="text-neutral-500">
                {used} of {current.reviewsPerMonth}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-rose-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px] text-neutral-400">
              Resets {fmtDate(quotaResetAt)}
            </div>
          </div>
        </section>

        {/* Editor access */}
        <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Editor access — {current.agentCount} of 6
          </div>
          <ul className="mt-3 divide-y divide-neutral-100">
            {AGENT_ORDER.map((name) => {
              const meta = AGENTS[name];
              const included = planIncludesAgent(plan, name);
              return (
                <li
                  key={name}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: included ? meta.brandHex : "#D4D4D4",
                    }}
                  />
                  <span
                    className={[
                      "flex-1 text-[13.5px]",
                      included ? "text-neutral-800" : "text-neutral-400",
                    ].join(" ")}
                  >
                    <span className="font-medium">{meta.firstName}</span>
                    <span className="text-neutral-400"> — {meta.shortLabel}</span>
                  </span>
                  {included ? (
                    <span className="text-[11.5px] font-medium text-emerald-600">
                      Included
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-neutral-400">
                      <LockGlyph />
                      Paid
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Plans */}
        <section className="mt-8">
          <h2 className="font-serif text-2xl text-neutral-900">Plans</h2>
          <p className="mt-1 text-[13px] text-neutral-500">
            Every paid plan unlocks all six editors — including Anne&apos;s
            legal review and Sol&apos;s deep questions. Higher tiers add more
            reviews each month.
          </p>

          {/* Free trial callout */}
          {plan === "free" && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-stone-50">
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                    <SparkGlyph />
                  </span>
                  <div>
                    <div className="text-[14.5px] font-semibold text-neutral-900">
                      Try every editor free for {TRIAL_DAYS} days
                    </div>
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-600">
                      A one-week trial of the Writer plan — all six editors
                      unlocked, no credit card required.
                    </div>
                  </div>
                </div>
                <button
                  onClick={comingSoon}
                  className="shrink-0 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  Start free trial
                </button>
              </div>
            </div>
          )}

          {/* Plan grid */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((id) => (
              <PlanCard
                key={id}
                planId={id}
                isCurrent={id === plan}
                onChoose={comingSoon}
              />
            ))}
          </div>

          {note && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {note}
            </p>
          )}
        </section>

        {/* Sign out */}
        <div className="mt-8 border-t border-neutral-200 pt-6">
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </main>
  );
}

function PlanCard({
  planId,
  isCurrent,
  onChoose,
}: {
  planId: Plan;
  isCurrent: boolean;
  onChoose: () => void;
}) {
  const p = PLANS[planId];
  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm",
        p.popular ? "border-rose-300 ring-1 ring-rose-200" : "border-neutral-200",
      ].join(" ")}
    >
      {p.popular && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}

      <div className="font-serif text-lg text-neutral-900">{p.label}</div>

      <div className="mt-1 flex items-baseline gap-1">
        {p.priceMonthly === 0 ? (
          <span className="text-2xl font-semibold text-neutral-900">Free</span>
        ) : (
          <>
            <span className="text-2xl font-semibold text-neutral-900">
              ${p.priceMonthly}
            </span>
            <span className="text-[12px] text-neutral-400">/ month</span>
          </>
        )}
      </div>

      {/* Reviews + editors */}
      <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3 text-[12.5px] text-neutral-600">
        <div className="flex items-center gap-1.5">
          <CheckGlyph />
          <span>
            <span className="font-medium text-neutral-800">
              {p.reviewsPerMonth}
            </span>{" "}
            reviews / month
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <CheckGlyph />
            <span>
              {p.agentCount === 6
                ? "All 6 editors"
                : `${p.agentCount} of 6 editors`}
            </span>
          </div>
          {/* Soft-tint chips, greyed when the plan excludes that editor */}
          <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
            {AGENT_ORDER.map((name) => {
              const meta = AGENTS[name];
              const included = planIncludesAgent(planId, name);
              return (
                <span
                  key={name}
                  title={`${meta.firstName} — ${meta.shortLabel}`}
                  className={[
                    "rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
                    included
                      ? "text-neutral-700"
                      : "bg-neutral-100 text-neutral-400",
                  ].join(" ")}
                  style={
                    included
                      ? { backgroundColor: meta.highlightHex }
                      : undefined
                  }
                >
                  {meta.firstName}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tagline */}
      <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
        {p.tagline}
      </p>

      <div className="mt-4 flex-1" />

      {isCurrent ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[13px] font-medium text-neutral-500">
          Current plan
        </div>
      ) : (
        <button
          onClick={onChoose}
          className={[
            "rounded-xl px-4 py-2 text-[13px] font-semibold shadow-sm transition",
            p.popular
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
          ].join(" ")}
        >
          Choose {p.label}
        </button>
      )}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function LockGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden
    >
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      <path d="M4 5.5 V4 a2 2 0 0 1 4 0 V5.5" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 14 14"
      width="13"
      height="13"
      className="mt-0.5 shrink-0 text-rose-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7.5 L6 10.5 L11 4" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 1 L9.4 5.2 L13.6 6.6 L9.4 8 L8 12.2 L6.6 8 L2.4 6.6 L6.6 5.2 Z" />
    </svg>
  );
}

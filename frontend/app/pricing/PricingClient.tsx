"use client";

import { useState } from "react";

type Billing = "annual" | "monthly";

interface Feature {
  label: string;
  included: boolean;
}

interface PlanCardProps {
  name: string;
  badge: string | null;
  price: string;
  per: string;
  tagline: string;
  cta: string;
  ctaStyle: "primary" | "secondary" | "ghost";
  features: Feature[];
}

function PlanCard({
  name,
  badge,
  price,
  per,
  tagline,
  cta,
  ctaStyle,
  features,
}: PlanCardProps) {
  const isPrimary = ctaStyle === "primary";
  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border bg-white px-5 pb-6 pt-5 shadow-sm",
        isPrimary ? "border-rose-300 ring-2 ring-rose-100" : "border-neutral-200",
      ].join(" ")}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-rose-600 px-3 py-0.5 text-[10.5px] font-semibold text-white shadow-sm">
            {badge}
          </span>
        </div>
      )}

      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {name}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-[32px] italic leading-none tracking-tight text-neutral-900">
          {price}
        </span>
        <span className="text-[11.5px] text-neutral-400">{per}</span>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-snug text-neutral-500">{tagline}</p>

      <button
        type="button"
        onClick={() => {}}
        className={[
          "mt-5 w-full rounded-xl px-4 py-2.5 text-[12.5px] font-semibold transition",
          ctaStyle === "primary"
            ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            : ctaStyle === "secondary"
              ? "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
              : "border border-dashed border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-800",
        ].join(" ")}
      >
        {cta}
      </button>

      <div className="mt-5 space-y-2">
        {features.map(({ label, included }) => (
          <div
            key={label}
            className="flex items-start gap-2 text-[11.5px]"
            style={{ color: included ? "#404040" : "#c4b5a5" }}
          >
            <span
              aria-hidden
              className={[
                "mt-[1px] shrink-0 text-[11px] font-bold",
                included ? "text-emerald-500" : "text-neutral-300",
              ].join(" ")}
            >
              {included ? "✓" : "✕"}
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan requires nothing but an email. You're billed only when you upgrade.",
  },
  {
    q: "What counts as a 'review'?",
    a: "One click of 'Run review' on any draft, in any mode. Stopping mid-run still counts.",
  },
  {
    q: "What is multi-agent synthesis?",
    a: "On Plus and above, agents read each other's findings and can cross-reference issues. On Free, each agent reviews independently.",
  },
  {
    q: "Can I switch plans mid-month?",
    a: "Yes. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.",
  },
  {
    q: "What are 'essential agents' on Free?",
    a: "Each mode gets the two editors that catch the highest-impact issues: legal + one craft editor for journalism, structure + prose for essays, methodology + format for research.",
  },
  {
    q: "What is the soft ceiling on Pro?",
    a: "Around 60 reviews a month — a ceiling no individual writer has hit in practice. Contact us for the Enterprise plan if you need more.",
  },
];

export function PricingClient() {
  const [billing, setBilling] = useState<Billing>("annual");

  const plans = [
    {
      name: "Free",
      badge: null,
      price: "$0",
      per: "forever",
      tagline: "Prove the multi-editor value prop with real, if narrow, utility.",
      cta: "Get started",
      ctaStyle: "secondary" as const,
      features: [
        { label: "3 reviews / month", included: true },
        { label: "Max 2 agents per review", included: true },
        { label: "All 3 modes (essential agents only)", included: true },
        { label: "Multi-agent synthesis", included: false },
        { label: "Export to PDF / Word", included: false },
        { label: "Saved agent presets", included: false },
        { label: "Priority processing", included: false },
      ],
    },
    {
      name: "Plus",
      badge: "Most popular",
      price: billing === "annual" ? "$11" : "$19",
      per: billing === "annual" ? "/ mo · billed $132 / yr" : "/ month",
      tagline: "The default plan for an active student or freelance writer working across formats.",
      cta: "Start with Plus",
      ctaStyle: "primary" as const,
      features: [
        { label: "20 reviews / month", included: true },
        { label: "Up to 6 agents per review", included: true },
        { label: "All 3 modes, full options", included: true },
        { label: "Multi-agent synthesis", included: true },
        { label: "Export to PDF / Word", included: true },
        { label: "Saved agent presets", included: false },
        { label: "Priority processing", included: false },
      ],
    },
    {
      name: "Pro",
      badge: null,
      price: billing === "annual" ? "$22" : "$36",
      per: billing === "annual" ? "/ mo · billed $264 / yr" : "/ month",
      tagline: "For grad students mid-thesis and professional freelancers who want the full adversarial-review experience.",
      cta: "Start with Pro",
      ctaStyle: "secondary" as const,
      features: [
        { label: "Unlimited reviews (~60 / mo)", included: true },
        { label: "All agents, no limit", included: true },
        { label: "All 3 modes, full options", included: true },
        { label: "Multi-agent synthesis", included: true },
        { label: "Export to PDF / Word", included: true },
        { label: "Saved agent presets", included: true },
        { label: "Priority processing", included: true },
      ],
    },
    {
      name: "Enterprise",
      badge: null,
      price: "Custom",
      per: "volume pricing",
      tagline: "Newsrooms, universities, and teams. Custom configuration, dedicated support, and usage that scales.",
      cta: "Contact us",
      ctaStyle: "ghost" as const,
      features: [
        { label: "Custom review volume", included: true },
        { label: "Custom agent configurations", included: true },
        { label: "All 3 modes, full options", included: true },
        { label: "Multi-agent synthesis", included: true },
        { label: "Export to PDF / Word", included: true },
        { label: "Saved agent presets", included: true },
        { label: "Dedicated support & SLA", included: true },
      ],
    },
  ];

  return (
    <>
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white p-1 text-[12px] font-medium"
        >
          <button
            role="radio"
            aria-checked={billing === "annual"}
            onClick={() => setBilling("annual")}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition",
              billing === "annual"
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100",
            ].join(" ")}
          >
            Annual
            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                billing === "annual"
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              Save ~40%
            </span>
          </button>
          <button
            role="radio"
            aria-checked={billing === "monthly"}
            onClick={() => setBilling("monthly")}
            className={[
              "rounded-full px-4 py-1.5 transition",
              billing === "monthly"
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100",
            ].join(" ")}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <PlanCard key={p.name} {...p} />
        ))}
      </div>
    </>
  );
}

import Link from "next/link";

import { PricingClient } from "./PricingClient";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-6 pb-24">
        {/* Header */}
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-b border-neutral-200 bg-stone-50 py-5">
          <Link href="/" className="flex items-center gap-3">
            <span
              aria-hidden
              className="hidden sm:block h-10 w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: "#DC2626" }}
            />
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                Pre-publication review
              </div>
              <div className="mt-0.5 font-serif text-[22px] italic leading-none tracking-tight text-neutral-900">
                The <span style={{ color: "#DC2626" }}>Red Room</span>
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-[12.5px] font-medium text-neutral-500 hover:text-neutral-800"
          >
            ← Back to editor
          </Link>
        </header>

        {/* Hero */}
        <div className="mx-auto mt-14 max-w-2xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
            Pricing
          </div>
          <h1 className="mt-3 font-serif text-[38px] italic leading-tight tracking-tight text-neutral-900">
            Independent agents.<br />
            <span style={{ color: "#DC2626" }}>One honest read.</span>
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-neutral-500">
            Every plan gives you real expert feedback before you publish. Upgrade
            when you need more editors, more modes, or more reviews.
          </p>
        </div>

        {/* Client island: billing toggle + cards + FAQ */}
        <div className="mx-auto mt-8 max-w-5xl">
          <PricingClient />
        </div>
    </main>
  );
}

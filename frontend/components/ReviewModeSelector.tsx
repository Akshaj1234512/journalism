"use client";

import { REVIEW_MODES, ReviewMode } from "@/lib/types";

interface Props {
  mode: ReviewMode;
  onChange: (mode: ReviewMode) => void;
}

/**
 * A small segmented control in the header: Brief | Standard | Deep | Custom.
 * Selecting a mode (other than Custom) sets which agents are enabled for the
 * next review. Custom = the user is steering things by hand in the rail.
 *
 * This is the differentiator from generic AI editors: different stories
 * deserve different reviews, not one-size-fits-all.
 */
export function ReviewModeSelector({ mode, onChange }: Props) {
  const current = REVIEW_MODES.find((m) => m.id === mode) ?? REVIEW_MODES[1];
  return (
    <div
      className="inline-flex flex-col"
      title={`${current.label} review: ${current.description} (${current.estSeconds})`}
    >
      <div className="inline-flex items-center rounded-xl border border-neutral-200 bg-white p-0.5">
        {REVIEW_MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={[
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                active
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900",
              ].join(" ")}
              title={m.description}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <span className="mt-0.5 text-center text-[9px] uppercase tracking-wider text-neutral-400">
        {current.estSeconds} review
      </span>
    </div>
  );
}

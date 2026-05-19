"use client";

import { useEffect, useRef, useState } from "react";

interface Sample {
  label: string;
  blurb: string;
  text: string;
}

const SAMPLES: Sample[] = [
  {
    label: "A libel risk",
    blurb: "A loaded criminal verb and a single anonymous source. Anne and Parker will both flag it.",
    text:
      "City councilman Mark Reyes stole more than $400,000 from a youth sports nonprofit he chaired, according to a former board member who spoke on condition of anonymity. Reyes did not respond to a request for comment.",
  },
  {
    label: "A stats overclaim",
    blurb: "A poll lead inside its margin of error, sold as a decisive result. Peter will catch it.",
    text:
      "A new poll shows the incumbent mayor leading her challenger 48% to 46% with 6% undecided, putting her ahead with three weeks until election day. The poll was conducted among 800 likely voters with a margin of error of 3.5 percentage points. Campaign aides hailed the lead as a sign of the mayor's recovery.",
  },
  {
    label: "A vulnerable-source profile",
    blurb: "An undocumented source identified with name, age, neighbourhood and employer. Joe will flag the dossier.",
    text:
      "Maria Lopez, 34, an undocumented housekeeper who lives in the Sunset Park section of Brooklyn, said she has not been paid for six weeks of work by her employer, a wealthy attorney whose home she has cleaned since 2021. \"I am afraid to call the police because of my status,\" Lopez said in an interview at her apartment on 47th Street.",
  },
];

interface Props {
  onPick: (text: string) => void;
}

export function SampleDraftsButton({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-[11.5px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        title="Load a short sample draft to try the room"
      >
        <SparkleGlyph />
        Try a sample
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[320px] rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl"
          role="menu"
          style={{
            animation: "rr-pop 160ms cubic-bezier(.16,.84,.44,1) both",
            // Above the tutorial overlay (z-200) so the dropdown lands on
            // top of the dim background during the guided tour.
            zIndex: 300,
          }}
        >
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                onPick(s.text);
                setOpen(false);
              }}
              className="block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-neutral-50"
              role="menuitem"
            >
              <div className="text-[12.5px] font-semibold text-neutral-900">
                {s.label}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                {s.blurb}
              </div>
            </button>
          ))}
          <style jsx>{`
            @keyframes rr-pop {
              from { opacity: 0; transform: translateY(-4px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0)     scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function SparkleGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden>
      <path d="M8 1.5 L9 5.5 L13 6.5 L9 7.5 L8 11.5 L7 7.5 L3 6.5 L7 5.5 Z" opacity="0.9" />
      <circle cx="12.5" cy="2.5" r="0.9" />
      <circle cx="3" cy="12.5" r="0.7" />
    </svg>
  );
}

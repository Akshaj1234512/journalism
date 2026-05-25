"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Mode } from "@/lib/types";

export type TutorialTrack = "main" | "journalism" | "essays" | "research";

interface Step {
  /** data-tutorial attribute value to anchor the spotlight to.
   *  Omit for centered "intro" cards. */
  target?: string;
  /** Side of the target to place the card on. Defaults to a sensible auto pick. */
  side?: "top" | "bottom" | "left" | "right";
  title: string;
  body: string;
  /** Optional accent colour for the card's top border. */
  accent?: string;
  /** If set, the tutorial switches the app into this mode before showing
   *  the step (so the targeted control is actually rendered). */
  requireMode?: Mode;
}

// ────────────────────────────────────────────────────────────────────────────
// Track 1: MAIN — the universal first-visit tour. Covers concepts that apply
// across every mode: what the room is, how to switch modes, the editor rail,
// the draft pane, the run button, the sidebar, and the sign-in card. Each
// mode's specifics are intentionally NOT here — they live in the mode-mini
// tutorials below, which fire on first entry to each mode.
// ────────────────────────────────────────────────────────────────────────────
const MAIN_STEPS: Step[] = [
  {
    title: "Welcome to The Red Room",
    body:
      "An independent team of AI editors reads your draft and flags what a real newsroom or writing center would catch before you publish or submit. This minute walks through the universals. Each tab has its own quick tour the first time you open it.",
    accent: "#DC2626",
  },
  {
    target: "mode",
    side: "bottom",
    title: "Three modes",
    body:
      "Journalism for news, opinion, features, profiles, reviews, and explainers. Essays for academic writing across five genres. Research for full-paper review of an uploaded PDF. The editor lineup on the left rail swaps when you change modes.",
  },
  {
    target: "rail",
    side: "right",
    title: "Meet the editors",
    body:
      "Each editor specialises in one lane. Click any of them to read what they look for and to turn them off if a lane doesn't apply to your draft. The list updates whenever you switch modes; scroll if you don't see all of them.",
  },
  {
    target: "editor",
    side: "left",
    title: "Your draft goes here",
    body:
      "Type or paste your draft, or drop in a Word / .txt file. Your draft is saved in this browser, so a refresh won't lose it. (Research mode is different — you upload a PDF instead, and the tour for that tab will cover it.)",
  },
  {
    target: "run",
    side: "bottom",
    title: "Run the review",
    body:
      "When you're ready, click here. The editors who are turned on read in parallel; the first notes start landing in about twenty seconds. The button shows a count of how many editors will run.",
  },
  {
    target: "sidebar",
    side: "left",
    title: "Read the notes",
    body:
      "Notes appear here in document order. Click any feedback card to jump to that line in the editor. Click an underlined phrase in the editor to jump back to its card. When two or more editors flag the same passage, a Hotspot badge appears — that's the strongest signal the room produces.",
  },
  {
    target: "signin",
    side: "bottom",
    title: "Save your work and try Pro free",
    body:
      "Create a free account to save your drafts and track your reviews. New accounts get a 7-day free trial of the Pro plan — all 16 editors, 20 reviews per week, no credit card required.",
    accent: "#DC2626",
  },
  {
    title: "One last thing",
    body:
      "The agents are grounded in real press-regulator rulings, editorial standards, and writing-center research, but they're still AI. Treat every note as a suggestion to consider, not an instruction you must follow. When you open a tab for the first time, a quick tour of THAT tab's specific controls will pop up.",
    accent: "#DC2626",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Track 2: JOURNALISM mini-tutorial. Fires the first time the user is in
// journalism mode (typically right after the main tour, since journalism is
// the default mode). 3 steps + an intro.
// ────────────────────────────────────────────────────────────────────────────
const JOURNALISM_STEPS: Step[] = [
  {
    title: "Journalism mode",
    body:
      "The room is set up for press work. Some editors always run (Anne for legal risk, plus the six craft editors). A handful more are added based on context you set here. Quick tour of the controls.",
    accent: "#DC2626",
    requireMode: "journalism",
  },
  {
    target: "article-type",
    side: "bottom",
    requireMode: "journalism",
    title: "Pick your article type",
    body:
      "Tell the room what kind of piece you're writing. A matching type specialist joins the lineup: Cole for news, Iris for investigations, Otto for opinion, Faye for features, Pia for profiles, Remy for reviews, Eli for explainers. The rail will update as you pick.",
  },
  {
    target: "journalism-toggles",
    side: "bottom",
    requireMode: "journalism",
    title: "Add specialists for your story",
    body:
      "These chips activate three more editors when your story calls for them. Partisan adds Parker (loaded framing, asymmetric treatment). Data claims adds Peter (statistics and quantitative claims). Anonymous sources adds Joe (source protection and privacy). Sensible defaults pre-fill when you change article type — toggle anything that doesn't fit.",
  },
  {
    target: "subject-context",
    side: "bottom",
    requireMode: "journalism",
    title: "Add story context (optional)",
    body:
      "Paste a short note about who the story is about, the angle, or the publication venue. Only the type specialist sees it, and uses it to sharpen the read. Optional, but worth it when the draft alone doesn't carry everything the editor needs.",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Track 3: ESSAYS mini-tutorial. Fires on first entry to essays mode.
// ────────────────────────────────────────────────────────────────────────────
const ESSAYS_STEPS: Step[] = [
  {
    title: "Essays mode",
    body:
      "The room is set up for academic writing. The six craft editors run on every essay; a Purpose Editor specific to your essay's genre is added when you pick a type. Three controls tailor the review.",
    accent: "#DC2626",
    requireMode: "essays",
  },
  {
    target: "essay-type",
    side: "bottom",
    requireMode: "essays",
    title: "Pick your essay type",
    body:
      "Choose what kind of essay you're writing: argumentative, analytical, personal / narrative, research, or rhetorical analysis. A matching Purpose Editor (Ari, Anya, Nora, Reese, or Rhea) joins the rail and reads against THAT genre's standards. Each option in the dropdown shows examples so you know which one fits.",
  },
  {
    target: "essay-prompt",
    side: "bottom",
    requireMode: "essays",
    title: "Paste the assignment prompt",
    body:
      "Click Add prompt to paste the actual rubric or instructions your teacher gave you. Only the Purpose Editor sees it, and it uses the prompt to focus feedback on what was assigned. Optional but it sharpens the review significantly.",
  },
  {
    target: "citation",
    side: "bottom",
    requireMode: "essays",
    title: "Set your citation style",
    body:
      "If you're using MLA, APA, Chicago, or Turabian, pick it here. Kate the Citation Editor checks your in-text citations and references against that style's rules. Leave it on None if your essay isn't using a formal citation style.",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Track 4: RESEARCH mini-tutorial. Fires on first entry to research mode.
// Different from journalism / essays because the input is a PDF.
// ────────────────────────────────────────────────────────────────────────────
const RESEARCH_STEPS: Step[] = [
  {
    title: "Research mode",
    body:
      "The room reviews a full research paper as a PDF. Seven editors run by default — five core (methodology, related work, limitations, figures + tables, structure) plus a math editor for theory papers, plus a subject specialist tuned to your field. The pane in the center is where you drop the paper.",
    accent: "#DC2626",
    requireMode: "research",
  },
  {
    target: "research-section",
    side: "bottom",
    requireMode: "research",
    title: "Pick a section to focus on",
    body:
      "Narrow the review to one section (Methods, Results, Discussion, etc.) or leave it on Full paper for a full read. The editors see the whole PDF either way; this just tells them where to anchor their critique.",
  },
  {
    target: "research-subject",
    side: "bottom",
    requireMode: "research",
    title: "Pick your subject area",
    body:
      "Picks a subject specialist who reviews against that field's conventions. CS / ML is wired up now; engineering, biology, and medicine are coming. Pair this with the venue field next to it (e.g. 'ICML 2026' or 'Nature Methods') and the specialist tunes to that venue's bar — novelty, evaluation scope, required sections.",
  },
  {
    target: "research-upload",
    side: "left",
    requireMode: "research",
    title: "Drop in your PDF",
    body:
      "Drag your paper here or click to browse. The room reads the PDF natively (figures, tables, and all). Cap is 25 MB. Once it's in, hit Run review — the first notes land in about a minute on a typical 10-page paper.",
  },
];

const TRACKS: Record<TutorialTrack, Step[]> = {
  main: MAIN_STEPS,
  journalism: JOURNALISM_STEPS,
  essays: ESSAYS_STEPS,
  research: RESEARCH_STEPS,
};

const CARD_WIDTH = 380;
const CARD_GAP = 16;
const VIEWPORT_PADDING = 16;


interface Props {
  open: boolean;
  /** Which track to run. Defaults to "main". */
  track?: TutorialTrack;
  onClose: () => void;
  mode: Mode;
  onSetMode: (m: Mode) => void;
}

export function Tutorial({ open, track = "main", onClose, mode, onSetMode }: Props) {
  const STEPS = TRACKS[track];
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; arrow?: "top" | "bottom" | "left" | "right"; centered?: boolean } | null>(null);

  // Lock the page scroll while the tour is open so spotlight positions stay
  // anchored to the elements they target.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset to the first step every time the tour opens OR the track changes.
  useEffect(() => {
    if (open) setStep(0);
  }, [open, track]);

  // If the active step requires a specific mode (e.g. journalism-toolbar steps
  // need journalism mode), switch the app into it before measuring so the
  // targeted control is actually rendered.
  useEffect(() => {
    if (!open) return;
    const need = STEPS[step]?.requireMode;
    if (need && need !== mode) onSetMode(need);
  }, [open, step, mode, onSetMode, STEPS]);

  // Compute spotlight + card position whenever the active step changes.
  useLayoutEffect(() => {
    if (!open) return;
    const current = STEPS[step];
    if (!current) return;

    // Centered cards (welcome / final): no target, no spotlight.
    if (!current.target) {
      setRect(null);
      setCardPos({
        top: window.innerHeight / 2 - 130,
        left: window.innerWidth / 2 - CARD_WIDTH / 2,
        centered: true,
      });
      return;
    }

    const el = document.querySelector<HTMLElement>(`[data-tutorial="${current.target}"]`);
    if (!el) {
      // Target missing — usually because a mode-switch in the previous
      // effect tick hasn't rendered the new toolbar yet. Show a centered
      // fallback for now; this effect re-runs once `mode` changes and we
      // get the real element on the next pass.
      setRect(null);
      setCardPos({
        top: window.innerHeight / 2 - 130,
        left: window.innerWidth / 2 - CARD_WIDTH / 2,
        centered: true,
      });
      return;
    }

    const r = el.getBoundingClientRect();
    setRect(r);
    setCardPos(positionCard(r, current.side));

    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    const onResize = () => {
      const rr = el.getBoundingClientRect();
      setRect(rr);
      setCardPos(positionCard(rr, current.side));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, step, mode, STEPS]);

  // ESC closes the tour, arrows navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const next = useCallback(() => {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, [STEPS]);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
  const finish = useCallback(() => onClose(), [onClose]);

  if (!open || typeof document === "undefined") return null;
  if (!STEPS || STEPS.length === 0) return null;

  // When the track changes (e.g. main tour chains into a mode-mini tour),
  // there is one render between the new track being applied and the
  // step-reset useEffect firing. During that render `step` may be out of
  // bounds for the new STEPS array, which would crash `current.target`
  // below. Skip rendering until the reset effect catches up.
  if (step >= STEPS.length) return null;

  const current = STEPS[step];
  if (!current) return null;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const passThrough = !!current.target;

  const trackLabel: Record<TutorialTrack, string> = {
    main: "Quick tour",
    journalism: "Journalism mode",
    essays: "Essays mode",
    research: "Research mode",
  };

  return createPortal(
    <div
      className={[
        "fixed inset-0 z-[200]",
        passThrough ? "pointer-events-none" : "",
      ].join(" ")}
      aria-modal
      role="dialog"
    >
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl transition-all duration-300 ease-out"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow:
              "0 0 0 9999px rgba(15, 23, 42, 0.62), 0 0 0 3px rgba(220, 38, 38, 0.55)",
            transition: "all 280ms cubic-bezier(.4,.0,.2,1)",
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(15,23,42,0.62)" }}
        />
      )}

      {cardPos && (
        <div
          key={`${track}-${step}`}
          className="pointer-events-auto absolute rounded-2xl bg-white shadow-2xl"
          style={{
            top: cardPos.top,
            left: cardPos.left,
            width: CARD_WIDTH,
            borderTop: `3px solid ${current.accent ?? "#0F172A"}`,
            animation: "rr-card-in 220ms cubic-bezier(.16,.84,.44,1) both",
          }}
        >
          <div className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {trackLabel[track]} · Step {step + 1} of {STEPS.length}
              </span>
              <button
                onClick={onClose}
                aria-label="Close tour"
                className="-mr-1 -mt-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>
            <h2 className="font-serif text-[19px] italic leading-tight tracking-tight text-neutral-900">
              {current.title}
            </h2>
            <p className="mt-2 text-[13px] leading-snug text-neutral-700">
              {current.body}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={[
                      "h-1.5 rounded-full transition-all",
                      i === step ? "w-5 bg-rose-600" : "w-1.5 bg-neutral-300",
                    ].join(" ")}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {!isFirst && (
                  <button
                    onClick={back}
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-100"
                  >
                    Back
                  </button>
                )}
                {!isLast && (
                  <button
                    onClick={onClose}
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-500 hover:text-neutral-800"
                  >
                    Skip
                  </button>
                )}
                {isLast ? (
                  <button
                    onClick={finish}
                    className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-rose-700"
                  >
                    Got it
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-neutral-800"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes rr-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}


/** Place the card on a sensible side of the target, clamped to the viewport. */
function positionCard(
  rect: DOMRect,
  preferred?: "top" | "bottom" | "left" | "right",
): { top: number; left: number; arrow?: "top" | "bottom" | "left" | "right" } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = CARD_WIDTH;
  const cardH = 260;

  let side = preferred;
  if (!side) {
    const space = {
      right: vw - rect.right,
      left: rect.left,
      bottom: vh - rect.bottom,
      top: rect.top,
    } as const;
    side = (Object.entries(space) as [keyof typeof space, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  let top = 0;
  let left = 0;
  switch (side) {
    case "right":
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.right + CARD_GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.left - CARD_GAP - cardW;
      break;
    case "bottom":
      top = rect.bottom + CARD_GAP;
      left = rect.left + rect.width / 2 - cardW / 2;
      break;
    case "top":
      top = rect.top - CARD_GAP - cardH;
      left = rect.left + rect.width / 2 - cardW / 2;
      break;
  }

  top = Math.max(VIEWPORT_PADDING, Math.min(vh - cardH - VIEWPORT_PADDING, top));
  left = Math.max(VIEWPORT_PADDING, Math.min(vw - cardW - VIEWPORT_PADDING, left));

  return { top, left, arrow: side };
}

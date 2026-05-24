"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Mode } from "@/lib/types";

interface Step {
  /** data-tutorial attribute value to anchor the spotlight to. Omit for centered cards. */
  target?: string;
  /** Side of the target to place the card on. Defaults to a sensible auto pick. */
  side?: "top" | "bottom" | "left" | "right";
  title: string;
  body: string;
  /** Optional accent colour for the card top border. */
  accent?: string;
  /** If set, the tutorial switches the app into this mode before showing
   *  the step (so the targeted control is actually rendered). */
  requireMode?: Mode;
}

const STEPS: Step[] = [
  {
    title: "Welcome to The Red Room",
    body:
      "An independent team of AI editors reads your draft and flags what a real newsroom or writing-centre would catch before you submit. The room handles both journalism drafts and high-school / college essays. This minute-long tour walks through both.",
    accent: "#DC2626",
  },
  {
    target: "mode",
    side: "bottom",
    title: "Two modes: journalism and essays",
    body:
      "Switch at the top between Journalism (six press editors: legal, data, source-protection, clarity, fairness, deep questions) and Essays (seven craft editors for thesis, evidence, prose, structure, logic, counter-argument, and citations, plus a specialised purpose editor and Sol the question master). Switching swaps the entire editor roster on the left rail.",
  },
  {
    target: "rail",
    side: "right",
    title: "Meet the editors",
    body:
      "Each editor specialises in one lane. Click any of them to read what they look for, or to turn them off for this review. The list updates whenever you switch modes; scroll to see all of them.",
  },
  {
    target: "essay-type",
    side: "bottom",
    requireMode: "essays",
    title: "Pick your essay type",
    body:
      "When you switch to essays mode, this dropdown appears. Pick the kind of essay you're writing (argumentative, analytical, personal, research, or rhetorical) and a specialised Purpose Editor is added to the roster who reads against THAT genre's standards. Each option shows examples so you know which one fits.",
  },
  {
    target: "essay-prompt",
    side: "bottom",
    requireMode: "essays",
    title: "Paste the assignment prompt",
    body:
      "Click + Add prompt to paste the actual rubric or assignment your teacher gave you. Only the matching Purpose Editor sees it, and it uses the prompt to give feedback specifically aimed at what was asked. Optional, but it sharpens the review significantly.",
  },
  {
    target: "citation",
    side: "bottom",
    requireMode: "essays",
    title: "Set your citation style",
    body:
      "If you're using MLA, APA, Chicago, or Turabian, pick it here. Kate the Citation Editor will check your in-text citations and works-cited entries against that style's rules. Leave it on Not specified if your essay isn't using a formal style.",
  },
  {
    target: "editor",
    side: "left",
    title: "Your draft goes here",
    body:
      "Paste an article or essay, drag in a Word .docx or .txt file, or just type. The room reads up to about fifteen hundred words at a time. Your draft is saved in this browser so a refresh won't lose it.",
  },
  {
    target: "upload",
    side: "left",
    title: "Or import a file",
    body:
      "Drag a Word doc onto the editor, or click Upload draft. For Google Docs choose File, then Download, then Microsoft Word, and drag the result in.",
  },
  {
    target: "run",
    side: "bottom",
    title: "Run the review",
    body:
      "When you're ready, click here. The editors who are turned on read in parallel; the first notes start landing in about ten seconds.",
  },
  {
    target: "sidebar",
    side: "left",
    title: "Read the notes",
    body:
      "Notes appear here in document order. Click any feedback card to jump to that line in the editor. Click an underlined phrase in the editor to jump back to its card. The room talks to itself across both panes.",
  },
  {
    target: "sidebar",
    side: "left",
    title: "Watch for hotspots",
    body:
      "When two or more editors flag the same passage, a 🔥 Hotspot badge appears. Multiple specialists arriving at the same line is the strongest editorial signal a multi-editor room produces.",
  },
  {
    title: "One last thing",
    body:
      "The agents can be wrong. They're grounded in real press-regulator rulings, editorial standards, and writing-centre research, but they're still AI. Treat every note as a question to consider, not an instruction you must follow.",
    accent: "#DC2626",
  },
];

const CARD_WIDTH = 340;
const CARD_GAP = 16;
const VIEWPORT_PADDING = 16;

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  onSetMode: (m: Mode) => void;
}

export function Tutorial({ open, onClose, mode, onSetMode }: Props) {
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

  // Reset to the first step every time the tour opens.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // If the active step requires a specific mode (e.g. essay-toolbar steps
  // need essays mode), switch the app into it before measuring so the
  // targeted control is actually rendered.
  useEffect(() => {
    if (!open) return;
    const need = STEPS[step].requireMode;
    if (need && need !== mode) onSetMode(need);
  }, [open, step, mode, onSetMode]);

  // Compute spotlight + card position whenever the active step changes.
  useLayoutEffect(() => {
    if (!open) return;
    const current = STEPS[step];

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
      // Target missing (component not yet mounted, or hidden). Fall back to centre.
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

    // Scroll the target into view if needed.
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    // Re-measure on resize.
    const onResize = () => {
      const rr = el.getBoundingClientRect();
      setRect(rr);
      setCardPos(positionCard(rr, current.side));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, step]);

  // ESC closes the tour.
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
  }, []);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
  const finish = useCallback(() => onClose(), [onClose]);

  if (!open || typeof document === "undefined") return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  // On targeted steps, the user should be free to actually click the thing
  // we are highlighting (the rail, the run button, etc.) so the tour
  // teaches them by letting them try. The outer container becomes click-
  // through; only the tutorial card itself catches pointer events. On
  // centered "welcome" / "final" steps we keep the overlay blocking so the
  // user is pinned to the card.
  const passThrough = !!current.target;

  return createPortal(
    <div
      className={[
        "fixed inset-0 z-[200]",
        passThrough ? "pointer-events-none" : "",
      ].join(" ")}
      aria-modal
      role="dialog"
    >
      {/* Spotlight cutout: a small div positioned over the target, with a
          giant box-shadow that darkens everything outside it. The cutout
          itself is transparent so the target stays visible and interactive
          underneath. pointer-events-none so clicks fall through. */}
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

      {/* The explainer card. Animates in on each step change. */}
      {cardPos && (
        <div
          key={step}
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
                Step {step + 1} of {STEPS.length}
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
                    Skip tour
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
  const cardH = 260; // approximate; overflows are clamped below

  // Auto pick when not specified: largest open side.
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

  // Clamp to viewport with a small padding.
  top = Math.max(VIEWPORT_PADDING, Math.min(vh - cardH - VIEWPORT_PADDING, top));
  left = Math.max(VIEWPORT_PADDING, Math.min(vw - cardW - VIEWPORT_PADDING, left));

  return { top, left, arrow: side };
}

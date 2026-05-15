"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Critique } from "@/lib/types";
import { AGENTS } from "@/lib/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  critiques: Critique[];
  activeId: string | null;
  resolvedIds: Set<string>;
}

/**
 * Article editor with inline span highlighting.
 *
 * Implementation: a transparent <textarea> on top of a styled <div> overlay
 * that mirrors the article text and paints highlight spans. The two share
 * identical typography and padding so the overlay marks line up with the
 * characters the user is editing.
 */
export const Editor = forwardRef<HTMLTextAreaElement, Props>(function Editor(
  { value, onChange, critiques, activeId, resolvedIds },
  ref,
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

  // Keep overlay scroll synced with textarea scroll.
  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;
    const handler = () => {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", handler);
    return () => ta.removeEventListener("scroll", handler);
  }, [textareaRef]);

  // When a sidebar card is clicked, the page sets activeId. Scroll the
  // textarea so the corresponding highlight lands in the middle of the
  // viewport. We measure via the overlay's <mark> element since the textarea
  // doesn't expose pixel positions for character offsets.
  useEffect(() => {
    if (!activeId) return;
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;
    const mark = ov.querySelector<HTMLElement>(
      `[data-critique-id="${cssEscape(activeId)}"]`,
    );
    if (!mark) return;
    const target = Math.max(
      0,
      mark.offsetTop - ta.clientHeight / 2 + mark.offsetHeight / 2,
    );
    // Set scrollTop on the textarea — its scroll listener will sync the overlay.
    ta.scrollTop = target;
    ta.focus();
  }, [activeId, critiques, textareaRef]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 scroll-friendly overflow-auto whitespace-pre-wrap break-words px-10 py-8 font-serif text-[18px] leading-[1.75] text-transparent"
      >
        {renderHighlighted(value, critiques, activeId, resolvedIds)}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        className="relative h-full w-full resize-none scroll-friendly whitespace-pre-wrap break-words bg-transparent px-10 py-8 font-serif text-[18px] leading-[1.75] text-neutral-900 outline-none placeholder:text-neutral-400"
        placeholder="Paste a draft here. The room will read it the moment you click Run review."
      />
    </div>
  );
});


function renderHighlighted(
  text: string,
  critiques: Critique[],
  activeId: string | null,
  resolvedIds: Set<string>,
) {
  const visible = critiques.filter((c) => !resolvedIds.has(critiqueId(c)));
  if (visible.length === 0) return text;

  // Sort by start; resolve overlaps by keeping the earlier-starting span.
  const sorted = [...visible].sort((a, b) => a.span[0] - b.span[0]);
  const cleaned: Critique[] = [];
  let cursor = 0;
  for (const c of sorted) {
    if (c.span[0] >= cursor) {
      cleaned.push(c);
      cursor = c.span[1];
    }
  }

  const out: React.ReactNode[] = [];
  let i = 0;
  for (const c of cleaned) {
    const [start, end] = c.span;
    if (start > i) out.push(text.slice(i, start));
    const meta = AGENTS[c.agent];
    const id = critiqueId(c);
    const isActive = activeId === id;
    // CRITICAL: no padding/margin/border/font-size changes here. Anything
    // that affects horizontal layout will cause the overlay's lines to wrap
    // differently from the textarea's lines, and the highlights will drift
    // out of alignment with the underlying text. Use box-shadow only — it
    // is rendered outside the layout box and does not affect line breaks.
    out.push(
      <mark
        key={`${start}-${end}-${c.agent}`}
        data-critique-id={id}
        style={{
          backgroundColor: meta.highlightHex,
          color: "transparent",
          textDecorationColor: meta.brandHex,
          textDecorationLine: "underline",
          textDecorationThickness: "2px",
          textUnderlineOffset: "3px",
          // box-shadow gives the active "ring" without taking layout space.
          boxShadow: isActive ? `0 0 0 2px ${meta.brandHex}` : undefined,
          padding: 0,
          margin: 0,
          border: 0,
        }}
      >
        {text.slice(start, end)}
      </mark>,
    );
    i = end;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}


/**
 * Stable per-critique id. The page assigns a `_id` (a UUID) to each critique
 * as it streams in, so identity survives span shifts when a fix is accepted.
 * The span-based fallback only applies if a critique somehow has no _id.
 */
export function critiqueId(c: Critique) {
  return c._id ?? `${c.agent}-${c.span[0]}-${c.span[1]}`;
}


/** Conservative CSS attribute-selector escaping for our generated ids. */
function cssEscape(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

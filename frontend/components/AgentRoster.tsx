"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AGENTS, AgentName } from "@/lib/types";
import { Avatar } from "./Avatar";

interface Props {
  runningAgents: Set<AgentName>;
  doneAgents: Set<AgentName>;
  disabledAgents: Set<AgentName>;
  onToggleDisabled: (agent: AgentName) => void;
  order: AgentName[];   // mode-driven roster, supplied by the page
}

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 12;
const POPOVER_EST_HEIGHT = 440;

/**
 * Vertical agent rail on the left edge of the app.
 *
 * The rail is scrollable. To prevent the rail's overflow from clipping the
 * popover that opens to its right, the popover is portaled to document.body
 * and positioned with fixed coordinates derived from the clicked button's
 * bounding rect. The popover closes if the user scrolls the rail, scrolls
 * the page, or resizes the window, so its anchor never drifts.
 */
export function AgentRoster({
  runningAgents,
  doneAgents,
  disabledAgents,
  onToggleDisabled,
  order,
}: Props) {
  const [openAgent, setOpenAgent] = useState<AgentName | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Anchor the popover near the clicked button. If the button is near the
  // bottom of the viewport, shift the popover up so it does not run off.
  const openFor = (name: AgentName) => {
    if (openAgent === name) {
      setOpenAgent(null);
      return;
    }
    const btn = buttonRefs.current[name];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const top = Math.max(
      8,
      Math.min(rect.top, window.innerHeight - POPOVER_EST_HEIGHT - 8),
    );
    const left = rect.right + POPOVER_GAP;
    setPopoverPos({ top, left });
    setOpenAgent(name);
  };

  // Close the popover the moment anything its anchor depends on moves.
  useEffect(() => {
    if (!openAgent) return;
    const close = () => setOpenAgent(null);
    const rail = railRef.current;
    rail?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      rail?.removeEventListener("scroll", close);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openAgent]);

  // Outside-click close. The popover lives in a portal so we need to allow
  // clicks inside it (it has a data attribute we look for) and inside the
  // rail itself.
  useEffect(() => {
    if (!openAgent) return;
    const onMouse = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return setOpenAgent(null);
      if (t.closest("[data-redroom-popover]")) return;
      if (railRef.current?.contains(t)) return;
      setOpenAgent(null);
    };
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, [openAgent]);

  return (
    <div
      ref={railRef}
      // overflow-y-auto for vertical scrolling. We portal the popover so this
      // doesn't clip it. scroll-friendly slims the scrollbar.
      className="relative flex h-full w-[104px] shrink-0 flex-col items-center gap-2 overflow-y-auto scroll-friendly border-r border-neutral-200 bg-white py-5"
    >
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400">
        Editors
      </div>
      <p className="-mt-1 mb-1 px-1 text-center text-[9.5px] leading-snug text-neutral-400">
        Click any editor to read more or turn them off.
      </p>

      {order.map((name) => {
        const meta = AGENTS[name];
        const running = runningAgents.has(name);
        const done = doneAgents.has(name);
        const off = disabledAgents.has(name);
        const isOpen = openAgent === name;
        return (
          <button
            key={name}
            ref={(el) => {
              buttonRefs.current[name] = el;
            }}
            type="button"
            onClick={() => openFor(name)}
            className={[
              "group flex w-[80px] flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 transition",
              isOpen ? "bg-neutral-100 ring-1 ring-neutral-300" : "hover:bg-neutral-50",
              off ? "opacity-90" : "",
            ].join(" ")}
            title={`${meta.label}${off ? " (off)" : ""}`}
          >
            <Avatar agent={name} size={44} active={running && !off} muted={off} />
            <div className="text-center leading-tight">
              <div className="flex items-center justify-center gap-0.5 text-[12px] font-semibold text-neutral-900">
                {meta.firstName}
                <span
                  className={[
                    "text-[10px] text-neutral-400 transition-transform",
                    isOpen ? "translate-x-0" : "group-hover:translate-x-0.5",
                  ].join(" ")}
                >
                  ›
                </span>
              </div>
              <div className="text-[9px] uppercase tracking-wider text-neutral-500">
                {meta.shortLabel}
              </div>
            </div>
            {off ? (
              <span className="rounded-full bg-neutral-200 px-1.5 text-[8.5px] font-bold uppercase tracking-wider text-neutral-600">
                Off
              </span>
            ) : done && !running ? (
              <span className="text-emerald-600 text-[12px] leading-none" aria-label="done">
                ✓
              </span>
            ) : running ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
            )}
          </button>
        );
      })}

      {/* Portaled popover: lives at document.body so the rail's overflow
          can't clip it. Position is fixed relative to viewport. */}
      {openAgent &&
        popoverPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-redroom-popover
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              width: POPOVER_WIDTH,
              // Above the tutorial overlay (z-200) so that when a user
              // opens this popover during the tour, it lands on top of the
              // dim background instead of being hidden behind it.
              zIndex: 300,
            }}
          >
            <AgentInfoCard
              agent={openAgent}
              off={disabledAgents.has(openAgent)}
              onClose={() => setOpenAgent(null)}
              onToggleDisabled={() => onToggleDisabled(openAgent)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}


function AgentInfoCard({
  agent,
  off,
  onClose,
  onToggleDisabled,
}: {
  agent: AgentName;
  off: boolean;
  onClose: () => void;
  onToggleDisabled: () => void;
}) {
  const meta = AGENTS[agent];
  return (
    <div
      role="dialog"
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
      style={{ borderTop: `4px solid ${meta.brandHex}` }}
    >
      <header className="flex items-start gap-3">
        <Avatar agent={agent} size={52} muted={off} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold tracking-tight text-neutral-900">
            {meta.firstName}
          </div>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: meta.brandHex }}
          >
            {meta.shortLabel}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          ✕
        </button>
      </header>

      <p className="mt-3 text-[12.5px] leading-snug text-neutral-700">{meta.tagline}</p>

      <div className="mt-4">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Looks for
        </div>
        <ul className="space-y-1.5">
          {meta.lookFor.map((item) => (
            <li
              key={item}
              className="relative pl-3.5 text-[12px] leading-snug text-neutral-700"
            >
              <span
                className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: meta.brandHex }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-xl bg-neutral-50 p-3">
        <OnOffSwitch
          on={!off}
          brandHex={meta.brandHex}
          firstName={meta.firstName}
          onToggle={onToggleDisabled}
        />
      </div>
    </div>
  );
}


function OnOffSwitch({
  on,
  brandHex,
  firstName,
  onToggle,
}: {
  on: boolean;
  brandHex: string;
  firstName: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="leading-tight">
        <div className="text-[12px] font-semibold text-neutral-900">
          {on ? `${firstName} is active` : `${firstName} is off`}
        </div>
        <div className="text-[11px] text-neutral-500">
          {on ? "Reviews this draft when you click Run." : "Skipped on the next review."}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition",
          on ? "" : "bg-neutral-300",
        ].join(" ")}
        style={{ backgroundColor: on ? brandHex : undefined }}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
            on ? "left-[26px]" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

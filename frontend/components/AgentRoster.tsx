"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, AgentName } from "@/lib/types";
import { Avatar } from "./Avatar";

interface Props {
  runningAgents: Set<AgentName>;
  doneAgents: Set<AgentName>;
  disabledAgents: Set<AgentName>;
  onToggleDisabled: (agent: AgentName) => void;
  onOpenPrompt: (agent: AgentName) => void;
}

const ORDER: AgentName[] = [
  "legal_skeptic",
  "data_expert",
  "human_rights",
  "clarity",
  "partisan",
  "question_master",
];

/**
 * Vertical agent rail on the left edge of the app.
 *
 * Each entry: avatar, first name, role. Click expands an info card that
 * floats out to the right of the rail with the agent's bio, what they
 * look for, an on/off switch for this review, and a link into the prompt
 * editor. Click outside or hit Escape to close.
 */
export function AgentRoster({
  runningAgents,
  doneAgents,
  disabledAgents,
  onToggleDisabled,
  onOpenPrompt,
}: Props) {
  const [openAgent, setOpenAgent] = useState<AgentName | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openAgent) return;
    const onMouse = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpenAgent(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAgent(null);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [openAgent]);

  return (
    <div
      ref={containerRef}
      // overflow-visible is critical here: the popover sits at left-full of
      // each agent button and would be clipped by any overflow-y rule on
      // this rail. Six agents fit any normal viewport without scrolling.
      className="relative flex h-full w-[104px] shrink-0 flex-col items-center gap-2 overflow-visible border-r border-neutral-200 bg-white py-5"
    >
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400">
        Editors
      </div>
      <p className="-mt-1 mb-1 px-1 text-center text-[9.5px] leading-snug text-neutral-400">
        Click any editor to read more or turn them off.
      </p>

      {ORDER.map((name) => {
        const meta = AGENTS[name];
        const running = runningAgents.has(name);
        const done = doneAgents.has(name);
        const off = disabledAgents.has(name);
        const isOpen = openAgent === name;
        return (
          <div key={name} className="relative">
            <button
              type="button"
              onClick={() => setOpenAgent((p) => (p === name ? null : name))}
              className={[
                "group flex w-[80px] flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 transition",
                isOpen
                  ? "bg-neutral-100 ring-1 ring-neutral-300"
                  : "hover:bg-neutral-50",
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
              {/* status badge underneath */}
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

            {isOpen && (
              <AgentInfoCard
                agent={name}
                off={off}
                onClose={() => setOpenAgent(null)}
                onToggleDisabled={() => onToggleDisabled(name)}
                onOpenPrompt={() => {
                  setOpenAgent(null);
                  onOpenPrompt(name);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}


function AgentInfoCard({
  agent,
  off,
  onClose,
  onToggleDisabled,
  onOpenPrompt,
}: {
  agent: AgentName;
  off: boolean;
  onClose: () => void;
  onToggleDisabled: () => void;
  onOpenPrompt: () => void;
}) {
  const meta = AGENTS[agent];
  return (
    <div
      role="dialog"
      className="absolute left-full top-0 z-40 ml-3 w-[320px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
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
            <li key={item} className="relative pl-3.5 text-[12px] leading-snug text-neutral-700">
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

      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
        <span className="font-mono text-[10px] text-neutral-400">
          prompts/{agent}.md
        </span>
        <button
          onClick={onOpenPrompt}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          View / edit prompt
        </button>
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

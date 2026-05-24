"use client";

import { useEffect, useRef, useState } from "react";
import { Critique, AGENTS, AgentName } from "@/lib/types";
import { computeConsensus, ConsensusInfo } from "@/lib/consensus";
import { critiqueId } from "./Editor";
import { Avatar } from "./Avatar";

interface Props {
  critiques: Critique[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  status: "idle" | "running" | "done" | "error";
  errorMessage: string | null;
  runningAgents: Set<AgentName>;
  resolvedIds: Set<string>;
  onToggleResolved: (id: string) => void;
  onUnresolveAll: () => void;
  onAcceptFix: (id: string) => void;
  onDownload: () => void;
}

const SEVERITY_BADGE: Record<Critique["severity"], string> = {
  high: "bg-rose-50 text-rose-800 border-rose-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-sky-50 text-sky-800 border-sky-200",
};

type RenderItem =
  | { type: "single"; critique: Critique }
  | { type: "group"; groupId: string; critiques: Critique[] };

export function CritiqueSidebar({
  critiques,
  activeId,
  onSelect,
  status,
  errorMessage,
  runningAgents,
  resolvedIds,
  onToggleResolved,
  onUnresolveAll,
  onAcceptFix,
  onDownload,
}: Props) {
  // Cycle through whichever agents are still reading so the user gets a
  // friendly "Anne is reading… now Peter is reading…" indicator instead of
  // staring at a spinner. Tick every 2 seconds.
  const [cycleTick, setCycleTick] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setCycleTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [status]);
  const runningList = Array.from(runningAgents);
  const liveAgent =
    runningList.length > 0
      ? runningList[cycleTick % runningList.length]
      : null;
  // Document order: where the critique appears in the article, top to bottom.
  const ordered = [...critiques].sort((a, b) => {
    if (a.span[0] !== b.span[0]) return a.span[0] - b.span[0];
    if (a.span[1] !== b.span[1]) return a.span[1] - b.span[1];
    return a.agent.localeCompare(b.agent);
  });

  const open = ordered.filter((c) => !resolvedIds.has(critiqueId(c)));
  const resolved = ordered.filter((c) => resolvedIds.has(critiqueId(c)));

  // Cross-agent consensus: which open critiques cluster on overlapping spans
  // with at least one other agent. Multi-agent agreement on the same passage
  // is the strongest signal a multi-persona room can produce.
  const consensus = computeConsensus(open);
  const hotspotGroups = new Set<string>();
  for (const info of consensus.values()) {
    if (info.groupId) hotspotGroups.add(info.groupId);
  }

  const counts = new Map<AgentName, number>();
  for (const c of open) counts.set(c.agent, (counts.get(c.agent) ?? 0) + 1);

  // Group open critiques for rendering: a hotspot (2+ agents on one
  // overlapping span) becomes ONE consolidated card; everything else stays
  // a normal card. `open` is already in document order, so emitting a group
  // when its first member is seen keeps everything positionally ordered.
  const renderItems: RenderItem[] = [];
  const seenGroups = new Set<string>();
  for (const c of open) {
    const gid = consensus.get(critiqueId(c))?.groupId;
    if (gid) {
      if (seenGroups.has(gid)) continue;
      seenGroups.add(gid);
      renderItems.push({
        type: "group",
        groupId: gid,
        critiques: open.filter(
          (x) => consensus.get(critiqueId(x))?.groupId === gid,
        ),
      });
    } else {
      renderItems.push({ type: "single", critique: c });
    }
  }

  return (
    <aside className="flex h-full w-[440px] flex-col border-l border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
            The Review
          </h2>
          <StatusPill
            status={status}
            count={open.length}
            error={errorMessage}
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Notes from the room, in the order they appear in the draft.
        </p>

        {/* Live status: who is currently reading. Friendlier than a spinner. */}
        {status === "running" && liveAgent && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/70 px-2.5 py-1.5">
            <Avatar agent={liveAgent} size={22} active />
            <span className="text-[11.5px] text-rose-800">
              <span className="font-semibold">{AGENTS[liveAgent].firstName}</span>{" "}
              is reading the draft
              <span className="ml-0.5 inline-block animate-pulse">…</span>
            </span>
          </div>
        )}

        {/* When the review is finished, surface the Download button. */}
        {status === "done" && critiques.length > 0 && (
          <button
            onClick={onDownload}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            title="Save the article and all notes as a PDF for your editor's file"
          >
            <DownloadGlyph />
            Download review as PDF
          </button>
        )}

        {hotspotGroups.size > 0 && (
          <div
            className="mt-2 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
            style={{
              borderColor: "#FECACA",
              backgroundColor: "#FFF1F2",
            }}
            title="A hotspot is a passage where two or more editors independently flagged the same line. The strongest editorial signal the room produces."
          >
            <span className="text-[14px]" aria-hidden>🔥</span>
            <span className="text-[11px] font-semibold text-rose-800">
              {hotspotGroups.size} hotspot{hotspotGroups.size === 1 ? "" : "s"}
            </span>
            <span className="text-[10px] text-rose-700/70">
              passages multiple editors flagged
            </span>
          </div>
        )}
        {counts.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {Array.from(counts.entries()).map(([agent, n]) => {
              const meta = AGENTS[agent];
              return (
                <span
                  key={agent}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] text-neutral-700"
                  title={`${meta.label}: ${n}`}
                >
                  <Avatar agent={agent} size={14} />
                  {n}
                </span>
              );
            })}
          </div>
        )}
        {resolved.length > 0 && (
          <div className="mt-2 flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 px-2 py-1">
            <span className="text-[11px] text-emerald-800">
              {resolved.length} resolved
            </span>
            <button
              onClick={onUnresolveAll}
              className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 hover:underline"
            >
              Show all
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 scroll-friendly overflow-auto px-5 py-4 space-y-2.5">
        {ordered.length === 0 && status === "running" && (
          <p className="text-sm text-neutral-500">Reading the draft…</p>
        )}
        {ordered.length === 0 && status === "done" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <strong>Clean read.</strong> No flags raised. The agents looked and
            had nothing to say, which is itself a valid signal.
          </div>
        )}
        {ordered.length === 0 && status === "idle" && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-stone-50 p-5 text-sm text-neutral-600">
            <div className="mb-1 font-serif text-base text-neutral-900">
              Ready when you are.
            </div>
            Paste a draft in the editor and click{" "}
            <span className="font-semibold text-rose-600">Run review</span>. The room
            will read it together and the notes will land here as they finish.
          </div>
        )}

        {open.length === 0 && resolved.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <strong>All resolved.</strong> {resolved.length}{" "}
            {resolved.length === 1 ? "item" : "items"} handled. Click{" "}
            <span className="font-medium">Show all</span> above to bring them back.
          </div>
        )}

        {renderItems.map((item) =>
          item.type === "group" ? (
            <HotspotCard
              key={item.groupId}
              critiques={item.critiques}
              activeId={activeId}
              onSelect={onSelect}
              onToggleResolved={onToggleResolved}
              onAcceptFix={onAcceptFix}
            />
          ) : (
            <CritiqueCard
              key={critiqueId(item.critique)}
              critique={item.critique}
              active={activeId === critiqueId(item.critique)}
              running={runningAgents.has(item.critique.agent)}
              consensus={consensus.get(critiqueId(item.critique))}
              onSelect={onSelect}
              onToggleResolved={onToggleResolved}
              onAcceptFix={onAcceptFix}
            />
          ),
        )}

        {resolved.length > 0 && (
          <details className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Resolved ({resolved.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {resolved.map((c) => {
                const id = critiqueId(c);
                const meta = AGENTS[c.agent];
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-600 line-through">
                      <Avatar agent={c.agent} size={16} />
                      <span className="truncate">
                        {meta.firstName} · {c.issue_label}
                      </span>
                    </div>
                    <button
                      onClick={() => onToggleResolved(id)}
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800 hover:underline"
                    >
                      Undo
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>

      <footer className="border-t border-neutral-200 px-5 py-3 space-y-1">
        <p className="text-[10.5px] leading-snug text-neutral-500">
          AI editors can be wrong. Treat every note as a question to consider,
          not an instruction to follow.
        </p>
        <p className="text-[9.5px] uppercase tracking-wider text-neutral-400">
          Ordered by article position
        </p>
      </footer>
    </aside>
  );
}


function CritiqueCard({
  critique: c,
  active,
  running,
  consensus,
  onSelect,
  onToggleResolved,
  onAcceptFix,
}: {
  critique: Critique;
  active: boolean;
  running: boolean;
  consensus: ConsensusInfo | undefined;
  onSelect: (id: string | null) => void;
  onToggleResolved: (id: string) => void;
  onAcceptFix: (id: string) => void;
}) {
  const meta = AGENTS[c.agent];
  const id = critiqueId(c);
  const isQuestioner = meta.kind === "questioner"; // Sol
  const inHotspot = !!consensus?.groupId;
  // Word-level before/after, shown only when the fix is a one-span swap.
  const diff =
    !isQuestioner && c.fix_suggestion && c.replacement
      ? diffQuote(c.text_quote, c.replacement)
      : null;
  const cardRef = useRef<HTMLElement>(null);

  // When this card becomes the active one (e.g. user clicked the highlight
  // in the editor), gently scroll it into view in the sidebar.
  useEffect(() => {
    if (!active || !cardRef.current) return;
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  return (
    <article
      ref={cardRef}
      onClick={() => onSelect(active ? null : id)}
      className={[
        "group cursor-pointer rounded-2xl border-l-4 bg-stone-50 px-3.5 py-3",
        "transition-all duration-150 ease-out will-change-transform",
        meta.borderClass,
        active
          ? "ring-2 ring-black/10 bg-white shadow-md scale-[1.01]"
          : "hover:-translate-y-[1px] hover:bg-white hover:shadow-sm",
      ].join(" ")}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar agent={c.agent} size={22} active={running} />
          <div className="leading-tight min-w-0">
            <div className="truncate text-[12px] font-semibold text-neutral-900">
              {meta.firstName}
            </div>
            <div className="text-[9.5px] uppercase tracking-wider text-neutral-500">
              {meta.shortLabel}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {inHotspot && (
            <span
              className="inline-flex items-center gap-0.5 rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700"
              title={`Hotspot: ${consensus!.agentCount} editors flagged this passage (${consensus!.agents.map((a) => AGENTS[a].firstName).join(", ")}).`}
            >
              <span aria-hidden>🔥</span> Hotspot
            </span>
          )}
          {isQuestioner ? (
            <span
              className="rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                backgroundColor: meta.highlightHex,
                borderColor: meta.brandHex,
                color: "#78350F",
              }}
            >
              Creative spark
            </span>
          ) : (
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[c.severity]}`}
            >
              {c.severity}
            </span>
          )}
        </div>
      </header>

      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
        {c.issue_label}
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-800">
        {c.question}
        {c.why_it_matters ? ` ${c.why_it_matters}` : ""}
      </p>

      {/* Sol never proposes fixes; flaggers do. */}
      {!isQuestioner && c.fix_suggestion && (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-2.5 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Suggested fix
          </div>
          <p className="text-xs leading-snug text-neutral-800">
            {c.fix_suggestion}
          </p>
          {diff && (
            <div className="mt-2 space-y-1.5">
              <DiffBubble label="Original" segments={diff.before} tone="before" />
              <DiffBubble label="Corrected" segments={diff.after} tone="after" />
            </div>
          )}
        </div>
      )}

      {!diff && (
        <p className="mt-2 truncate text-[11px] text-neutral-400">
          “{c.text_quote}”
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        {!isQuestioner && c.replacement && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAcceptFix(id);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white transition"
            style={{ backgroundColor: meta.brandHex }}
            title={`Replace the quoted text with: "${c.replacement}"`}
          >
            Accept fix
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleResolved(id);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-50"
          title={
            isQuestioner
              ? "Mark this question as considered"
              : "Mark this flag as handled"
          }
        >
          {isQuestioner ? "Considered" : "✓ Resolve"}
        </button>
      </div>
    </article>
  );
}


// Consolidated card for a hotspot: one passage that 2+ editors flagged.
// Shows the line once, then each editor's distinct note, instead of
// repeating the same passage across several near-identical cards.
function HotspotCard({
  critiques,
  activeId,
  onSelect,
  onToggleResolved,
  onAcceptFix,
}: {
  critiques: Critique[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onToggleResolved: (id: string) => void;
  onAcceptFix: (id: string) => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const ids = critiques.map((c) => critiqueId(c));
  const anyActive = activeId !== null && ids.includes(activeId);

  useEffect(() => {
    if (anyActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [anyActive]);

  const agents = Array.from(new Set(critiques.map((c) => c.agent)));
  // Representative passage: the widest quoted span in the cluster.
  const quote = critiques.reduce((a, b) =>
    b.text_quote.length > a.text_quote.length ? b : a,
  ).text_quote;

  return (
    <article
      ref={cardRef}
      className="rounded-2xl border border-rose-200 bg-rose-50/50 px-3.5 py-3"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-rose-700">
          <span aria-hidden>🔥</span>
          {agents.length} editors flagged this line
        </span>
        <div className="flex -space-x-1">
          {agents.map((a) => (
            <span key={a} className="rounded-full ring-2 ring-rose-50">
              <Avatar agent={a} size={20} />
            </span>
          ))}
        </div>
      </header>

      <p className="mb-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] italic leading-snug text-neutral-500">
        “{quote}”
      </p>

      <div>
        {critiques.map((c, idx) => {
          const id = critiqueId(c);
          const meta = AGENTS[c.agent];
          const isActive = activeId === id;
          const isQuestioner = meta.kind === "questioner";
          const diff =
            !isQuestioner && c.fix_suggestion && c.replacement
              ? diffQuote(c.text_quote, c.replacement)
              : null;
          return (
            <div
              key={id}
              onClick={() => onSelect(isActive ? null : id)}
              className={[
                "cursor-pointer rounded-lg px-2 py-2 transition",
                idx > 0 ? "mt-1 border-t border-rose-100 pt-2.5" : "",
                isActive ? "bg-white shadow-sm" : "hover:bg-white/70",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5">
                <Avatar agent={c.agent} size={18} active={isActive} />
                <span className="text-[11.5px] font-semibold text-neutral-900">
                  {meta.firstName}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-neutral-400">
                  {meta.shortLabel}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-800">
                {c.question}
                {c.why_it_matters ? ` ${c.why_it_matters}` : ""}
              </p>

              {/* Each editor's fix shown in full, same as a single card, so
                  the reader can scroll the hotspot and pick which to accept. */}
              {!isQuestioner && c.fix_suggestion && (
                <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-2.5 py-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Suggested fix
                  </div>
                  <p className="text-xs leading-snug text-neutral-800">
                    {c.fix_suggestion}
                  </p>
                  {diff && (
                    <div className="mt-2 space-y-1.5">
                      <DiffBubble
                        label="Original"
                        segments={diff.before}
                        tone="before"
                      />
                      <DiffBubble
                        label="Corrected"
                        segments={diff.after}
                        tone="after"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-1.5 flex items-center justify-end gap-2">
                {!isQuestioner && c.replacement && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcceptFix(id);
                    }}
                    className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold text-white transition"
                    style={{ backgroundColor: meta.brandHex }}
                  >
                    Accept fix
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleResolved(id);
                  }}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-neutral-600 transition hover:bg-neutral-50"
                >
                  {isQuestioner ? "Considered" : "✓ Resolve"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}


type DiffSeg = { text: string; changed: boolean };

// Word-level diff between the original quoted span and its replacement, so
// the UI can strike the words that were removed and bold the ones that are
// new. Uses a longest-common-subsequence walk over whitespace-split tokens.
function diffQuote(
  original: string,
  replacement: string,
): { before: DiffSeg[]; after: DiffSeg[] } {
  const a = original.split(/(\s+)/);
  const b = replacement.split(/(\s+)/);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const before: DiffSeg[] = [];
  const after: DiffSeg[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      before.push({ text: a[i], changed: false });
      after.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      after.push({ text: b[j], changed: true });
      j++;
    } else {
      before.push({ text: a[i], changed: true });
      i++;
    }
  }
  return { before, after };
}

function DiffBubble({
  label,
  segments,
  tone,
}: {
  label: string;
  segments: DiffSeg[];
  tone: "before" | "after";
}) {
  const isAfter = tone === "after";
  return (
    <div
      className={[
        "rounded-lg border px-2 py-1.5",
        isAfter
          ? "border-emerald-200 bg-emerald-50"
          : "border-neutral-200 bg-neutral-50",
      ].join(" ")}
    >
      <div
        className={[
          "text-[9px] font-semibold uppercase tracking-wider",
          isAfter ? "text-emerald-600" : "text-neutral-400",
        ].join(" ")}
      >
        {label}
      </div>
      <p className="mt-0.5 text-[11.5px] leading-snug">
        {segments.map((seg, idx) =>
          seg.changed ? (
            isAfter ? (
              <strong key={idx} className="font-semibold text-emerald-700">
                {seg.text}
              </strong>
            ) : (
              <span key={idx} className="text-rose-400 line-through">
                {seg.text}
              </span>
            )
          ) : (
            <span
              key={idx}
              className={isAfter ? "text-neutral-800" : "text-neutral-400"}
            >
              {seg.text}
            </span>
          ),
        )}
      </p>
    </div>
  );
}


function StatusPill({
  status,
  count,
  error,
}: {
  status: "idle" | "running" | "done" | "error";
  count: number;
  error: string | null;
}) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        Reviewing
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="text-[11px] text-neutral-500">
        {count} {count === 1 ? "note" : "notes"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
        {error ?? "Error"}
      </span>
    );
  }
  return <span className="text-[11px] text-neutral-400">Ready</span>;
}


function DownloadGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2 V11" />
      <path d="M4.5 7.5 L8 11 L11.5 7.5" />
      <path d="M3 13 V13.5 a1 1 0 0 0 1 1 H12 a1 1 0 0 0 1 -1 V13" />
    </svg>
  );
}

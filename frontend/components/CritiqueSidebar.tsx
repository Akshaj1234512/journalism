"use client";

import { Critique, AGENTS, AgentName } from "@/lib/types";
import { computeConsensus, ConsensusInfo } from "@/lib/consensus";
import { critiqueId } from "./Editor";
import { Avatar } from "./Avatar";

interface Props {
  critiques: Critique[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  status: "idle" | "running" | "done" | "error";
  totalCostUsd: number;
  errorMessage: string | null;
  runningAgents: Set<AgentName>;
  resolvedIds: Set<string>;
  onToggleResolved: (id: string) => void;
  onUnresolveAll: () => void;
  onAcceptFix: (id: string) => void;
}

const SEVERITY_BADGE: Record<Critique["severity"], string> = {
  high: "bg-rose-50 text-rose-800 border-rose-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-sky-50 text-sky-800 border-sky-200",
};

export function CritiqueSidebar({
  critiques,
  activeId,
  onSelect,
  status,
  totalCostUsd,
  errorMessage,
  runningAgents,
  resolvedIds,
  onToggleResolved,
  onUnresolveAll,
  onAcceptFix,
}: Props) {
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
            costUsd={totalCostUsd}
            error={errorMessage}
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Notes from the room, in the order they appear in the draft.
        </p>
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

        {open.map((c) => (
          <CritiqueCard
            key={critiqueId(c)}
            critique={c}
            active={activeId === critiqueId(c)}
            running={runningAgents.has(c.agent)}
            onSelect={onSelect}
            onToggleResolved={onToggleResolved}
            onAcceptFix={onAcceptFix}
          />
        ))}

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

      <footer className="border-t border-neutral-200 px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-400">
        Ordered by article position · click any note to jump to the line
      </footer>
    </aside>
  );
}


function CritiqueCard({
  critique: c,
  active,
  running,
  onSelect,
  onToggleResolved,
  onAcceptFix,
}: {
  critique: Critique;
  active: boolean;
  running: boolean;
  onSelect: (id: string | null) => void;
  onToggleResolved: (id: string) => void;
  onAcceptFix: (id: string) => void;
}) {
  const meta = AGENTS[c.agent];
  const id = critiqueId(c);
  const isQuestioner = meta.kind === "questioner"; // Sol

  return (
    <article
      onClick={() => onSelect(active ? null : id)}
      className={[
        "cursor-pointer rounded-2xl border-l-4 bg-stone-50 px-3.5 py-3 transition-colors",
        meta.borderClass,
        active ? "ring-2 ring-black/10 bg-white shadow-sm" : "hover:bg-white",
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
        {isQuestioner ? (
          <span
            className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: meta.highlightHex,
              borderColor: meta.brandHex,
              color: "#78350F",
            }}
          >
            Deep question
          </span>
        ) : (
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[c.severity]}`}
          >
            {c.severity}
          </span>
        )}
      </header>

      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
        {c.issue_label}
      </div>
      <p className="text-[13.5px] leading-snug text-neutral-900">{c.question}</p>
      <p className="mt-1.5 text-xs italic leading-snug text-neutral-500">
        {c.why_it_matters}
      </p>

      {/* Sol never proposes fixes; flaggers do. */}
      {!isQuestioner && c.fix_suggestion && (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Suggested fix
          </div>
          <p className="text-xs leading-snug text-neutral-800">
            {c.fix_suggestion}
          </p>
        </div>
      )}

      <p className="mt-2 truncate text-[11px] text-neutral-400">
        “{c.text_quote}”
      </p>

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


function StatusPill({
  status,
  count,
  costUsd,
  error,
}: {
  status: "idle" | "running" | "done" | "error";
  count: number;
  costUsd: number;
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
        {count} {count === 1 ? "item" : "items"} · ${costUsd.toFixed(4)}
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
  return <span className="text-[11px] text-neutral-400">Idle</span>;
}

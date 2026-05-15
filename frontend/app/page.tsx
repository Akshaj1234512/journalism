"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentRoster } from "@/components/AgentRoster";
import { CritiqueSidebar } from "@/components/CritiqueSidebar";
import { Editor, critiqueId } from "@/components/Editor";
import { PromptEditor } from "@/components/PromptEditor";
import { ReviewModeSelector } from "@/components/ReviewModeSelector";
import { streamCritique } from "@/lib/stream";
import {
  AgentName,
  Critique,
  ReviewMode,
  REVIEW_MODES,
  ALL_AGENT_NAMES,
} from "@/lib/types";

const SAMPLE_DRAFT =
  "City councilman Mark Reyes stole more than $400,000 from a youth sports nonprofit he chaired, " +
  "according to a former board member who spoke on condition of anonymity. " +
  "Reyes did not respond to a request for comment.";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const COST_KEY = "redroom:session-cost";
const DISABLED_KEY = "redroom:disabled-agents";
const MODE_KEY = "redroom:review-mode";

export default function Page() {
  const [article, setArticle] = useState(SAMPLE_DRAFT);
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [lastRunCostUsd, setLastRunCostUsd] = useState(0);
  const [sessionCostUsd, setSessionCostUsd] = useState(0);
  const [runCount, setRunCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runningAgents, setRunningAgents] = useState<Set<AgentName>>(new Set());
  const [doneAgents, setDoneAgents] = useState<Set<AgentName>>(new Set());
  const [disabledAgents, setDisabledAgents] = useState<Set<AgentName>>(new Set());
  const [reviewMode, setReviewMode] = useState<ReviewMode>("standard");
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptEditorAgent, setPromptEditorAgent] = useState<AgentName | undefined>(undefined);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate session totals and disabled agents from localStorage on mount.
  useEffect(() => {
    try {
      const cRaw = localStorage.getItem(COST_KEY);
      if (cRaw) {
        const { cost, runs } = JSON.parse(cRaw);
        if (typeof cost === "number") setSessionCostUsd(cost);
        if (typeof runs === "number") setRunCount(runs);
      }
    } catch {}
    try {
      const dRaw = localStorage.getItem(DISABLED_KEY);
      if (dRaw) {
        const arr = JSON.parse(dRaw);
        if (Array.isArray(arr)) setDisabledAgents(new Set(arr as AgentName[]));
      }
    } catch {}
    try {
      const mRaw = localStorage.getItem(MODE_KEY) as ReviewMode | null;
      if (mRaw && REVIEW_MODES.some((m) => m.id === mRaw)) {
        setReviewMode(mRaw);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        COST_KEY,
        JSON.stringify({ cost: sessionCostUsd, runs: runCount }),
      );
    } catch {}
  }, [sessionCostUsd, runCount]);

  useEffect(() => {
    try {
      localStorage.setItem(DISABLED_KEY, JSON.stringify(Array.from(disabledAgents)));
    } catch {}
  }, [disabledAgents]);

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, reviewMode); } catch {}
  }, [reviewMode]);

  // Switching to a non-custom mode rewrites the disabled set from the preset.
  // Manual toggles in the rail then flip mode to "custom" automatically.
  const onSelectMode = useCallback((mode: ReviewMode) => {
    setReviewMode(mode);
    if (mode === "custom") return;
    const preset = REVIEW_MODES.find((m) => m.id === mode);
    if (!preset) return;
    const enabled = new Set(preset.agents);
    const nextDisabled = new Set<AgentName>(
      ALL_AGENT_NAMES.filter((n) => !enabled.has(n)),
    );
    setDisabledAgents(nextDisabled);
  }, []);

  const onResetSession = useCallback(() => {
    if (!confirm("Reset session cost counter to $0?")) return;
    setSessionCostUsd(0);
    setRunCount(0);
    setLastRunCostUsd(0);
  }, []);

  const onToggleDisabled = useCallback((agent: AgentName) => {
    setDisabledAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });
    // Hand-editing the roster moves us into custom mode so the segmented
    // control reflects that the preset is no longer in effect.
    setReviewMode("custom");
  }, []);

  const onRun = useCallback(() => {
    abortRef.current?.abort();
    setCritiques([]);
    setActiveId(null);
    setLastRunCostUsd(0);
    setErrorMessage(null);
    setRunningAgents(new Set());
    setDoneAgents(new Set());
    setResolvedIds(new Set());
    setStatus("running");

    abortRef.current = streamCritique(
      BACKEND_URL,
      article,
      {
        onAgentStart: (agent) =>
          setRunningAgents((prev) => new Set(prev).add(agent as AgentName)),
        onCritique: (c) =>
          setCritiques((prev) => [...prev, { ...c, _id: crypto.randomUUID() }]),
        onAgentDone: (agent) => {
          setRunningAgents((prev) => {
            const next = new Set(prev);
            next.delete(agent as AgentName);
            return next;
          });
          setDoneAgents((prev) => new Set(prev).add(agent as AgentName));
        },
        onDone: (cost) => {
          setLastRunCostUsd(cost);
          setSessionCostUsd((prev) => prev + cost);
          setRunCount((n) => n + 1);
          setStatus("done");
        },
        onError: (msg) => {
          setErrorMessage(msg);
          setStatus("error");
        },
      },
      Array.from(disabledAgents),
    );
  }, [article, disabledAgents]);

  const onSelectCritique = useCallback(
    (id: string | null) => {
      setActiveId(id);
      if (!id) return;
      const c = critiques.find((c) => critiqueId(c) === id);
      const ta = editorRef.current;
      if (!c || !ta) return;
      ta.setSelectionRange(c.span[0], c.span[1]);
    },
    [critiques],
  );

  const onToggleResolved = useCallback((id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const onUnresolveAll = useCallback(() => {
    setResolvedIds(new Set());
  }, []);

  const onAcceptFix = useCallback(
    (id: string) => {
      const c = critiques.find((x) => critiqueId(x) === id);
      if (!c || !c.replacement) return;
      const [s, e] = c.span;
      const newArticle = article.slice(0, s) + c.replacement + article.slice(e);

      const stale = new Set<string>([id]);
      const updated = critiques.map((x) => {
        if (critiqueId(x) === id) return x;
        const idx = newArticle.indexOf(x.text_quote);
        if (idx === -1) {
          stale.add(critiqueId(x));
          return x;
        }
        return {
          ...x,
          span: [idx, idx + x.text_quote.length] as [number, number],
        };
      });

      setArticle(newArticle);
      setCritiques(updated);
      setResolvedIds((prev) => new Set([...prev, ...stale]));
      setActiveId((cur) => (cur && stale.has(cur) ? null : cur));
    },
    [critiques, article],
  );

  const enabledCount = 6 - disabledAgents.size;

  return (
    <main className="flex h-screen w-screen flex-col bg-stone-50">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              background: "linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)",
            }}
            aria-hidden
          >
            <span className="font-serif text-lg italic font-bold">R</span>
          </div>
          <div className="leading-tight">
            <h1 className="font-serif text-[17px] tracking-tight text-neutral-900">
              The Red Room
            </h1>
            <p className="text-[11px] text-neutral-500">
              A pre-publication review by an independent room of AI editors.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ReviewModeSelector mode={reviewMode} onChange={onSelectMode} />
          <span className="hidden lg:inline text-[10px] uppercase tracking-wider text-neutral-400">
            {enabledCount} of 6 editors on
          </span>
          <CostMeter
            lastRunUsd={lastRunCostUsd}
            sessionUsd={sessionCostUsd}
            runCount={runCount}
            onReset={onResetSession}
          />
          <button
            onClick={() => {
              setPromptEditorAgent(undefined);
              setPromptEditorOpen(true);
            }}
            className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            title="View and edit each agent's system prompt"
          >
            Edit prompts
          </button>
          <button
            onClick={onRun}
            disabled={status === "running" || article.trim().length === 0 || enabledCount === 0}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {status === "running" ? "Reviewing…" : "Run review"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left rail: vertical agent picker with on/off + popover */}
        <AgentRoster
          runningAgents={runningAgents}
          doneAgents={doneAgents}
          disabledAgents={disabledAgents}
          onToggleDisabled={onToggleDisabled}
          onOpenPrompt={(agent) => {
            setPromptEditorAgent(agent);
            setPromptEditorOpen(true);
          }}
        />

        {/* Centre: editor surface inside a softly rounded card */}
        <div className="flex flex-1 items-stretch p-4">
          <div className="flex flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <Editor
              ref={editorRef}
              value={article}
              onChange={setArticle}
              critiques={critiques}
              activeId={activeId}
              resolvedIds={resolvedIds}
            />
          </div>
        </div>

        {/* Right: critiques */}
        <CritiqueSidebar
          critiques={critiques}
          activeId={activeId}
          onSelect={onSelectCritique}
          status={status}
          totalCostUsd={lastRunCostUsd}
          errorMessage={errorMessage}
          runningAgents={runningAgents}
          resolvedIds={resolvedIds}
          onToggleResolved={onToggleResolved}
          onUnresolveAll={onUnresolveAll}
          onAcceptFix={onAcceptFix}
        />
      </div>

      <PromptEditor
        open={promptEditorOpen}
        onClose={() => setPromptEditorOpen(false)}
        backendUrl={BACKEND_URL}
        initialAgent={promptEditorAgent}
      />
    </main>
  );
}


function CostMeter({
  lastRunUsd,
  sessionUsd,
  runCount,
  onReset,
}: {
  lastRunUsd: number;
  sessionUsd: number;
  runCount: number;
  onReset: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5"
      title="Anthropic API cost (estimated). Persists across reloads in this browser."
    >
      <div className="flex flex-col text-right leading-tight">
        <span className="text-[9px] uppercase tracking-wider text-neutral-400">
          Session cost · {runCount} {runCount === 1 ? "run" : "runs"}
        </span>
        <span className="font-mono text-sm font-semibold text-neutral-900">
          ${sessionUsd.toFixed(4)}
        </span>
        {lastRunUsd > 0 && (
          <span className="text-[10px] text-neutral-500">
            last run ${lastRunUsd.toFixed(4)}
          </span>
        )}
      </div>
      <button
        onClick={onReset}
        title="Reset session counter"
        className="rounded-md text-neutral-400 transition hover:text-neutral-700"
      >
        <span className="text-base leading-none">↺</span>
      </button>
    </div>
  );
}

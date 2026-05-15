"use client";

import { useEffect, useState } from "react";
import { AGENTS, AgentName } from "@/lib/types";
import { Avatar } from "./Avatar";

interface Props {
  open: boolean;
  onClose: () => void;
  backendUrl: string;
  /** Pre-select this agent when the modal opens. */
  initialAgent?: AgentName;
}

const AGENT_ORDER: AgentName[] = [
  "legal_skeptic",
  "data_expert",
  "human_rights",
  "clarity",
  "partisan",
  "question_master",
];

/**
 * Dev panel: pick an agent → fetch its prompt from the backend → edit the
 * markdown → save back. The agent re-reads from disk on every critique
 * call, so changes apply on the next "Run review."
 */
export function PromptEditor({ open, onClose, backendUrl, initialAgent }: Props) {
  const [active, setActive] = useState<AgentName>(initialAgent ?? "legal_skeptic");

  // If the parent passes a different initialAgent while the modal is opening,
  // reflect it. We only sync on `open` rising or initialAgent changing — not
  // on every render — so the user's nav clicks inside the modal are preserved.
  useEffect(() => {
    if (open && initialAgent) setActive(initialAgent);
  }, [open, initialAgent]);
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Load the prompt when the modal opens or the active agent changes.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSavedAt(null);
    setLoading(true);
    fetch(`${backendUrl}/agents/${active}/prompt`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`backend returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setText(data.text);
        setDirty(false);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, active, backendUrl]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${backendUrl}/agents/${active}/prompt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`backend returned ${r.status}`);
      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const meta = AGENTS[active];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-neutral-900">
              Edit agent prompts
            </h2>
            <p className="text-[11px] text-neutral-500">
              Changes save to <span className="font-mono">backend/src/red_room/prompts/</span> and
              apply on the next Run review — no server restart.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-48 shrink-0 border-r border-neutral-200 bg-neutral-50 p-3 space-y-1">
            {AGENT_ORDER.map((name) => {
              const m = AGENTS[name];
              const isActive = name === active;
              return (
                <button
                  key={name}
                  onClick={() => {
                    if (dirty && !confirm("Unsaved changes will be lost. Continue?")) return;
                    setActive(name);
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition",
                    isActive ? "bg-white shadow-sm ring-1 ring-neutral-200" : "hover:bg-white",
                  ].join(" ")}
                >
                  <Avatar agent={name} size={24} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[12px] font-semibold text-neutral-900">{m.firstName}</span>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {m.shortLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-2.5">
              <div className="flex items-center gap-2">
                <Avatar agent={active} size={28} />
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold text-neutral-900">{meta.firstName}</div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                    {meta.shortLabel} · prompts/{active}.md
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {savedAt && !dirty && (
                  <span className="text-[11px] text-emerald-600">
                    saved · agent picks it up next run
                  </span>
                )}
                {dirty && <span className="text-[11px] text-amber-600">unsaved changes</span>}
                {error && <span className="text-[11px] text-rose-600">{error}</span>}
                <button
                  disabled={saving || loading || !dirty}
                  onClick={onSave}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <textarea
              value={loading ? "Loading prompt…" : text}
              onChange={(e) => {
                setText(e.target.value);
                setDirty(true);
              }}
              disabled={loading}
              spellCheck={false}
              className="flex-1 resize-none bg-white p-5 font-mono text-[12.5px] leading-relaxed text-neutral-800 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

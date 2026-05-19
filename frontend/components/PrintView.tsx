"use client";

import { Critique, AGENTS } from "@/lib/types";

interface Props {
  article: string;
  critiques: Critique[];
  resolvedIds: Set<string>;
  /** Stable id helper, passed in to keep this component dependency-light. */
  idOf: (c: Critique) => string;
}

/**
 * A clean, paper-friendly view of the article and all open critiques.
 *
 * Hidden on screen via CSS (.red-room-print); visible during window.print().
 * The browser's print dialog lets the user save as PDF, so we get free PDF
 * export with no extra library. Highlights are rendered inline as colored
 * spans so they survive the print path.
 */
export function PrintView({ article, critiques, resolvedIds, idOf }: Props) {
  const open = critiques.filter((c) => !resolvedIds.has(idOf(c)));

  // Render article with inline highlights as <span> elements.
  const rendered = renderArticleWithHighlights(article, open);

  const generated = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  const byAgent = groupByAgent(open);

  return (
    <div className="red-room-print">
      <header className="rr-print-header">
        <div className="rr-print-eyebrow">Pre-publication review</div>
        <h1 className="rr-print-title">
          The <em>Red Room</em>
        </h1>
        <div className="rr-print-meta">
          Generated {generated} · {open.length} note{open.length === 1 ? "" : "s"}
        </div>
      </header>

      <section className="rr-print-article">
        <h2>Draft</h2>
        <div className="rr-print-body">{rendered}</div>
      </section>

      <section className="rr-print-notes">
        <h2>Notes from the room</h2>
        {open.length === 0 ? (
          <p className="rr-print-empty">No open notes.</p>
        ) : (
          byAgent.map(({ agent, items }) => {
            const meta = AGENTS[agent];
            return (
              <div key={agent} className="rr-print-group">
                <h3 style={{ color: meta.brandHex }}>
                  {meta.firstName} &middot; {meta.shortLabel} ({items.length})
                </h3>
                {items.map((c) => (
                  <article key={idOf(c)} className="rr-print-note">
                    <div className="rr-print-note-head">
                      <span className="rr-print-issue">{c.issue_label}</span>
                      <span className={`rr-print-sev rr-print-sev-${c.severity}`}>
                        {c.severity}
                      </span>
                    </div>
                    <blockquote>&ldquo;{c.text_quote}&rdquo;</blockquote>
                    <p className="rr-print-q"><strong>{meta.firstName}:</strong> {c.question}</p>
                    <p className="rr-print-w">{c.why_it_matters}</p>
                    {c.fix_suggestion && (
                      <p className="rr-print-fix">
                        <strong>Suggested fix.</strong> {c.fix_suggestion}
                      </p>
                    )}
                    {c.replacement && (
                      <p className="rr-print-rep">
                        <strong>One-click rewrite:</strong> &ldquo;{c.replacement}&rdquo;
                      </p>
                    )}
                  </article>
                ))}
              </div>
            );
          })
        )}
      </section>

      <footer className="rr-print-footer">
        AI editors can be wrong. They are grounded in real press-regulator rulings
        and editorial standards, but every note is a question to consider, not an
        instruction to follow. Treat this review as one editor among many.
      </footer>
    </div>
  );
}


function renderArticleWithHighlights(text: string, critiques: Critique[]) {
  if (critiques.length === 0) return text;
  const sorted = [...critiques].sort((a, b) => a.span[0] - b.span[0]);
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
    const [s, e] = c.span;
    if (s > i) out.push(text.slice(i, s));
    const meta = AGENTS[c.agent];
    out.push(
      <span
        key={`${s}-${e}-${c.agent}`}
        style={{
          backgroundColor: meta.highlightHex,
          borderBottom: `2px solid ${meta.brandHex}`,
          padding: "0 1px",
        }}
      >
        {text.slice(s, e)}
      </span>,
    );
    i = e;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}


function groupByAgent(critiques: Critique[]) {
  const map = new Map<Critique["agent"], Critique[]>();
  for (const c of critiques) {
    const arr = map.get(c.agent) ?? [];
    arr.push(c);
    map.set(c.agent, arr);
  }
  return Array.from(map.entries()).map(([agent, items]) => ({ agent, items }));
}

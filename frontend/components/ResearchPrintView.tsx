"use client";

import { useEffect, useState } from "react";
import { Critique, AGENTS } from "@/lib/types";

interface Props {
  pdf: File | null;
  critiques: Critique[];
  resolvedIds: Set<string>;
  idOf: (c: Critique) => string;
  sectionLabel: string;
  subjectLabel: string;
  venue: string;
}

interface RenderedPage {
  pageNumber: number;
  imageDataUrl: string;
  textContent: string;
  /** rendered pixel size — used to set aspect ratio on the printed image */
  width: number;
  height: number;
}

/**
 * Print view for research mode. Renders each PDF page as an image on the
 * left and shows the critiques anchored to that page in the right column.
 *
 * Anchoring is heuristic: we full-text-search each critique's `text_quote`
 * against each page's extracted text and assign the critique to the first
 * page where the quote appears. Critiques that don't match any page (e.g.
 * a critique about an architecture diagram quoting a caption that PDF.js
 * couldn't extract cleanly) are listed in an "Unanchored notes" section
 * at the end.
 *
 * The component renders all PDF pages on mount (cheap for typical
 * 5-15-page papers; debounced by useEffect on the file reference). Until
 * rendering finishes it shows a "Preparing PDF..." placeholder, which is
 * also what prints if the user fires print() too early.
 */
export function ResearchPrintView({
  pdf,
  critiques,
  resolvedIds,
  idOf,
  sectionLabel,
  subjectLabel,
  venue,
}: Props) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!pdf) {
      setPages([]);
      setProgress(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setProgress({ done: 0, total: 0 });

    (async () => {
      try {
        const buf = await pdf.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        // Serve the worker from /public so we don't depend on a CDN.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const total = doc.numPages;
        setProgress({ done: 0, total });

        const results: RenderedPage[] = [];
        for (let i = 1; i <= total; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          // 1.5x is a good balance: crisp on a 150dpi print, ~150-250kb / page
          // as JPEG at 0.82 quality. Bumping higher inflates the data URL fast.
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not get 2D canvas context.");
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

          let textContent = "";
          try {
            const tc = await page.getTextContent();
            textContent = tc.items
              .map((it) => ("str" in it ? (it as { str: string }).str : ""))
              .join(" ");
          } catch {
            // Some PDFs (scanned / image-only) have no extractable text.
            // Leave textContent empty — critiques will fall through to the
            // unanchored bucket at the end.
          }

          results.push({
            pageNumber: i,
            imageDataUrl: dataUrl,
            textContent,
            width: viewport.width,
            height: viewport.height,
          });
          if (!cancelled) setProgress({ done: i, total });
        }
        if (!cancelled) {
          setPages(results);
          setProgress(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || "Could not render the PDF for print.");
          setProgress(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf]);

  const open = critiques.filter((c) => !resolvedIds.has(idOf(c)));
  const { byPage, unanchored } = anchorCritiquesToPages(open, pages);

  const generated = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="red-room-print red-room-print-research">
      <header className="rr-print-header">
        <div className="rr-print-eyebrow">Pre-publication review · Research</div>
        <h1 className="rr-print-title">
          The <em>Red Room</em>
        </h1>
        <div className="rr-print-meta">
          {pdf?.name ?? "Research paper"}
          {" · "}
          reviewing <strong>{sectionLabel}</strong> against{" "}
          <strong>{subjectLabel}</strong> conventions
          {venue ? <> for <strong>{venue}</strong></> : null}
          {" · "}
          Generated {generated} · {open.length} note{open.length === 1 ? "" : "s"}
        </div>
      </header>

      {error && (
        <section className="rr-print-research-error">
          <p>
            <strong>Could not render the PDF for printing:</strong> {error}
          </p>
          <p>
            The review notes below are still complete. The PDF itself is
            available on the original file you uploaded.
          </p>
        </section>
      )}

      {!error && progress && progress.total > 0 && (
        <section className="rr-print-research-loading">
          <p>
            Preparing PDF for print: page {progress.done} of {progress.total}.
          </p>
        </section>
      )}

      {pages.map((page) => {
        const critiquesForPage = byPage.get(page.pageNumber) ?? [];
        return (
          <section
            key={page.pageNumber}
            className="rr-research-page"
          >
            <div className="rr-research-page-image">
              <img
                src={page.imageDataUrl}
                alt={`Page ${page.pageNumber}`}
                style={{ width: "100%", height: "auto" }}
              />
              <div className="rr-research-page-label">
                Page {page.pageNumber}
              </div>
            </div>
            <div className="rr-research-page-notes">
              <h3>
                Notes on page {page.pageNumber}
                {critiquesForPage.length > 0 ? ` (${critiquesForPage.length})` : ""}
              </h3>
              {critiquesForPage.length === 0 ? (
                <p className="rr-research-no-notes">
                  No notes anchored to this page.
                </p>
              ) : (
                critiquesForPage.map((c) => (
                  <CritiqueCardForPrint
                    key={idOf(c)}
                    critique={c}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}

      {unanchored.length > 0 && (
        <section className="rr-research-unanchored">
          <h2>Additional notes</h2>
          <p className="rr-research-unanchored-blurb">
            These notes reference text the print renderer could not locate
            on a specific page (often a figure caption, an equation, or
            content in a scanned-image region of the PDF). Search the PDF
            for the quoted text to locate the passage.
          </p>
          {unanchored.map((c) => (
            <CritiqueCardForPrint key={idOf(c)} critique={c} />
          ))}
        </section>
      )}

      <footer className="rr-print-footer">
        AI editors can be wrong. They are grounded in real ICML / NeurIPS /
        ICLR reviewer-feedback patterns, but every note is a question to
        consider, not an instruction to follow. Treat this review as one
        reviewer among many.
      </footer>
    </div>
  );
}

function CritiqueCardForPrint({ critique: c }: { critique: Critique }) {
  const meta = AGENTS[c.agent];
  return (
    <article className="rr-print-note" style={{ borderLeftColor: meta.brandHex }}>
      <div className="rr-print-note-head">
        <span className="rr-print-issue" style={{ color: meta.brandHex }}>
          {meta.firstName} · {c.issue_label}
        </span>
        <span className={`rr-print-sev rr-print-sev-${c.severity}`}>
          {c.severity}
        </span>
      </div>
      <blockquote>&ldquo;{c.text_quote}&rdquo;</blockquote>
      <p className="rr-print-q">
        <strong>{meta.firstName}:</strong> {c.question}
      </p>
      <p className="rr-print-w">{c.why_it_matters}</p>
      {c.fix_suggestion && (
        <p className="rr-print-fix">
          <strong>Suggested fix.</strong> {c.fix_suggestion}
        </p>
      )}
    </article>
  );
}

/**
 * For each open critique, find the first page whose extracted text
 * contains the critique's `text_quote`. Returns the page→critiques map
 * plus the leftover critiques that didn't match any page.
 *
 * The match is intentionally lenient — we strip whitespace runs to a
 * single space on both sides before comparison because PDF.js extraction
 * inserts whitespace inconsistently across word boundaries (often a space
 * between glyph clusters that ought to be tight). Without normalization,
 * exact-substring matching misses ~half of legitimate quotes.
 */
function anchorCritiquesToPages(
  critiques: Critique[],
  pages: RenderedPage[],
): { byPage: Map<number, Critique[]>; unanchored: Critique[] } {
  const byPage = new Map<number, Critique[]>();
  const unanchored: Critique[] = [];

  if (pages.length === 0) {
    return { byPage, unanchored: critiques };
  }

  const normalized = pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.textContent.replace(/\s+/g, " ").toLowerCase(),
  }));

  for (const c of critiques) {
    const needle = c.text_quote.replace(/\s+/g, " ").toLowerCase().trim();
    if (!needle) {
      unanchored.push(c);
      continue;
    }
    // Try the full quote first; if it doesn't match, try a "lead fragment"
    // (first ~60 chars). Long quotes often span a line break that gets
    // mangled, but the lead is usually intact.
    let matched: number | null = null;
    for (const p of normalized) {
      if (p.text.includes(needle)) {
        matched = p.pageNumber;
        break;
      }
    }
    if (matched === null && needle.length > 60) {
      const lead = needle.slice(0, 60);
      for (const p of normalized) {
        if (p.text.includes(lead)) {
          matched = p.pageNumber;
          break;
        }
      }
    }
    if (matched === null) {
      unanchored.push(c);
    } else {
      const arr = byPage.get(matched) ?? [];
      arr.push(c);
      byPage.set(matched, arr);
    }
  }

  return { byPage, unanchored };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/AccountMenu";
import { AgentRoster } from "@/components/AgentRoster";
import { Avatar } from "@/components/Avatar";
import { CritiqueSidebar } from "@/components/CritiqueSidebar";
import { Editor, critiqueId } from "@/components/Editor";
import { PrintView } from "@/components/PrintView";
import { ResearchPrintView } from "@/components/ResearchPrintView";
import { SampleDraftsButton } from "@/components/SampleDrafts";
import { Tutorial } from "@/components/Tutorial";
import { streamCritique } from "@/lib/stream";
import { PLANS, countWords } from "@/lib/plans";
import { streamResearchCritique } from "@/lib/stream";
import {
  AGENTS,
  AgentName,
  ARTICLE_TYPE_CHOICES,
  ArticleType,
  CitationStyle,
  Critique,
  ESSAY_TYPE_CHOICES,
  EssayType,
  JournalismToggles,
  MODE_AGENTS,
  Mode,
  RESEARCH_SECTION_CHOICES,
  RESEARCH_SUBJECT_CHOICES,
  ResearchSection,
  ResearchSubject,
  defaultTogglesFor,
  getEssaysRoster,
  getJournalismRoster,
  getResearchRoster,
} from "@/lib/types";
import { extractTextFromFile } from "@/lib/upload";

const SAMPLE_DRAFT =
  "City councilman Mark Reyes stole more than $400,000 from a youth sports nonprofit he chaired, " +
  "according to a former board member who spoke on condition of anonymity. " +
  "Reyes did not respond to a request for comment.";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const DISABLED_KEY = "redroom:disabled-agents";
const ARTICLE_KEY = "redroom:article";
const TUTORIAL_SEEN_KEY = "redroom:tutorial-seen";
const MODE_KEY = "redroom:mode";
const CITATION_KEY = "redroom:citation-style";
const ESSAY_TYPE_KEY = "redroom:essay-type";
const ESSAY_PROMPT_KEY = "redroom:essay-prompt";
const RESEARCH_SECTION_KEY = "redroom:research-section";
const RESEARCH_SUBJECT_KEY = "redroom:research-subject";
const RESEARCH_VENUE_KEY = "redroom:research-venue";
const ARTICLE_TYPE_KEY = "redroom:article-type";
const JOURNALISM_TOGGLES_KEY = "redroom:journalism-toggles";
const SUBJECT_CONTEXT_KEY = "redroom:subject-context";

export default function Page() {
  const [article, setArticle] = useState(SAMPLE_DRAFT);
  const [mode, setMode] = useState<Mode>("journalism");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("none");
  const [essayType, setEssayType] = useState<EssayType>("none");
  const [essayPrompt, setEssayPrompt] = useState<string>("");
  // Research-mode state. The PDF stays in memory only; section / subject /
  // venue persist in localStorage so the writer doesn't reset their setup
  // when they reload.
  // Journalism-mode state: article type, three toggles, and an optional
  // subject-context box. Type drives which type-specialist runs; toggles
  // independently add Parker / Peter / Joe.
  const [articleType, setArticleType] = useState<ArticleType>("none");
  const [journalismToggles, setJournalismToggles] = useState<JournalismToggles>({
    partisan: false,
    hasDataClaims: false,
    hasAnonymousSources: false,
  });
  const [subjectContext, setSubjectContext] = useState<string>("");
  const [researchPdf, setResearchPdf] = useState<File | null>(null);
  const [researchSection, setResearchSection] = useState<ResearchSection>("full_paper");
  const [researchSubject, setResearchSubject] = useState<ResearchSubject>("cs_ml");
  const [researchVenue, setResearchVenue] = useState<string>("");
  const researchFileInputRef = useRef<HTMLInputElement>(null);
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runningAgents, setRunningAgents] = useState<Set<AgentName>>(new Set());
  const [doneAgents, setDoneAgents] = useState<Set<AgentName>>(new Set());
  const [disabledAgents, setDisabledAgents] = useState<Set<AgentName>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<{ name: string; bytes: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Track nested dragenter/dragleave on child elements so the overlay does
  // not flicker as the cursor crosses between the textarea and its wrapper.
  const dragDepthRef = useRef(0);

  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Restore on mount: agent roster, draft article, mode, and whether the
  // user has seen the tour. Tutorial auto-opens for first-time visitors.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISABLED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setDisabledAgents(new Set(arr as AgentName[]));
      }
    } catch {}
    try {
      const saved = localStorage.getItem(ARTICLE_KEY);
      if (saved && saved.trim()) setArticle(saved);
    } catch {}
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "essays" || m === "journalism" || m === "research") setMode(m);
    } catch {}
    try {
      const rs = localStorage.getItem(RESEARCH_SECTION_KEY);
      const valid: ResearchSection[] = [
        "abstract", "introduction", "related_work", "methods",
        "results", "discussion", "conclusion", "full_paper",
      ];
      if (rs && valid.includes(rs as ResearchSection)) {
        setResearchSection(rs as ResearchSection);
      }
    } catch {}
    try {
      const rsubj = localStorage.getItem(RESEARCH_SUBJECT_KEY);
      const valid: ResearchSubject[] = ["cs_ml", "engineering", "biology", "medicine", "none"];
      if (rsubj && valid.includes(rsubj as ResearchSubject)) {
        setResearchSubject(rsubj as ResearchSubject);
      }
    } catch {}
    try {
      const rv = localStorage.getItem(RESEARCH_VENUE_KEY);
      if (rv) setResearchVenue(rv);
    } catch {}
    try {
      const cs = localStorage.getItem(CITATION_KEY);
      if (cs && ["mla", "apa", "chicago", "turabian", "none"].includes(cs)) {
        setCitationStyle(cs as CitationStyle);
      }
    } catch {}
    try {
      const et = localStorage.getItem(ESSAY_TYPE_KEY);
      if (
        et &&
        ["argumentative", "analytical", "narrative", "research", "rhetorical", "none"].includes(et)
      ) {
        setEssayType(et as EssayType);
      }
    } catch {}
    try {
      const ep = localStorage.getItem(ESSAY_PROMPT_KEY);
      if (ep) setEssayPrompt(ep);
    } catch {}
    try {
      const at = localStorage.getItem(ARTICLE_TYPE_KEY);
      if (
        at &&
        ["news", "investigative", "opinion", "feature", "profile", "review", "analysis", "none"].includes(at)
      ) {
        setArticleType(at as ArticleType);
      }
    } catch {}
    try {
      const raw = localStorage.getItem(JOURNALISM_TOGGLES_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") {
          setJournalismToggles({
            partisan: !!obj.partisan,
            hasDataClaims: !!obj.hasDataClaims,
            hasAnonymousSources: !!obj.hasAnonymousSources,
          });
        }
      }
    } catch {}
    try {
      const sc = localStorage.getItem(SUBJECT_CONTEXT_KEY);
      if (sc) setSubjectContext(sc);
    } catch {}
    try {
      const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
      if (!seen) setTutorialOpen(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch {}
  }, [mode]);

  useEffect(() => {
    try { localStorage.setItem(CITATION_KEY, citationStyle); } catch {}
  }, [citationStyle]);

  useEffect(() => {
    try { localStorage.setItem(ESSAY_TYPE_KEY, essayType); } catch {}
  }, [essayType]);

  useEffect(() => {
    try { localStorage.setItem(ESSAY_PROMPT_KEY, essayPrompt); } catch {}
  }, [essayPrompt]);

  useEffect(() => {
    try { localStorage.setItem(ARTICLE_TYPE_KEY, articleType); } catch {}
  }, [articleType]);

  useEffect(() => {
    try { localStorage.setItem(JOURNALISM_TOGGLES_KEY, JSON.stringify(journalismToggles)); } catch {}
  }, [journalismToggles]);

  useEffect(() => {
    try { localStorage.setItem(SUBJECT_CONTEXT_KEY, subjectContext); } catch {}
  }, [subjectContext]);

  useEffect(() => {
    try { localStorage.setItem(RESEARCH_SECTION_KEY, researchSection); } catch {}
  }, [researchSection]);

  useEffect(() => {
    try { localStorage.setItem(RESEARCH_SUBJECT_KEY, researchSubject); } catch {}
  }, [researchSubject]);

  useEffect(() => {
    try { localStorage.setItem(RESEARCH_VENUE_KEY, researchVenue); } catch {}
  }, [researchVenue]);

  useEffect(() => {
    try {
      localStorage.setItem(DISABLED_KEY, JSON.stringify(Array.from(disabledAgents)));
    } catch {}
  }, [disabledAgents]);

  // Save the article on every change (small enough that we do not bother
  // debouncing). Skip the very first identical value to avoid wiping a
  // hydrated value with the SAMPLE_DRAFT default before the load effect runs.
  useEffect(() => {
    try { localStorage.setItem(ARTICLE_KEY, article); } catch {}
  }, [article]);

  const onCompleteTutorial = useCallback(() => {
    setTutorialOpen(false);
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, "1"); } catch {}
  }, []);

  const onToggleDisabled = useCallback((agent: AgentName) => {
    setDisabledAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });
  }, []);

  const onRun = useCallback(() => {
    abortRef.current?.abort();
    setCritiques([]);
    setActiveId(null);
    setErrorMessage(null);
    setRunningAgents(new Set());
    setDoneAgents(new Set());
    setResolvedIds(new Set());
    setStatus("running");

    // Shared stream handlers (same for all modes).
    const handlers = {
      onAgentStart: (agent: string) =>
        setRunningAgents((prev) => new Set(prev).add(agent as AgentName)),
      onCritique: (c: Critique) =>
        setCritiques((prev) => [...prev, { ...c, _id: crypto.randomUUID() }]),
      onAgentDone: (agent: string) => {
        setRunningAgents((prev) => {
          const next = new Set(prev);
          next.delete(agent as AgentName);
          return next;
        });
        setDoneAgents((prev) => new Set(prev).add(agent as AgentName));
      },
      onDone: () => setStatus("done"),
      onError: (msg: string) => {
        setErrorMessage(msg);
        setStatus("error");
      },
    };

    if (mode === "research") {
      if (!researchPdf) {
        setErrorMessage("Upload a PDF before running the review.");
        setStatus("error");
        return;
      }
      abortRef.current = streamResearchCritique(
        BACKEND_URL,
        researchPdf,
        handlers,
        {
          disabledAgents: Array.from(disabledAgents),
          section: researchSection,
          subject: researchSubject,
          venue: researchVenue.trim(),
        },
      );
      return;
    }

    abortRef.current = streamCritique(
      BACKEND_URL,
      article,
      handlers,
      {
        disabledAgents: Array.from(disabledAgents),
        mode,
        citationStyle,
        essayType,
        essayPrompt: essayPrompt.trim(),
        articleType,
        partisan: journalismToggles.partisan,
        hasDataClaims: journalismToggles.hasDataClaims,
        hasAnonymousSources: journalismToggles.hasAnonymousSources,
        subjectContext: subjectContext.trim(),
      },
    );
  }, [
    article,
    disabledAgents,
    mode,
    citationStyle,
    essayType,
    essayPrompt,
    researchPdf,
    researchSection,
    researchSubject,
    researchVenue,
    articleType,
    journalismToggles,
    subjectContext,
  ]);

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

  const onUnresolveAll = useCallback(() => setResolvedIds(new Set()), []);

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

  // Replace the current draft with text extracted from an uploaded file.
  // Drag-drop and the Upload button both call this. Any in-flight critiques
  // are cleared since their spans no longer map to the new text.
  const onUploadFile = useCallback(async (file: File) => {
    try {
      const { text, sourceName } = await extractTextFromFile(file);
      if (!text.trim()) {
        setUploadError("The file looks empty. Check that it has body text and try again.");
        return;
      }
      setArticle(text);
      setCritiques([]);
      setActiveId(null);
      setResolvedIds(new Set());
      setRunningAgents(new Set());
      setDoneAgents(new Set());
      setStatus("idle");
      setErrorMessage(null);
      setUploadInfo({ name: sourceName, bytes: file.size });
      setUploadError(null);
    } catch (err) {
      setUploadError((err as Error).message ?? "Could not read that file.");
    }
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void onUploadFile(file);
    },
    [onUploadFile],
  );

  // The essays rail grows when an essay type is picked (Sol + the matching
  // Purpose Editor appended). Journalism rail mirrors essays: core +
  // article-type specialist + toggle-driven Parker/Peter/Joe.
  const modeRoster =
    mode === "research"
      ? getResearchRoster(researchSubject)
      : mode === "essays"
        ? getEssaysRoster(essayType)
        : getJournalismRoster(articleType, journalismToggles);
  const totalAgents = modeRoster.length;
  const enabledCount = modeRoster.filter((a) => !disabledAgents.has(a)).length;

  // Word cap: Free tier ceiling until we wire per-user plan into the editor.
  // The counter turns amber at 90% and red over the cap; Run is blocked over.
  const wordCount = countWords(article);
  const wordCap = PLANS.free.maxArticleWords;
  const overCap = wordCount > wordCap;

  return (
    <main className="flex h-screen w-screen flex-col bg-stone-50">
      <header className="relative flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-7 py-4">
        <div className="flex min-w-0 items-center gap-4">
          {/* Thin red rule. Editorial pull-quote feel, matches the wordmark
              colour and replaces the heavy gradient tile that read as SaaS. */}
          <span
            aria-hidden
            className="hidden sm:block h-12 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: "#DC2626" }}
          />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
              Pre-publication review
            </div>
            <h1 className="mt-1 font-serif text-[26px] italic leading-none tracking-tight text-neutral-900">
              The <span style={{ color: "#DC2626" }}>Red Room</span>
            </h1>
            <p className="mt-1.5 text-[12px] text-neutral-500">
              An independent team of AI editors, reviewing your draft before you publish.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div data-tutorial="mode">
            <ModeSwitcher mode={mode} onChange={setMode} />
          </div>
          <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {enabledCount} of {totalAgents} active
          </span>
          <button
            onClick={() => setTutorialOpen(true)}
            title="Replay the guided tour"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
            aria-label="Show tutorial"
          >
            <HelpGlyph />
          </button>
          <button
            data-tutorial="run"
            onClick={onRun}
            disabled={
              status === "running" ||
              enabledCount === 0 ||
              (mode === "research"
                ? !researchPdf
                : article.trim().length === 0 || overCap)
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {status === "running" ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Reviewing…
              </>
            ) : (
              <>
                <PlayGlyph />
                Run review
              </>
            )}
          </button>
          <div data-tutorial="signin">
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* Essay-mode sub-toolbar. Quieter than the header; only appears when
          the writer is in essays mode. Groups the three essay-shaped
          controls so they don't crowd the brand row. */}
      {mode === "essays" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neutral-200 bg-stone-50 px-7 py-2">
          <div data-tutorial="essay-type">
            <EssayTypePicker value={essayType} onChange={setEssayType} />
          </div>
          <div data-tutorial="essay-prompt">
            <PromptBoxButton
              value={essayPrompt}
              onChange={setEssayPrompt}
              disabled={essayType === "none"}
            />
          </div>
          <div data-tutorial="citation">
            <CitationStylePicker value={citationStyle} onChange={setCitationStyle} />
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-neutral-500 lg:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {enabledCount} of {totalAgents} editors active
          </span>
        </div>
      )}

      {/* Journalism-mode sub-toolbar. Article type picker + toggle chips
          for partisan / data claims / anonymous sources + an optional
          subject-context box. */}
      {mode === "journalism" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neutral-200 bg-stone-50 px-7 py-2">
          <div data-tutorial="article-type">
            <ArticleTypePicker
              value={articleType}
              onChange={(v) => {
                setArticleType(v);
                // Pre-fill toggles with sensible defaults for this type.
                // The user can still flip individual chips.
                setJournalismToggles(defaultTogglesFor(v));
              }}
            />
          </div>
          <div data-tutorial="journalism-toggles" className="inline-flex items-center gap-1.5">
            <JournalismToggleChip
              agent="partisan"
              trigger="Partisan"
              on={journalismToggles.partisan}
              onChange={(on) =>
                setJournalismToggles((t) => ({ ...t, partisan: on }))
              }
            />
            <JournalismToggleChip
              agent="data_expert"
              trigger="Data claims"
              on={journalismToggles.hasDataClaims}
              onChange={(on) =>
                setJournalismToggles((t) => ({ ...t, hasDataClaims: on }))
              }
            />
            <JournalismToggleChip
              agent="human_rights"
              trigger="Anonymous sources"
              on={journalismToggles.hasAnonymousSources}
              onChange={(on) =>
                setJournalismToggles((t) => ({ ...t, hasAnonymousSources: on }))
              }
            />
            <JournalismSpecialistsHelp />
          </div>
          <div data-tutorial="subject-context">
            <SubjectContextButton value={subjectContext} onChange={setSubjectContext} />
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {enabledCount} of {totalAgents} editors active
          </span>
        </div>
      )}

      {/* Research-mode sub-toolbar. Section / subject / venue selectors.
          The PDF is uploaded inside the main pane below. */}
      {mode === "research" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neutral-200 bg-stone-50 px-7 py-2">
          <ResearchSectionPicker value={researchSection} onChange={setResearchSection} />
          <ResearchSubjectPicker value={researchSubject} onChange={setResearchSubject} />
          <ResearchVenueInput value={researchVenue} onChange={setResearchVenue} />
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {enabledCount} of {totalAgents} editors active
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div data-tutorial="rail" className="flex shrink-0">
          <AgentRoster
            runningAgents={runningAgents}
            doneAgents={doneAgents}
            disabledAgents={disabledAgents}
            onToggleDisabled={onToggleDisabled}
            order={modeRoster}
          />
        </div>

        <div className="flex flex-1 min-w-0 items-stretch p-4">
          {mode === "research" ? (
            <ResearchUploadPane
              pdf={researchPdf}
              onSelectPdf={(f) => {
                setResearchPdf(f);
                setCritiques([]);
                setActiveId(null);
                setResolvedIds(new Set());
                setStatus("idle");
                setErrorMessage(null);
              }}
              fileInputRef={researchFileInputRef}
              section={researchSection}
              subject={researchSubject}
            />
          ) : (
          <div
            data-tutorial="editor"
            className={[
              "relative flex flex-1 overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-150",
              isDragging
                ? "border-rose-300 ring-4 ring-rose-100"
                : "border-neutral-200",
            ].join(" ")}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <Editor
              ref={editorRef}
              value={article}
              onChange={setArticle}
              critiques={critiques}
              activeId={activeId}
              resolvedIds={resolvedIds}
              onCritiqueClick={onSelectCritique}
            />

            {/* Word counter, bottom-right of the editor card. Amber as the
                user approaches the cap, red when over. Run is blocked over. */}
            <div className="pointer-events-none absolute bottom-3 right-3">
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums shadow-sm",
                  overCap
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : wordCount >= wordCap * 0.9
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-neutral-200 bg-white/90 text-neutral-500",
                ].join(" ")}
                title={
                  overCap
                    ? `Over the ${wordCap.toLocaleString()}-word cap. Trim the draft or upgrade for a higher cap.`
                    : `${wordCount.toLocaleString()} of ${wordCap.toLocaleString()} words used`
                }
              >
                {wordCount.toLocaleString()} / {wordCap.toLocaleString()} words
              </span>
            </div>

            {/* Sample drafts + upload, top-right of the card. */}
            <div data-tutorial="upload" className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <SampleDraftsButton
                  onPick={(text) => {
                    setArticle(text);
                    setCritiques([]);
                    setActiveId(null);
                    setResolvedIds(new Set());
                    setStatus("idle");
                    setErrorMessage(null);
                    setUploadError(null);
                    setUploadInfo(null);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-[11.5px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                  title="Import a draft from .docx or .txt. For Google Docs, use File then Download then Microsoft Word."
                >
                  <UploadGlyph />
                  Upload draft
                </button>
              </div>
              {uploadInfo && !uploadError && (
                <span className="pointer-events-auto rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] text-emerald-800">
                  Imported {uploadInfo.name}
                </span>
              )}
              {uploadError && (
                <span className="pointer-events-auto max-w-[260px] rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] leading-snug text-rose-800">
                  {uploadError}
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadFile(f);
                e.target.value = ""; // allow re-uploading the same file
              }}
            />

            {/* Drop overlay shown while a file is being dragged over the card. */}
            {isDragging && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/85 backdrop-blur-[1px]"
              >
                <DropGlyph />
                <div className="mt-3 font-serif text-lg text-rose-900">
                  Drop to import this draft
                </div>
                <div className="mt-1 text-[12px] text-rose-700/80">
                  Word .docx or plain .txt. For Google Docs, download as Word first.
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        <div data-tutorial="sidebar" className="flex shrink-0">
          <CritiqueSidebar
            critiques={critiques}
            activeId={activeId}
            onSelect={onSelectCritique}
            status={status}
            errorMessage={errorMessage}
            runningAgents={runningAgents}
            resolvedIds={resolvedIds}
            onToggleResolved={onToggleResolved}
            onUnresolveAll={onUnresolveAll}
            onAcceptFix={onAcceptFix}
            onDownload={() => window.print()}
          />
        </div>
      </div>

      {/* Tutorial overlay (portals to body) */}
      <Tutorial
        open={tutorialOpen}
        onClose={onCompleteTutorial}
        mode={mode}
        onSetMode={setMode}
      />

      {/* Hidden print view — visible only when window.print() runs.
          Research mode renders pages of the uploaded PDF side-by-side with
          critique notes anchored to each page; journalism / essays use the
          plain text-with-highlights view. */}
      {mode === "research" ? (
        <ResearchPrintView
          pdf={researchPdf}
          critiques={critiques}
          resolvedIds={resolvedIds}
          idOf={critiqueId}
          sectionLabel={
            RESEARCH_SECTION_CHOICES.find((c) => c.value === researchSection)
              ?.label ?? researchSection
          }
          subjectLabel={
            RESEARCH_SUBJECT_CHOICES.find((c) => c.value === researchSubject)
              ?.label ?? researchSubject
          }
          venue={researchVenue.trim()}
        />
      ) : (
        <PrintView
          article={article}
          critiques={critiques}
          resolvedIds={resolvedIds}
          idOf={critiqueId}
        />
      )}
    </main>
  );
}


function ModeSwitcher({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Reviewer mode"
      className="hidden sm:inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 text-[11.5px] font-medium"
    >
      <ModeChip active={mode === "journalism"} onClick={() => onChange("journalism")}>
        Journalism
      </ModeChip>
      <ModeChip active={mode === "essays"} onClick={() => onChange("essays")}>
        Essays
      </ModeChip>
      <ModeChip active={mode === "research"} onClick={() => onChange("research")}>
        Research
      </ModeChip>
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 transition",
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-600 hover:bg-neutral-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EssayTypePicker({
  value,
  onChange,
}: {
  value: EssayType;
  onChange: (v: EssayType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const choice = ESSAY_TYPE_CHOICES.find((c) => c.value === value) ?? ESSAY_TYPE_CHOICES[0];

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-800 transition hover:bg-neutral-50"
      >
        <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
          Essay
        </span>
        <span className="font-medium">{choice.label}</span>
        <span aria-hidden className="text-neutral-400">▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-[320px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
        >
          {ESSAY_TYPE_CHOICES.map((c) => {
            const active = c.value === value;
            return (
              <button
                key={c.value}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(c.value); setOpen(false); }}
                className={[
                  "block w-full px-3 py-2 text-left transition",
                  active ? "bg-neutral-100" : "hover:bg-neutral-50",
                ].join(" ")}
              >
                <div className="text-[12.5px] font-semibold text-neutral-900">
                  {c.label}
                  {active && <span className="ml-1.5 text-emerald-600">✓</span>}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  {c.examples}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptBoxButton({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const has = value.trim().length > 0;
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={
          disabled
            ? "Pick an essay type first; the prompt goes to the matching purpose editor."
            : has
              ? "Edit the assignment prompt the purpose editor sees."
              : "Paste the assignment prompt or rubric so the purpose editor tailors its feedback."
        }
        className={[
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition",
          disabled
            ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300"
            : has
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
        ].join(" ")}
      >
        <span aria-hidden>{has ? "✓" : "+"}</span>
        {has ? "Prompt added" : "Add prompt"}
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[360px] max-w-[calc(100vw-32px)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="mb-1.5 flex items-start justify-between">
            <div className="leading-tight">
              <div className="text-[12px] font-semibold text-neutral-900">
                Assignment prompt or context
              </div>
              <div className="text-[10.5px] text-neutral-500">
                Optional. The purpose editor will tailor feedback to what the rubric asks for.
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-1 -mt-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              ✕
            </button>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste the assignment prompt, rubric, or any context the editor should know about this essay."
            className="mt-1 h-40 w-full resize-none rounded-lg border border-neutral-200 bg-stone-50 p-2 text-[12px] leading-snug text-neutral-800 focus:border-neutral-400 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => {
                onChange("");
              }}
              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-neutral-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleTypePicker({
  value,
  onChange,
}: {
  value: ArticleType;
  onChange: (v: ArticleType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const choice =
    ARTICLE_TYPE_CHOICES.find((c) => c.value === value) ?? ARTICLE_TYPE_CHOICES[0];

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-800 transition hover:bg-neutral-50"
      >
        <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
          Article
        </span>
        <span className="font-medium">{choice.label}</span>
        <span aria-hidden className="text-neutral-400">▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-[340px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
        >
          {ARTICLE_TYPE_CHOICES.map((c) => {
            const active = c.value === value;
            return (
              <button
                key={c.value}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(c.value); setOpen(false); }}
                className={[
                  "block w-full px-3 py-2 text-left transition",
                  active ? "bg-neutral-100" : "hover:bg-neutral-50",
                ].join(" ")}
              >
                <div className="text-[12.5px] font-semibold text-neutral-900">
                  {c.label}
                  {active && <span className="ml-1.5 text-emerald-600">✓</span>}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  {c.examples}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A pill-shaped chip that activates a specific journalism specialist. The
 * binding (toggle <-> editor) is visible at-rest: each chip shows the
 * editor's avatar + first name + role and uses "+" / "✓" prefixes so the
 * "click to add a specialist" affordance is obvious without a tutorial.
 *
 * Off-state: dashed outline with "+" — looks clickable and unfilled.
 * On-state: solid border in the editor's brand color with "✓" — looks
 * applied. The avatar always reads the rail color so a user scanning the
 * row sees which named editor each chip refers to.
 */
/**
 * A small "?" button next to the journalism toggle chips. Click opens a
 * brief popover explaining what the chips do (they add named specialist
 * editors to the review). The chips' own labels carry most of the
 * affordance; this is the belt-and-suspenders helper for users who skip
 * the tutorial or come back months later.
 */
function JournalismSpecialistsHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="About specialist editors"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-[10.5px] font-bold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
        title="What do these add?"
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[300px] rounded-2xl border border-neutral-200 bg-white p-3 text-[11.5px] leading-snug shadow-xl"
        >
          <div className="mb-1 font-semibold text-neutral-900">Specialist editors</div>
          <p className="text-neutral-600">
            Click a chip to add that editor to your review. Each one is a
            specialist for the kind of story you said this is:
          </p>
          <ul className="mt-2 space-y-1.5 text-neutral-700">
            <li><span className="font-semibold">Parker</span> reads for partisan framing and asymmetric treatment of named parties.</li>
            <li><span className="font-semibold">Peter</span> stress-tests statistical and quantitative claims.</li>
            <li><span className="font-semibold">Joe</span> watches for source-protection and privacy risks when anonymous sources are involved.</li>
          </ul>
          <p className="mt-2 text-neutral-500">
            The chips pre-fill sensible defaults when you change article type.
            Toggle them off if a default doesn't fit your story.
          </p>
        </div>
      )}
    </div>
  );
}

function JournalismToggleChip({
  agent,
  trigger,
  on,
  onChange,
  title,
}: {
  agent: AgentName;
  trigger: string; // human-readable context that turns this on, e.g. "Partisan"
  on: boolean;
  onChange: (on: boolean) => void;
  title?: string;
}) {
  const meta = AGENTS[agent];
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      title={
        title ??
        `Click to ${on ? "remove" : "add"} ${meta.firstName} (${meta.shortLabel}). ` +
          `Recommended for stories that are: ${trigger.toLowerCase()}.`
      }
      aria-pressed={on}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium transition",
        "border",
        on
          ? "bg-white text-neutral-900 shadow-sm"
          : "border-dashed border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
      ].join(" ")}
      style={
        on
          ? { borderColor: meta.brandHex, backgroundColor: meta.highlightHex + "80" }
          : undefined
      }
    >
      <span
        aria-hidden
        className={[
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
          on ? "text-white" : "text-neutral-500 bg-neutral-100",
        ].join(" ")}
        style={on ? { backgroundColor: meta.brandHex } : undefined}
      >
        {on ? "✓" : "+"}
      </span>
      <span className="inline-flex h-5 w-5 overflow-hidden rounded-full">
        <Avatar agent={agent} size={20} active={on} muted={!on} />
      </span>
      <span className="leading-tight">
        <span className="font-semibold">{meta.firstName}</span>
        <span className="ml-1 text-[10.5px] uppercase tracking-wider text-neutral-500">
          {trigger}
        </span>
      </span>
    </button>
  );
}

function SubjectContextButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const has = value.trim().length > 0;
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={
          has
            ? "Edit the story context. Threaded into the type specialist's user message."
            : "Optional. Paste a short note: who the story is about, the key claim, the venue. The type specialist will use this."
        }
        className={[
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition",
          has
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
        ].join(" ")}
      >
        <span aria-hidden>{has ? "✓" : "+"}</span>
        {has ? "Context added" : "Add context"}
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[360px] max-w-[calc(100vw-32px)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="mb-1.5 flex items-start justify-between">
            <div className="leading-tight">
              <div className="text-[12px] font-semibold text-neutral-900">
                Story context
              </div>
              <div className="text-[10.5px] text-neutral-500">
                Optional. Who the story is about, the angle, the venue. Goes only to the type specialist.
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-1 -mt-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              ✕
            </button>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Profile of NYC councilwoman Maria Cortez ahead of her primary; venue is the local paper."
            className="mt-1 h-32 w-full resize-none rounded-lg border border-neutral-200 bg-stone-50 p-2 text-[12px] leading-snug text-neutral-800 focus:border-neutral-400 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => onChange("")}
              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-neutral-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResearchSectionPicker({
  value,
  onChange,
}: {
  value: ResearchSection;
  onChange: (v: ResearchSection) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-800">
      <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
        Section
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ResearchSection)}
        className="cursor-pointer border-0 bg-transparent text-[11.5px] font-medium text-neutral-800 focus:outline-none focus:ring-0"
      >
        {RESEARCH_SECTION_CHOICES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
    </label>
  );
}

function ResearchSubjectPicker({
  value,
  onChange,
}: {
  value: ResearchSubject;
  onChange: (v: ResearchSubject) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-800">
      <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
        Subject
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ResearchSubject)}
        className="cursor-pointer border-0 bg-transparent text-[11.5px] font-medium text-neutral-800 focus:outline-none focus:ring-0"
      >
        {RESEARCH_SUBJECT_CHOICES.map((c) => (
          <option key={c.value} value={c.value} disabled={!c.available}>
            {c.label}{c.available ? "" : " (coming soon)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResearchVenueInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-800">
      <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
        Venue
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. ICML 2026"
        className="w-32 border-0 bg-transparent text-[11.5px] font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
      />
    </label>
  );
}

function ResearchUploadPane({
  pdf,
  onSelectPdf,
  fileInputRef,
  section,
  subject,
}: {
  pdf: File | null;
  onSelectPdf: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  section: ResearchSection;
  subject: ResearchSubject;
}) {
  const [dragging, setDragging] = useState(false);
  const sectionLabel =
    RESEARCH_SECTION_CHOICES.find((c) => c.value === section)?.label ?? section;
  const subjectLabel =
    RESEARCH_SUBJECT_CHOICES.find((c) => c.value === subject)?.label ?? subject;

  function onPickFile(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      return; // ignore non-PDFs silently
    }
    if (f.size > 25 * 1024 * 1024) {
      return; // ignore files over 25MB (backend cap)
    }
    onSelectPdf(f);
  }

  return (
    <div
      className={[
        "relative flex flex-1 min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white p-10 text-center shadow-sm transition",
        dragging
          ? "border-rose-300 ring-4 ring-rose-100"
          : pdf
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-neutral-300",
      ].join(" ")}
      onDragEnter={(e) => {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onPickFile(e.dataTransfer?.files?.[0]);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {pdf ? (
        <>
          <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <PdfGlyph />
          </div>
          <div className="max-w-full break-all font-serif text-xl text-neutral-900">{pdf.name}</div>
          <div className="mt-1 text-[12.5px] text-neutral-500">
            {(pdf.size / (1024 * 1024)).toFixed(1)} MB · reviewing{" "}
            <span className="font-medium text-neutral-700">{sectionLabel}</span> against{" "}
            <span className="font-medium text-neutral-700">{subjectLabel}</span> conventions
          </div>
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-[12.5px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Replace PDF
            </button>
            <button
              onClick={() => onSelectPdf(null)}
              className="rounded-xl px-4 py-2 text-[12.5px] font-medium text-neutral-500 transition hover:text-neutral-800"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
            <PdfGlyph />
          </div>
          <div className="font-serif text-2xl italic tracking-tight text-neutral-900">
            Upload your paper
          </div>
          <p className="mt-2 max-w-[520px] text-[13px] text-neutral-500">
            Drop a PDF here, or click below to browse. The room reads the
            full paper (figures, tables, and all) and focuses critique on
            the section you picked above.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-neutral-700"
          >
            <PdfGlyph />
            Choose PDF
          </button>
          <p className="mt-3 text-[11.5px] text-neutral-400">
            PDF only · up to 25 MB · stays in this browser session
          </p>
        </>
      )}
    </div>
  );
}

function PdfGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 Z" />
      <path d="M14 2 v6 h6" />
      <path d="M9 13 h6" />
      <path d="M9 17 h6" />
    </svg>
  );
}

function CitationStylePicker({
  value,
  onChange,
}: {
  value: CitationStyle;
  onChange: (v: CitationStyle) => void;
}) {
  const labels: Record<CitationStyle, string> = {
    none: "Not specified",
    mla: "MLA",
    apa: "APA",
    chicago: "Chicago",
    turabian: "Turabian",
  };
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-800">
      <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
        Style
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CitationStyle)}
        className="cursor-pointer border-0 bg-transparent text-[11.5px] font-medium text-neutral-800 focus:outline-none focus:ring-0"
        title={labels[value]}
      >
        <option value="none">Not specified</option>
        <option value="mla">MLA</option>
        <option value="apa">APA</option>
        <option value="chicago">Chicago</option>
        <option value="turabian">Turabian</option>
      </select>
    </label>
  );
}


function PlayGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor" aria-hidden>
      <path d="M3 1.5 L10 6 L3 10.5 Z" />
    </svg>
  );
}


function UploadGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 11 V3" />
      <path d="M4.5 6.5 L8 3 L11.5 6.5" />
      <path d="M3 12.5 V13 a1 1 0 0 0 1 1 H12 a1 1 0 0 0 1 -1 V12.5" />
    </svg>
  );
}


function HelpGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6.2 6 a1.8 1.8 0 0 1 3.6 0 c0 1.2 -1.8 1.2 -1.8 2.5" />
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
    </svg>
  );
}


function DropGlyph() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="#9F1239" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 8 H30 L38 16 V40 a2 2 0 0 1 -2 2 H14 a2 2 0 0 1 -2 -2 V10 a2 2 0 0 1 2 -2 Z" />
      <path d="M30 8 V16 H38" />
      <path d="M24 22 V34" />
      <path d="M19 29 L24 34 L29 29" />
    </svg>
  );
}

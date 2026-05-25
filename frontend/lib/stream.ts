import {
  Critique,
  AgentName,
  ArticleType,
  CitationStyle,
  EssayType,
  Mode,
  ResearchSection,
  ResearchSubject,
} from "./types";

type StreamEvent =
  | { kind: "agent_start"; agent: string }
  | { kind: "critique"; agent: string; critique: Critique }
  | { kind: "agent_done"; agent: string; cost_usd: number; elapsed_ms: number }
  | { kind: "done"; cost_usd: number; elapsed_ms: number }
  | { kind: "error"; message: string };

interface Handlers {
  onCritique: (c: Critique) => void;
  onAgentStart?: (agent: string) => void;
  onAgentDone?: (agent: string, costUsd: number) => void;
  onDone?: (totalCostUsd: number, elapsedMs: number) => void;
  onError?: (msg: string) => void;
}

/**
 * EventSource doesn't support POST bodies, so we use fetch + a manual SSE
 * parser. This is enough for our shape (one JSON payload per event).
 *
 * Returns an AbortController so the caller can cancel an in-flight critique
 * (e.g. when the user edits the draft mid-stream).
 */
interface StreamOptions {
  disabledAgents?: AgentName[];
  mode?: Mode;
  citationStyle?: CitationStyle;
  essayType?: EssayType;
  essayPrompt?: string;
  // Journalism-specific
  articleType?: ArticleType;
  partisan?: boolean;
  hasDataClaims?: boolean;
  hasAnonymousSources?: boolean;
  subjectContext?: string;
}

export function streamCritique(
  backendUrl: string,
  article: string,
  handlers: Handlers,
  options: StreamOptions = {},
): AbortController {
  const controller = new AbortController();
  const {
    disabledAgents = [],
    mode = "journalism",
    citationStyle = "none",
    essayType = "none",
    essayPrompt = "",
    articleType = "none",
    partisan = false,
    hasDataClaims = false,
    hasAnonymousSources = false,
    subjectContext = "",
  } = options;

  (async () => {
    try {
      const response = await fetch(`${backendUrl}/critique/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          disabled_agents: disabledAgents,
          mode,
          citation_style: citationStyle,
          essay_type: essayType,
          essay_prompt: essayPrompt || null,
          article_type: articleType,
          partisan,
          has_data_claims: hasDataClaims,
          has_anonymous_sources: hasAnonymousSources,
          subject_context: subjectContext || null,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        handlers.onError?.(friendlyHttpError(response.status));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // SSE message delimiter is a blank line. sse-starlette uses \r\n,
      // EventSource and the spec also accept \n — match either.
      const DELIM = /\r?\n\r?\n/;
      const LINE = /\r?\n/;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const m = buffer.match(DELIM);
          if (!m || m.index === undefined) break;
          const block = buffer.slice(0, m.index);
          buffer = buffer.slice(m.index + m[0].length);
          const dataLine = block.split(LINE).find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim()) as StreamEvent;
            dispatch(payload, handlers);
          } catch (err) {
            console.error("SSE parse error", err, dataLine);
          }
        }
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") return;
      handlers.onError?.(friendlyNetworkError(err));
    }
  })();

  return controller;
}

/**
 * Research-mode upload + stream. Sends a PDF file as multipart/form-data
 * to /critique/stream-pdf with the research routing fields. Returns an
 * AbortController so the caller can cancel mid-stream.
 */
interface ResearchStreamOptions {
  disabledAgents?: AgentName[];
  section?: ResearchSection;
  subject?: ResearchSubject;
  venue?: string;
}

export function streamResearchCritique(
  backendUrl: string,
  pdf: File,
  handlers: Handlers,
  options: ResearchStreamOptions = {},
): AbortController {
  const controller = new AbortController();
  const {
    disabledAgents = [],
    section = "full_paper",
    subject = "none",
    venue = "",
  } = options;

  (async () => {
    try {
      const form = new FormData();
      form.append("pdf", pdf, pdf.name);
      form.append("mode", "research");
      form.append("research_section", section);
      form.append("research_subject", subject);
      if (venue) form.append("research_venue", venue);
      form.append("disabled_agents", JSON.stringify(disabledAgents));

      const response = await fetch(`${backendUrl}/critique/stream-pdf`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        handlers.onError?.(friendlyHttpError(response.status));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const DELIM = /\r?\n\r?\n/;
      const LINE = /\r?\n/;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        while (true) {
          const m = buffer.match(DELIM);
          if (!m || m.index === undefined) break;
          const block = buffer.slice(0, m.index);
          buffer = buffer.slice(m.index + m[0].length);
          const dataLine = block.split(LINE).find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim()) as StreamEvent;
            dispatch(payload, handlers);
          } catch (err) {
            console.error("SSE parse error", err, dataLine);
          }
        }
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") return;
      handlers.onError?.(friendlyNetworkError(err));
    }
  })();

  return controller;
}


function dispatch(ev: StreamEvent, h: Handlers) {
  switch (ev.kind) {
    case "agent_start":
      h.onAgentStart?.(ev.agent);
      break;
    case "critique":
      h.onCritique(ev.critique);
      break;
    case "agent_done":
      h.onAgentDone?.(ev.agent, ev.cost_usd);
      break;
    case "done":
      h.onDone?.(ev.cost_usd, ev.elapsed_ms);
      break;
    case "error":
      h.onError?.(friendlyApiError(ev.message));
      break;
  }
}


/**
 * Translate raw browser fetch errors into something a journalist on a flaky
 * cafe wifi can act on. The default browser text is "Failed to fetch" which
 * tells them nothing.
 */
function friendlyNetworkError(err: Error): string {
  const msg = (err.message || "").toLowerCase();
  if (
    err.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed")
  ) {
    return "We can't reach the review service. Check your connection, or try again in a moment.";
  }
  return err.message || "Something went wrong. Please try again.";
}

/** Map common backend HTTP status codes to user-friendly copy. */
function friendlyHttpError(status: number): string {
  if (status === 429) return "The room is busy right now. Please try again in a minute.";
  if (status === 401 || status === 403) {
    return "The review service is misconfigured. The site owner has been notified.";
  }
  if (status === 503) return "The AI service is temporarily overloaded. Please try again in a moment.";
  if (status >= 500) return "Something went wrong on the review service. Please try again.";
  if (status >= 400) return `The review couldn't be started (error ${status}).`;
  return `Unexpected response from the review service (${status}).`;
}

/**
 * Translate errors that bubble up from the backend's stream (typically
 * Anthropic SDK exceptions) into plain language.
 */
function friendlyApiError(raw: string): string {
  const r = (raw || "").toLowerCase();
  if (r.includes("api key") || r.includes("authentication") || r.includes("api_key")) {
    return "Authentication failed. The site owner needs to check the API key configuration.";
  }
  if (r.includes("rate limit") || r.includes("429")) {
    return "The AI service is rate-limited right now. Please try again in a minute.";
  }
  if (r.includes("overloaded") || r.includes("503")) {
    return "The AI service is temporarily overloaded. Please try again in a moment.";
  }
  if (r.includes("timeout") || r.includes("timed out")) {
    return "The review took too long. Please try a shorter draft, or run again.";
  }
  if (r.includes("connection") && r.includes("reset")) {
    return "The connection dropped mid-review. Please run it again.";
  }
  return raw || "Something went wrong. Please try again.";
}

import { Critique, AgentName } from "./types";

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
export function streamCritique(
  backendUrl: string,
  article: string,
  handlers: Handlers,
  disabledAgents: AgentName[] = [],
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${backendUrl}/critique/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, disabled_agents: disabledAgents }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        handlers.onError?.(`Backend returned ${response.status}`);
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
      if ((e as Error).name !== "AbortError") {
        handlers.onError?.((e as Error).message);
      }
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
      h.onError?.(ev.message);
      break;
  }
}

# Synthetic Red Room

Multi-agent system that critiques journalism drafts pre-publication, modeled on a newsroom "red room" review. Each agent has a distinct persona (Legal Skeptic, Data Expert, Human Rights Advocate, Clarity Critique, Partisan Checker) and looks for a different class of vulnerability in the draft.

MVP ships with **Legal Skeptic** end-to-end: backend agent, FastAPI server with SSE streaming, and a Next.js editor with inline highlights and a sidebar. The other personas plug into the same orchestrator without further architecture changes.

## Layout

```
backend/    Python — agents, orchestrator, FastAPI app, eval harness
frontend/   Next.js 15 — editor + sidebar UI
data/       Test articles
```

## Prerequisites

- Python 3.11+
- Node 20+
- An Anthropic API key

## Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# add ANTHROPIC_API_KEY=sk-ant-... to .env

# Sanity check (no API call):
pytest tests/test_legal_skeptic.py -k extract -v

# Smoke test against the real API (~$0.01):
pytest tests/test_legal_skeptic.py -v

# CLI:
echo "Mark Reyes stole $400,000, sources say." | python -m red_room.cli

# Eval against the golden set:
python -m eval.run_eval

# Server:
uvicorn red_room.api:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

The frontend expects the backend at `http://localhost:8000`. Override with `NEXT_PUBLIC_BACKEND_URL` if needed.

## Cost

Per draft (1500 words), Sonnet 4.6 + prompt caching + 2K thinking budget: **~$0.04 first call, ~$0.01 subsequent calls** (system prompt and exemplars cache after the first article in a 5-minute window). Verify current pricing at anthropic.com/pricing.

## Adding a new agent

1. Write `backend/src/red_room/prompts/<name>.md` (the persona + decision rules).
2. Write `backend/src/red_room/exemplars/<name>.jsonl` (5 hand-curated examples).
3. Add the literal to `AgentName` in `backend/src/red_room/schemas.py`.
4. Add a subclass of `BaseAgent` in `backend/src/red_room/agents/<name>.py` (~10 lines).
5. Append it to `default_agents()` in `orchestrator.py`.
6. Add the agent's color to `frontend/tailwind.config.ts` and a row to `AGENTS` in `frontend/lib/types.ts`.

That's the whole loop — system prompt and exemplars do all the heavy lifting.

## Plan

The full implementation plan (architecture, schemas, eval methodology, cost analysis) lives at `~/.claude/plans/so-can-you-help-eventual-kay.md` and was reviewed before the code was written.

from __future__ import annotations

import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from red_room import orchestrator
from red_room.agents.base import PROMPTS_DIR
from red_room.schemas import CritiqueRequest


load_dotenv()

app = FastAPI(title="Synthetic Red Room", version="0.1.0")

# Frontend runs at :3000 in dev. Tighten this in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("RED_ROOM_CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": os.getenv("RED_ROOM_MODEL", "claude-sonnet-4-6")}


def _filtered_agents(disabled: list[str] | None):
    """Build the roster for this request, skipping any agent the user has
    turned off in the UI. Disabled agents are dropped here so they never
    issue an API call and never bill."""
    disabled_set = set(disabled or [])
    return [a for a in orchestrator.default_agents() if a.name not in disabled_set]


@app.post("/critique")
async def critique(req: CritiqueRequest) -> dict:
    """Non-streaming endpoint — returns the full RedRoomResult after all
    agents finish. Useful for the CLI and tests."""
    result = await orchestrator.run(
        req.article,
        article_id=req.article_id,
        agents=_filtered_agents(req.disabled_agents),
    )
    return result.model_dump()


@app.post("/critique/stream")
async def critique_stream(req: CritiqueRequest) -> EventSourceResponse:
    """SSE endpoint consumed by the frontend. Emits one event per agent
    state change so critiques pop into the sidebar as they're produced."""
    agents = _filtered_agents(req.disabled_agents)

    async def event_iter():
        async for event in orchestrator.stream(
            req.article, article_id=req.article_id, agents=agents,
        ):
            yield {"event": event.kind, "data": json.dumps(event.to_dict())}

    return EventSourceResponse(event_iter())


# ---------- prompt inspection / editing (dev tooling) ----------


class PromptUpdate(BaseModel):
    text: str


@app.get("/agents")
async def list_agents() -> dict:
    """List the agent roster with the names of their prompt files. The
    frontend uses this to populate the prompt-editor modal."""
    agents = []
    for agent in orchestrator.default_agents():
        agents.append({
            "name": agent.name,
            "prompt_file": agent.prompt_path.name,
            "exemplars_file": agent.exemplars_path.name,
        })
    return {"agents": agents}


@app.get("/agents/{name}/prompt")
async def get_prompt(name: str) -> dict:
    """Return the current persona prompt for an agent."""
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"unknown agent: {name}")
    return {"name": name, "text": path.read_text(encoding="utf-8")}


@app.put("/agents/{name}/prompt")
async def update_prompt(name: str, body: PromptUpdate) -> dict:
    """Overwrite the persona prompt for an agent. The change takes effect
    on the next /critique call — `BaseAgent.load_prompt` reads from disk
    each request, so no server restart is needed."""
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"unknown agent: {name}")
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty")
    path.write_text(body.text, encoding="utf-8")
    return {"name": name, "bytes": len(body.text.encode("utf-8"))}

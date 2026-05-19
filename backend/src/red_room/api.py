from __future__ import annotations

import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from red_room import orchestrator
from red_room.schemas import CritiqueRequest


load_dotenv()

app = FastAPI(title="Synthetic Red Room", version="1.0.0")

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
    return {"status": "ok"}


def _filtered_agents(disabled: list[str] | None):
    """Build the roster for this request, skipping any agent the user has
    turned off in the UI. Disabled agents are dropped here so they never
    issue an API call and never bill."""
    disabled_set = set(disabled or [])
    return [a for a in orchestrator.default_agents() if a.name not in disabled_set]


@app.post("/critique")
async def critique(req: CritiqueRequest) -> dict:
    """Non-streaming endpoint. Returns the full RedRoomResult after all
    agents finish. Used by the CLI and tests."""
    result = await orchestrator.run(
        req.article,
        article_id=req.article_id,
        agents=_filtered_agents(req.disabled_agents),
    )
    return result.model_dump()


@app.post("/critique/stream")
async def critique_stream(req: CritiqueRequest) -> EventSourceResponse:
    """SSE endpoint consumed by the frontend. Emits one event per agent
    state change so critiques pop into the sidebar as they are produced."""
    agents = _filtered_agents(req.disabled_agents)

    async def event_iter():
        async for event in orchestrator.stream(
            req.article, article_id=req.article_id, agents=agents,
        ):
            yield {"event": event.kind, "data": json.dumps(event.to_dict())}

    return EventSourceResponse(event_iter())

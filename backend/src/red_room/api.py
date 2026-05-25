from __future__ import annotations

import base64
import json
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from red_room import orchestrator
from red_room.schemas import (
    ArticleType,
    CitationStyle,
    CritiqueRequest,
    EssayType,
    Mode,
    ResearchSection,
    ResearchSubject,
)


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


# Hard cap on uploaded PDF size. Anthropic accepts up to 32MB; we cap a bit
# below to leave room for the encoded payload and to avoid runaway costs on
# accidentally-huge uploads.
MAX_PDF_BYTES = 25 * 1024 * 1024  # 25MB


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


def _filtered_agents(
    disabled: list[str] | None,
    mode: Mode,
    citation_style: CitationStyle,
    essay_type: EssayType,
    essay_prompt: str | None,
    research_section: ResearchSection = "full_paper",
    research_subject: ResearchSubject = "none",
    research_venue: str | None = None,
    article_type: ArticleType = "none",
    partisan: bool = False,
    has_data_claims: bool = False,
    has_anonymous_sources: bool = False,
    subject_context: str | None = None,
):
    """Build the roster for this request, skipping any agent the user has
    turned off in the UI. Disabled agents are dropped here so they never
    issue an API call and never bill."""
    disabled_set = set(disabled or [])
    return [
        a
        for a in orchestrator.default_agents(
            mode=mode,
            citation_style=citation_style,
            essay_type=essay_type,
            essay_prompt=essay_prompt,
            research_section=research_section,
            research_subject=research_subject,
            research_venue=research_venue,
            article_type=article_type,
            partisan=partisan,
            has_data_claims=has_data_claims,
            has_anonymous_sources=has_anonymous_sources,
            subject_context=subject_context,
        )
        if a.name not in disabled_set
    ]


@app.post("/critique")
async def critique(req: CritiqueRequest) -> dict:
    """Non-streaming endpoint. Returns the full RedRoomResult after all
    agents finish. Used by the CLI and tests."""
    result = await orchestrator.run(
        req.article,
        article_id=req.article_id,
        agents=_filtered_agents(
            req.disabled_agents,
            req.mode,
            req.citation_style,
            req.essay_type,
            req.essay_prompt,
            req.research_section,
            req.research_subject,
            req.research_venue,
            req.article_type,
            req.partisan,
            req.has_data_claims,
            req.has_anonymous_sources,
            req.subject_context,
        ),
    )
    return result.model_dump()


@app.post("/critique/stream")
async def critique_stream(req: CritiqueRequest) -> EventSourceResponse:
    """SSE endpoint consumed by the frontend (journalism / essays modes).
    Emits one event per agent state change so critiques pop into the
    sidebar as they are produced."""
    agents = _filtered_agents(
        req.disabled_agents,
        req.mode,
        req.citation_style,
        req.essay_type,
        req.essay_prompt,
        article_type=req.article_type,
        partisan=req.partisan,
        has_data_claims=req.has_data_claims,
        has_anonymous_sources=req.has_anonymous_sources,
        subject_context=req.subject_context,
    )

    async def event_iter():
        async for event in orchestrator.stream(
            req.article, article_id=req.article_id, agents=agents,
        ):
            yield {"event": event.kind, "data": json.dumps(event.to_dict())}

    return EventSourceResponse(event_iter())


@app.post("/critique/stream-pdf")
async def critique_stream_pdf(
    pdf: UploadFile = File(...),
    mode: Mode = Form("research"),
    research_section: ResearchSection = Form("full_paper"),
    research_subject: ResearchSubject = Form("none"),
    research_venue: Optional[str] = Form(None),
    disabled_agents: Optional[str] = Form(None),     # JSON-encoded list
    article_id: Optional[str] = Form(None),
) -> EventSourceResponse:
    """Streaming endpoint for research mode. Accepts a PDF upload + the
    research-specific routing fields. Each agent receives the PDF as a
    cached document input plus a section-focus instruction."""
    if mode != "research":
        raise HTTPException(
            status_code=400,
            detail="This endpoint is for research mode only. Use /critique/stream for journalism / essays.",
        )

    # Read + size-check the upload, then base64-encode for Anthropic.
    pdf_bytes = await pdf.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"PDF too large ({len(pdf_bytes)} bytes). Cap is {MAX_PDF_BYTES} bytes.",
        )
    if not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file does not appear to be a PDF.",
        )
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("ascii")

    disabled: list[str] | None = None
    if disabled_agents:
        try:
            parsed = json.loads(disabled_agents)
            if isinstance(parsed, list):
                disabled = [str(x) for x in parsed]
        except json.JSONDecodeError:
            pass

    agents = _filtered_agents(
        disabled,
        mode,
        "none",          # citation_style — unused in research mode
        "none",          # essay_type — unused
        None,            # essay_prompt — unused
        research_section,
        research_subject,
        research_venue,
    )

    # Article string is a short focus label; real content is the PDF.
    article_label = f"Research paper review (section: {research_section})"

    async def event_iter():
        async for event in orchestrator.stream(
            article_label,
            article_id=article_id,
            agents=agents,
            pdf_b64=pdf_b64,
        ):
            yield {"event": event.kind, "data": json.dumps(event.to_dict())}

    return EventSourceResponse(event_iter())

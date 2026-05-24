from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import AsyncIterator

from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent, estimate_cost_usd
from red_room.agents.clarity import ClarityCritique
from red_room.agents.data_expert import DataExpert
from red_room.agents.human_rights import HumanRightsAdvocate
from red_room.agents.legal_skeptic import LegalSkeptic
from red_room.agents.partisan import PartisanChecker
from red_room.agents.question_master import QuestionMaster
from red_room.agents.thesis_editor import ThesisEditor
from red_room.agents.evidence_quotation import EvidenceQuotation
from red_room.agents.prose_style import ProseStyle
from red_room.agents.structure_editor import StructureEditor
from red_room.agents.logic_auditor import LogicAuditor
from red_room.agents.citation_editor import CitationEditor
from red_room.agents.argumentative_editor import ArgumentativeEditor
from red_room.agents.analytical_editor import AnalyticalEditor
from red_room.agents.narrative_editor import NarrativeEditor
from red_room.agents.research_editor import ResearchEditor
from red_room.agents.rhetorical_editor import RhetoricalEditor
from red_room.schemas import (
    CitationStyle,
    Critique,
    EssayType,
    Mode,
    RedRoomResult,
)


_PURPOSE_EDITORS = {
    "argumentative": ArgumentativeEditor,
    "analytical": AnalyticalEditor,
    "narrative": NarrativeEditor,
    "research": ResearchEditor,
    "rhetorical": RhetoricalEditor,
}


@dataclass
class AgentEvent:
    """One event emitted on the SSE stream."""
    kind: str        # "agent_start" | "critique" | "agent_done" | "done" | "error"
    agent: str | None = None
    critique: Critique | None = None
    cost_usd: float = 0.0
    elapsed_ms: int = 0
    message: str | None = None

    def to_dict(self) -> dict:
        d: dict = {"kind": self.kind}
        if self.agent is not None:
            d["agent"] = self.agent
        if self.critique is not None:
            d["critique"] = self.critique.model_dump()
        if self.kind in ("agent_done", "done"):
            d["cost_usd"] = self.cost_usd
            d["elapsed_ms"] = self.elapsed_ms
        if self.message is not None:
            d["message"] = self.message
        return d


def default_agents(
    client: AsyncAnthropic | None = None,
    mode: Mode = "journalism",
    citation_style: CitationStyle = "none",
    essay_type: EssayType = "none",
    essay_prompt: str | None = None,
) -> list[BaseAgent]:
    """Return the roster for the requested mode.

    `journalism` returns the six press editors. `essays` returns the seven
    craft editors + Sol + (when `essay_type` is set) the matching Purpose
    Editor. Each persona is one Anthropic call dispatched in parallel by
    `run` / `stream`.
    """
    # More retry headroom for transient 529s (see BaseAgent.__init__).
    client = client or AsyncAnthropic(max_retries=6)
    if mode == "essays":
        roster: list[BaseAgent] = [
            ThesisEditor(client=client),
            EvidenceQuotation(client=client),
            ProseStyle(client=client),
            StructureEditor(client=client),
            LogicAuditor(client=client),
            CitationEditor(client=client, citation_style=citation_style),
            QuestionMaster(client=client, mode="essays", essay_type=essay_type),
        ]
        # Add the Purpose Editor that matches the writer's chosen essay type.
        # `none` skips it. Only one runs per review.
        purpose_cls = _PURPOSE_EDITORS.get(essay_type)
        if purpose_cls is not None:
            roster.append(purpose_cls(client=client, essay_prompt=essay_prompt))
        return roster
    return [
        LegalSkeptic(client=client),
        DataExpert(client=client),
        HumanRightsAdvocate(client=client),
        ClarityCritique(client=client),
        PartisanChecker(client=client),
        QuestionMaster(client=client, mode="journalism"),
    ]


async def run(
    article: str,
    article_id: str | None = None,
    agents: list[BaseAgent] | None = None,
) -> RedRoomResult:
    """Non-streaming entrypoint: dispatch all agents in parallel and return
    a merged result. Used by the CLI and tests."""
    article_id = article_id or uuid.uuid4().hex[:12]
    # `agents is None` means "use the default roster". An empty list is a
    # valid, explicit choice (every agent turned off in the UI) and we must
    # honour it rather than fall back via truthiness.
    if agents is None:
        agents = default_agents()

    started = time.monotonic()
    pairs = await asyncio.gather(*(a.critique(article) for a in agents))
    elapsed_ms = int((time.monotonic() - started) * 1000)

    critiques: list[Critique] = []
    cost = 0.0
    for agent, (cs, response) in zip(agents, pairs):
        critiques.extend(cs)
        cost += estimate_cost_usd(agent.model, response.usage)

    critiques.sort(key=lambda c: c.span[0])
    return RedRoomResult(
        article_id=article_id,
        critiques=critiques,
        elapsed_ms=elapsed_ms,
        cost_usd=round(cost, 6),
    )


async def stream(
    article: str,
    article_id: str | None = None,
    agents: list[BaseAgent] | None = None,
) -> AsyncIterator[AgentEvent]:
    """Streaming entrypoint for SSE. Yields agent_start / critique /
    agent_done events as each agent's call completes, then a final `done`."""
    article_id = article_id or uuid.uuid4().hex[:12]
    # `agents is None` means "use the default roster". An empty list is a
    # valid, explicit choice (every agent turned off in the UI) and we must
    # honour it rather than fall back via truthiness.
    if agents is None:
        agents = default_agents()
    started = time.monotonic()
    total_cost = 0.0

    async def _run_one(agent: BaseAgent) -> tuple[BaseAgent, list[Critique], float, int]:
        agent_started = time.monotonic()
        critiques, response = await agent.critique(article)
        return (
            agent,
            critiques,
            estimate_cost_usd(agent.model, response.usage),
            int((time.monotonic() - agent_started) * 1000),
        )

    for agent in agents:
        yield AgentEvent(kind="agent_start", agent=agent.name)

    tasks = [asyncio.create_task(_run_one(a)) for a in agents]
    try:
        for done in asyncio.as_completed(tasks):
            agent, critiques, cost, agent_ms = await done
            total_cost += cost
            for c in critiques:
                yield AgentEvent(kind="critique", agent=agent.name, critique=c)
            yield AgentEvent(
                kind="agent_done",
                agent=agent.name,
                cost_usd=cost,
                elapsed_ms=agent_ms,
            )
    except Exception as exc:
        yield AgentEvent(kind="error", message=str(exc))
        for t in tasks:
            t.cancel()
        return

    yield AgentEvent(
        kind="done",
        cost_usd=round(total_cost, 6),
        elapsed_ms=int((time.monotonic() - started) * 1000),
    )

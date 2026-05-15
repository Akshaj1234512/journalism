from typing import Literal
from pydantic import BaseModel, Field

AgentName = Literal[
    "legal_skeptic",
    "data_expert",
    "human_rights",
    "clarity",
    "partisan",
    "question_master",
]

Severity = Literal["high", "medium", "low"]


class Critique(BaseModel):
    agent: AgentName
    text_quote: str = Field(description="Exact substring from the article")
    span: tuple[int, int] = Field(description="[start, end) char offsets")
    issue_label: str
    question: str
    why_it_matters: str
    fix_suggestion: str | None = Field(
        default=None,
        description="Human-readable explanation of what the reporter should "
        "change and why. Optional but strongly preferred.",
    )
    replacement: str | None = Field(
        default=None,
        description="Literal text to substitute for text_quote if the reporter "
        "accepts the fix in one click. Null when the fix is structural (e.g. "
        "'move the rebuttal up') and cannot be expressed as a single-span swap.",
    )
    severity: Severity


class RedRoomResult(BaseModel):
    article_id: str
    critiques: list[Critique]
    elapsed_ms: int
    cost_usd: float


class CritiqueRequest(BaseModel):
    article: str
    article_id: str | None = None
    disabled_agents: list[str] | None = Field(
        default=None,
        description="Names of agents the user has turned off for this review. "
        "Skipped on the server so they neither run nor bill.",
    )

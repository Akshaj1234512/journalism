from typing import Literal
from pydantic import BaseModel, Field

AgentName = Literal[
    # Journalism specialists (run only in journalism mode).
    "legal_skeptic",
    "data_expert",
    "human_rights",
    "partisan",
    # Shared craft editors (run in BOTH modes).
    "thesis_editor",
    "prose_style",
    "structure_editor",
    "logic_auditor",
    "evidence_quotation",
    "question_master",
    # Essays specialist.
    "citation_editor",
    # Purpose editors — exactly one runs per essay, picked by essay_type.
    "argumentative_editor",
    "analytical_editor",
    "narrative_editor",
    "research_editor",
    "rhetorical_editor",
]

Mode = Literal["journalism", "essays"]
CitationStyle = Literal["mla", "apa", "chicago", "turabian", "none"]
EssayType = Literal[
    "argumentative",
    "analytical",
    "narrative",
    "research",
    "rhetorical",
    "none",
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
    mode: Mode = Field(
        default="journalism",
        description="Which editor roster to run. 'journalism' = the six press "
        "editors. 'essays' = the seven English / history editors.",
    )
    citation_style: CitationStyle = Field(
        default="none",
        description="Citation format the essay is written in (MLA, APA, Chicago, "
        "Turabian). Used only by the citation_editor in essays mode.",
    )
    essay_type: EssayType = Field(
        default="none",
        description="Which kind of essay this is. Routes to the matching "
        "Purpose Editor: 'argumentative' -> Ari, 'analytical' -> Anya, "
        "'narrative' -> Nora, 'research' -> Reese, 'rhetorical' -> Rhea. "
        "'none' runs no purpose editor.",
    )
    essay_prompt: str | None = Field(
        default=None,
        description="Optional assignment prompt or context the writer pastes in. "
        "Only the matching Purpose Editor sees it; core craft editors ignore it. "
        "Lets the purpose editor tailor feedback to what the rubric asked for.",
    )
    disabled_agents: list[str] | None = Field(
        default=None,
        description="Names of agents the user has turned off for this review. "
        "Skipped on the server so they neither run nor bill.",
    )

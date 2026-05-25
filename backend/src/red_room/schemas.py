from typing import Literal
from pydantic import BaseModel, Field

AgentName = Literal[
    # Journalism specialists (run only in journalism mode).
    "legal_skeptic",
    "data_expert",
    "human_rights",
    "partisan",
    # Journalism type specialists — one runs per article based on article_type.
    "city_editor",          # News
    "investigations_editor", # Investigative
    "opinion_editor",        # Opinion / Editorial
    "features_editor",       # Feature
    "profile_editor",        # Profile
    "reviews_editor",        # Review
    "explanatory_editor",    # Analysis / Explainer
    # Shared craft editors (run in BOTH journalism + essays).
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
    # Research-paper editors (run in research mode).
    "methodology_editor",
    "cs_ml_specialist",
    "related_work_editor",
    "limitations_editor",
    "figure_table_editor",
    "theorem_editor",
    "format_editor",
]

Mode = Literal["journalism", "essays", "research"]

# Which section of the paper the user wants reviewed. Agents focus on this
# section but have access to the full PDF for cross-section context.
ResearchSection = Literal[
    "abstract",
    "introduction",
    "related_work",
    "methods",
    "results",
    "discussion",
    "conclusion",
    "full_paper",
]

# Subject area picks the specialist editor that runs alongside the core
# research editors. Each area has its own conference conventions.
ResearchSubject = Literal[
    "cs_ml",          # CS / ML (ICML, NeurIPS, ICLR, AAAI)
    "engineering",    # IEEE conventions (ICRA, IROS)
    "biology",        # Nature / Cell / PLOS / eLife
    "medicine",       # NEJM / Lancet / JAMA
    "none",
]
CitationStyle = Literal["mla", "apa", "chicago", "turabian", "none"]
EssayType = Literal[
    "argumentative",
    "analytical",
    "narrative",
    "research",
    "rhetorical",
    "none",
]

# Article type picks the journalism type specialist that runs alongside
# the core editors (6 shared craft + Anne). Toggle flags below control
# the activation of Parker/Peter/Joe.
ArticleType = Literal[
    "news",          # straight reporting, inverted pyramid → City Editor (Cole)
    "investigative", # accusations + paper trail → Investigations Editor (Iris)
    "opinion",       # editorial / opinion → Opinion Editor (Otto)
    "feature",       # narrative reporting → Features Editor (Faye)
    "profile",       # about a person → Profile Editor (Pia)
    "review",        # review of a work → Reviews Editor (Remy)
    "analysis",      # explainer / analysis → Explanatory Editor (Eli)
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
    research_section: ResearchSection = Field(
        default="full_paper",
        description="Which section of the research paper the agents should focus on. "
        "They get the full PDF for context but write feedback against the chosen section.",
    )
    research_subject: ResearchSubject = Field(
        default="none",
        description="Subject-area specialist to run alongside the core research editors. "
        "Each area knows its venues' conventions (CS: ICML/NeurIPS, Bio: Nature/Cell, etc.).",
    )
    research_venue: str | None = Field(
        default=None,
        description="Optional target venue name (e.g. 'ICML 2026', 'Nature Methods'). "
        "Threaded into the subject specialist's user context so it tunes to that venue's bar.",
    )
    article_type: ArticleType = Field(
        default="none",
        description="Which kind of journalism piece. Routes to the matching type "
        "specialist: 'news' -> Cole, 'investigative' -> Iris, 'opinion' -> Otto, "
        "'feature' -> Faye, 'profile' -> Pia, 'review' -> Remy, 'analysis' -> Eli. "
        "'none' runs no type specialist (back-compat with the old fixed roster).",
    )
    partisan: bool = Field(
        default=False,
        description="True if the story is politically partisan / takes a side; "
        "activates Parker (Fairness / Partisan Checker).",
    )
    has_data_claims: bool = Field(
        default=False,
        description="True if the story contains statistics or quantitative claims; "
        "activates Peter (Data Expert).",
    )
    has_anonymous_sources: bool = Field(
        default=False,
        description="True if the story uses anonymous or unnamed sources; "
        "activates Joe (Source Privacy).",
    )
    subject_context: str | None = Field(
        default=None,
        description="Optional short context the reporter pastes in: who the story "
        "is about, the key claim, the publication venue. Threaded into the type "
        "specialist's user context. Core craft editors ignore it.",
    )
    disabled_agents: list[str] | None = Field(
        default=None,
        description="Names of agents the user has turned off for this review. "
        "Skipped on the server so they neither run nor bill.",
    )

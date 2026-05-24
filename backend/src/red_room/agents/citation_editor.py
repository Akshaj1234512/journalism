from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import CitationStyle


class CitationEditor(BaseAgent):
    """Kate. Citation format enforcement (MLA / APA / Chicago / Turabian).

    Runs on Haiku 4.5 by default. Citation rules are explicit and rule-based
    (MLA 9th ed. section 6.42, APA section 8.13, etc.), which Haiku handles
    reliably at ~1/3 the cost of Sonnet. Override the model in the
    constructor if you need Sonnet's deeper judgment on a specific run.
    """

    name = "citation_editor"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        citation_style: CitationStyle = "none",
    ) -> None:
        super().__init__(
            client=client,
            model=model or "claude-haiku-4-5-20251001",
            thinking_budget=thinking_budget,
        )
        self.citation_style = citation_style

    def tools(self) -> list[dict]:
        return []

    def extra_user_context(self) -> str:
        if self.citation_style == "none":
            return (
                "The writer did not specify a citation style. Flag obvious "
                "citation problems (missing citations on quotes, inconsistent "
                "formats within the draft) without enforcing any one style."
            )
        names = {
            "mla": "MLA (9th edition)",
            "apa": "APA (7th edition)",
            "chicago": "Chicago / CMOS (notes-bibliography)",
            "turabian": "Turabian (9th edition)",
        }
        label = names.get(self.citation_style, self.citation_style.upper())
        return (
            f"The writer is using {label} style. Enforce that style's rules "
            "for in-text citations, works cited / references / bibliography "
            "entries, and quotation formatting."
        )

from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class FormatEditor(BaseAgent):
    """Sage. Structure and formatting editor for research papers.

    Reads the paper the way a venue chair reads it at the desk-reject stage:
    section ordering, page-budget allocation, template compliance,
    anonymization, missing required sections, table / figure placement,
    contribution-list presence, and overall navigation cues.

    Anchored on documented ICML / NeurIPS / ICLR desk-reject categories.
    """

    name = "format_editor"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        section: ResearchSection = "full_paper",
        venue: str | None = None,
    ) -> None:
        super().__init__(client=client, model=model, thinking_budget=thinking_budget)
        self.section = section
        self.venue = (venue or "").strip()

    def tools(self) -> list[dict]:
        # web_search lets Sage pull up the current-year template / page-limit
        # / required-sections list for the user's target venue. Most flags
        # don't need a search (template-cramming, anonymization breaks, etc.
        # are visible in the PDF), but for the venue-specific rules a single
        # lookup is high-leverage. Capped at 2.
        return [
            {
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": 2,
            }
        ]

    def extra_user_context(self) -> str:
        venue_line = (
            f"The target venue is {self.venue}. Apply that venue's template "
            "rules (margins, page limit, required sections, anonymization "
            "policy).\n\n"
            if self.venue
            else "The target venue was not specified. Apply the ICML / NeurIPS / ICLR shared bar (anonymization, page-limit compliance, required Limitations and Broader Impact sections).\n\n"
        )
        return (
            f"{venue_line}"
            "Focus your review on the paper's overall structure and template "
            "compliance. Look at section ordering, the page-budget shape, the "
            "presence of required sections (Limitations, Broader Impact, "
            "Reproducibility), figure / table placement relative to "
            "references, template markers (margins, font, style file), and "
            "any anonymization break if the venue is double-blind. Flag "
            "desk-reject risks at high severity."
        )

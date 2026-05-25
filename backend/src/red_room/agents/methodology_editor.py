from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class MethodologyEditor(BaseAgent):
    """Mira. Methodology editor for research papers.

    Reads the full PDF but focuses critique on whichever section the user
    selected. The user picks a section (Methods / Results / Discussion / etc.)
    and Mira flags rigor problems: weak baselines, missing ablations, absent
    error bars, unjustified n, threats to validity ignored, results that
    overclaim what the design supports.

    Anchored on real ICML/NeurIPS/ICLR reviewer-feedback patterns.
    """

    name = "methodology_editor"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        section: ResearchSection = "full_paper",
    ) -> None:
        super().__init__(client=client, model=model, thinking_budget=thinking_budget)
        self.section = section

    def tools(self) -> list[dict]:
        return []

    def extra_user_context(self) -> str:
        section_labels = {
            "abstract": "the Abstract",
            "introduction": "the Introduction",
            "related_work": "the Related Work / Background section",
            "methods": "the Methods / Methodology section",
            "results": "the Results / Experiments section",
            "discussion": "the Discussion section",
            "conclusion": "the Conclusion",
            "full_paper": "the full paper",
        }
        focus = section_labels.get(self.section, "the full paper")
        return (
            f"Focus your review on {focus}. You may reference any other "
            "section of the paper for context (especially when a Methods "
            "claim is set up in the Intro or paid off in the Results), but "
            f"your critiques should target {focus} specifically."
        )

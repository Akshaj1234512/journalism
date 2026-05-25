from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class CSMLSpecialist(BaseAgent):
    """Cyril. Subject-area specialist for CS / Machine Learning papers.

    Reads the full PDF and reviews against ICML / NeurIPS / ICLR / AAAI
    conventions. Distinct from the Methodology Editor (Mira): Mira flags
    general rigor failures; Cyril flags ML-specific ones (the missing
    ablation table format, the missing reproducibility checklist, the
    novelty bar for the venue, the "are you sure this isn't just scale"
    pattern, etc.).

    The user may pass a target venue (e.g. "ICML 2026", "ICLR workshop")
    which Cyril uses to tune his bar.
    """

    name = "cs_ml_specialist"

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
        return []

    def extra_user_context(self) -> str:
        section_labels = {
            "abstract": "the Abstract",
            "introduction": "the Introduction",
            "related_work": "the Related Work / Background section",
            "methods": "the Methods section",
            "results": "the Results / Experiments section",
            "discussion": "the Discussion section",
            "conclusion": "the Conclusion",
            "full_paper": "the full paper",
        }
        focus = section_labels.get(self.section, "the full paper")
        venue_line = (
            f"The target venue is {self.venue}. Tune your bar to that venue's "
            "norms (novelty, evaluation scope, theoretical content, reproducibility).\n\n"
            if self.venue
            else "The target venue was not specified. Use the ICML / NeurIPS bar as default.\n\n"
        )
        return (
            f"{venue_line}"
            f"You are reviewing as a CS / ML conference reviewer would. Focus "
            f"on {focus} but reference any other section of the paper when "
            "needed (especially when the Results don't deliver what the Intro "
            "promised, or when the Methods omits a comparison the Related "
            "Work section claims is settled)."
        )

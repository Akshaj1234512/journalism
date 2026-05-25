from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class LimitationsEditor(BaseAgent):
    """Lina. Limitations and Broader Impact editor for research papers.

    Reads the full PDF and flags boilerplate Limitations sections, missing
    failure-mode analysis, unacknowledged dataset bias, silent dual-use
    risks, missing IRB / consent disclosure, and generality claims that
    exceed the evidence. ICML / NeurIPS / ICLR require these sections; a
    boilerplate treatment is a known rejection vector.

    Anchored on NeurIPS ethics-review and OpenReview rebuttal patterns.
    """

    name = "limitations_editor"

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
            "abstract": "the Abstract and the generality claims it makes",
            "introduction": "the Introduction and any overbroad framing",
            "related_work": "the Related Work section, including any sub-fields whose limitations are relevant",
            "methods": "the Methods section, especially dataset / data-collection / IRB-relevant claims",
            "results": "the Results section, looking for unstated failure modes and selection biases",
            "discussion": "the Discussion section",
            "conclusion": "the Conclusion, including the Limitations and Broader Impact statements",
            "full_paper": "the full paper, especially the Limitations, Broader Impact, and Ethics statements",
        }
        focus = section_labels.get(self.section, "the full paper")
        return (
            f"Focus your review on {focus}. Always read the Limitations / "
            "Broader Impact / Ethics statements if they exist (often near the "
            "Conclusion or in an appendix), and look at the Methods and "
            "Results for unstated bias, missing failure-mode analysis, and "
            "generality claims that exceed the design. Your bar is the "
            "honesty bar an ethics reviewer at NeurIPS would hold."
        )

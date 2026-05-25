from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class TheoremEditor(BaseAgent):
    """Hugo. Theorem and math-precision editor for research papers.

    Reads theorem statements, proofs, definitions, and equations the way a
    theory-track reviewer reads them. Flags missing assumptions, skipped
    proof steps, vacuous bounds, notation inconsistency, asymptotic-to-
    finite gaps, theory-experiment disagreement, and asymptotic-symbol
    misuse.

    Returns an empty array on empirical-only papers with no central math.
    """

    name = "theorem_editor"

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
            "abstract": "the Abstract, focusing on any quantitative or rate claims",
            "introduction": "the Introduction, focusing on the formal claims and their scope",
            "related_work": "the Related Work section (rare math content; focus on theorem-attribution accuracy)",
            "methods": "the Methods section, including theorem statements and proof sketches",
            "results": "the Results section, focusing on theory-experiment connection",
            "discussion": "the Discussion section",
            "conclusion": "the Conclusion",
            "full_paper": "the full paper, especially theorems, lemmas, definitions, and proofs",
        }
        focus = section_labels.get(self.section, "the full paper")
        return (
            f"Focus your review on {focus}. Anchor critiques to specific "
            "theorem / lemma / equation numbers. If the paper has no formal "
            "mathematical content (no theorems, no proofs, no central "
            "equations), return an empty array. Do not invent theorem "
            "references that are not in the paper."
        )

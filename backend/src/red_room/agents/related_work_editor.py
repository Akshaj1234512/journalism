from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class RelatedWorkEditor(BaseAgent):
    """Rita. Related-work editor for research papers.

    Reads the full PDF and flags missing citations, mis-framed prior work,
    overbroad novelty claims, stale baselines, and concurrent work that the
    authors should be aware of. The single most-cited rejection reason at
    top venues is "this paper does not engage with prior work" — Rita's job
    is to catch that before a reviewer does.

    Anchored on OpenReview rebuttal patterns where citation gaps landed.
    """

    name = "related_work_editor"

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
        # web_search is Rita's highest-leverage tool: she can verify whether
        # a "missing" seminal citation exists with the named authorship, check
        # for concurrent arXiv preprints in the last 12-18 months on the same
        # approach, and confirm the current SOTA on a stated benchmark.
        # Capped at 4 searches because related-work claims often need several
        # targeted lookups.
        return [
            {
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": 4,
            }
        ]

    def extra_user_context(self) -> str:
        section_labels = {
            "abstract": "the Abstract and the novelty claims it makes",
            "introduction": "the Introduction and its positioning against prior work",
            "related_work": "the Related Work / Background section",
            "methods": "the Methods section, especially any claims about prior-work limitations",
            "results": "the Results section, especially baseline choices",
            "discussion": "the Discussion section",
            "conclusion": "the Conclusion",
            "full_paper": "the full paper",
        }
        focus = section_labels.get(self.section, "the full paper")
        return (
            f"Focus your review on {focus}. Look at the whole paper for "
            "context (novelty claims often live in the Abstract and Intro "
            "but the proof or refutation of those claims lives in Related "
            "Work and the choice of baselines in Results), but anchor your "
            f"critiques to {focus}."
        )

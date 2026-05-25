from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import ResearchSection


class FigureTableEditor(BaseAgent):
    """Fern. Figure and table editor for research papers.

    The only editor in the room who reads the paper's visual content
    (architecture diagrams, comparison bar charts, loss curves, results
    tables, qualitative examples). Anthropic's native PDF input gives the
    model access to the rendered figures and tables; Fern is the editor
    that exploits that capability.

    Flags truncated y-axes, missing error bars, cherry-picked qualitative
    examples, bolded winners inside the noise floor, misleading
    aggregations, missing baseline rows, color-deficient palettes, and
    figure / text inconsistencies.
    """

    name = "figure_table_editor"

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
            "abstract": "the Abstract (look at the headline figure if there is one)",
            "introduction": "the Introduction and any teaser / overview figure",
            "related_work": "the Related Work section (rare figures, but check comparison tables)",
            "methods": "the Methods section, especially the architecture diagram",
            "results": "the Results section, including all comparison figures and tables",
            "discussion": "the Discussion section",
            "conclusion": "the Conclusion",
            "full_paper": "every figure and table in the paper",
        }
        focus = section_labels.get(self.section, "every figure and table in the paper")
        return (
            f"Focus your review on the figures and tables in {focus}. You "
            "are reading the actual rendered visuals in the PDF, not just "
            "the captions, so check axes, color choices, error bars, and "
            "the relationship between what each figure shows and what its "
            "caption claims. When you flag a figure or table, name it by "
            "number (e.g. 'Figure 3', 'Table 2') so the user can navigate "
            "directly to it."
        )

from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class ReviewsEditor(BaseAgent):
    """Remy. Reviews specialist for journalism mode. Reads reviews of works
    (books, films, restaurants, albums, theater, art) with the bar a serious
    reviews-section editor holds: clear position on the work stated up top,
    specific evidence from the work (lines, scenes, moments, dishes),
    context relative to the genre / canon / the artist's prior output,
    audience guidance, avoidance of plot summary masquerading as criticism."""

    name = "reviews_editor"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        subject_context: str | None = None,
    ) -> None:
        super().__init__(client=client, model=model, thinking_budget=thinking_budget)
        self.subject_context = (subject_context or "").strip()

    def tools(self) -> list[dict]:
        return []

    def extra_user_context(self) -> str:
        if not self.subject_context:
            return ""
        return (
            "The reviewer pasted in context on the work below.\n\n"
            f"REVIEW CONTEXT:\n{self.subject_context}"
        )

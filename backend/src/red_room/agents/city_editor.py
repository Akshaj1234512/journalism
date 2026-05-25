from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class CityEditor(BaseAgent):
    """Cole. News specialist for journalism mode. Reads straight-news pieces
    the way a city editor at a daily paper does: inverted pyramid, lede that
    delivers the news in the first sentence, clear attribution on every
    factual claim, who-what-when-where-why in the first two grafs."""

    name = "city_editor"

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
            "The reporter pasted in context on the story below. Use it to "
            "judge whether the lede and the first two grafs actually deliver "
            "the news.\n\n"
            f"STORY CONTEXT:\n{self.subject_context}"
        )

from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class FeaturesEditor(BaseAgent):
    """Faye. Features specialist for journalism mode. Reads feature stories
    with the bar a features editor at a magazine or weekend section holds:
    narrative arc that builds tension and pays off, scene-level detail with
    real sensory specifics, characters who do things on the page, avoidance
    of the 'feature about nothing' trap where the prose is lovely but
    nothing actually happens."""

    name = "features_editor"

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
            "The reporter pasted in context on the feature below.\n\n"
            f"FEATURE CONTEXT:\n{self.subject_context}"
        )

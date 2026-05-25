from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class InvestigationsEditor(BaseAgent):
    """Iris. Investigations specialist for journalism mode. Reads accusations
    against named subjects with the bar a serious investigations editor
    holds: paper trail for every claim, two-source minimum on each material
    allegation, explicit right-to-reply attempt, pattern proof rather than
    a single incident treated as systemic."""

    name = "investigations_editor"

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
            "The reporter pasted in context on the investigation below.\n\n"
            f"STORY CONTEXT:\n{self.subject_context}"
        )

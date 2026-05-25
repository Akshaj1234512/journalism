from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class OpinionEditor(BaseAgent):
    """Otto. Opinion / editorial specialist for journalism mode. Reads opinion
    pieces with the bar a serious op-ed editor holds: clear argumentative
    thesis stated up top, fair statement of the strongest opposing view
    before refuting it, explicit separation of fact-claims from opinion-claims,
    closing that lands the argument rather than restating it."""

    name = "opinion_editor"

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
            "The writer pasted in context on the piece below. Use it to "
            "judge whether the argumentative thesis matches what was promised.\n\n"
            f"PIECE CONTEXT:\n{self.subject_context}"
        )

from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class ExplanatoryEditor(BaseAgent):
    """Eli. Analysis / explainer specialist for journalism mode. Reads
    explainers and analytical news pieces with the bar a strong explanatory-
    journalism editor (Vox / NYT Upshot / FiveThirtyEight) holds: clear
    'why this matters' framing in the first three grafs, jargon-vs-clarity
    balance, careful causation-vs-correlation handling, explicit
    acknowledgment of what's still unsettled, anchoring complex concepts
    in concrete examples rather than abstract assertion."""

    name = "explanatory_editor"

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
            "The reporter pasted in context on the analysis below.\n\n"
            f"ANALYSIS CONTEXT:\n{self.subject_context}"
        )

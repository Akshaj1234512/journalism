from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class ProfileEditor(BaseAgent):
    """Pia. Profile specialist for journalism mode. Reads profiles with the
    bar a strong magazine profile editor holds: multi-dimensional portrait
    (not just the official narrative the subject would write themselves),
    direct-observation moments where the writer was actually present,
    tension or paradox in the subject, multiple sources beyond the subject,
    avoidance of hagiography."""

    name = "profile_editor"

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
            "The reporter pasted in context on the profile below — who the "
            "subject is and what the angle is.\n\n"
            f"PROFILE CONTEXT:\n{self.subject_context}"
        )

from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class RhetoricalEditor(BaseAgent):
    name = "rhetorical_editor"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        essay_prompt: str | None = None,
    ) -> None:
        super().__init__(client=client, model=model, thinking_budget=thinking_budget)
        self.essay_prompt = (essay_prompt or "").strip()

    def tools(self) -> list[dict]:
        return []

    def extra_user_context(self) -> str:
        if not self.essay_prompt:
            return ""
        return (
            "The writer pasted in the assignment prompt or rubric below. "
            "Tailor your feedback to what the prompt actually asks for.\n\n"
            f"ASSIGNMENT PROMPT:\n{self.essay_prompt}"
        )

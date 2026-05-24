from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent


class EvidenceQuotation(BaseAgent):
    """Evan. Evidence and quotation handling.

    Runs on Haiku 4.5 by default. Most of Evan's catches are mechanical
    (dropped quotations, missing attribution, paraphrase too close to source),
    which Haiku handles reliably at ~1/3 the cost of Sonnet. Override the
    model in the constructor if you need Sonnet's deeper judgment on a
    specific run.
    """

    name = "evidence_quotation"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
    ) -> None:
        super().__init__(
            client=client,
            model=model or "claude-haiku-4-5-20251001",
            thinking_budget=thinking_budget,
        )

    def tools(self) -> list[dict]:
        return []

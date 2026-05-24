from red_room.agents.base import BaseAgent


class EvidenceQuotation(BaseAgent):
    name = "evidence_quotation"

    def tools(self) -> list[dict]:
        return []

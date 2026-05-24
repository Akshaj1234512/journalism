from red_room.agents.base import BaseAgent


class LogicAuditor(BaseAgent):
    name = "logic_auditor"

    def tools(self) -> list[dict]:
        return []

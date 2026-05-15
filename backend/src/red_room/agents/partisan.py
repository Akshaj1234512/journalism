from red_room.agents.base import BaseAgent


class PartisanChecker(BaseAgent):
    name = "partisan"

    def tools(self) -> list[dict]:
        return []

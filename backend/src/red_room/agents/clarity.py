from red_room.agents.base import BaseAgent


class ClarityCritique(BaseAgent):
    name = "clarity"

    def tools(self) -> list[dict]:
        return []

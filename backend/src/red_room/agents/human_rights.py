from red_room.agents.base import BaseAgent


class HumanRightsAdvocate(BaseAgent):
    name = "human_rights"

    def tools(self) -> list[dict]:
        return []

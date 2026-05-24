from red_room.agents.base import BaseAgent


class Counterargument(BaseAgent):
    name = "counterargument"

    def tools(self) -> list[dict]:
        return []

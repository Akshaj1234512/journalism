from red_room.agents.base import BaseAgent


class ProseStyle(BaseAgent):
    name = "prose_style"

    def tools(self) -> list[dict]:
        return []

from red_room.agents.base import BaseAgent


class ThesisEditor(BaseAgent):
    name = "thesis_editor"

    def tools(self) -> list[dict]:
        return []

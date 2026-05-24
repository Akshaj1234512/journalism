from red_room.agents.base import BaseAgent


class StructureEditor(BaseAgent):
    name = "structure_editor"

    def tools(self) -> list[dict]:
        return []

from red_room.agents.base import BaseAgent


class DataExpert(BaseAgent):
    name = "data_expert"

    def tools(self) -> list[dict]:
        # Peter doesn't need web search for the MVP. Stats verification can
        # come later via a code-execution tool.
        return []

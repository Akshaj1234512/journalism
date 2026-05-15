from red_room.agents.base import BaseAgent


class QuestionMaster(BaseAgent):
    """Sol. Does not flag errors or suggest fixes. Asks the deep, generative
    question the reporter did not think to ask. fix_suggestion and replacement
    are always null in his output; severity is always 'low'."""

    name = "question_master"

    def tools(self) -> list[dict]:
        return []

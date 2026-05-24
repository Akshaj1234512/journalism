from anthropic import AsyncAnthropic

from red_room.agents.base import BaseAgent
from red_room.schemas import EssayType, Mode


# Per-genre framing for Sol. Passed in via extra_user_context so he knows
# which kind of creative-angle question to reach for on this draft.
_GENRE_LABELS: dict[str, str] = {
    "journalism": (
        "a news article. Ask the creative-angle question a reporter would "
        "thank you for: the bigger story around this story, the voice that "
        "is missing, the frame being smuggled in, the second piece on this "
        "beat that this one is pointing toward."
    ),
    "argumentative": (
        "an argumentative essay. Ask questions that help the writer find a "
        "more creative case: the strongest opposing position no one has "
        "named, an unexpected concession that would strengthen rather than "
        "weaken the argument, the reader they most want to reach."
    ),
    "analytical": (
        "an analytical essay. Ask questions that open new interpretive "
        "doors: the second pattern in the text, what the text does NOT do "
        "that would be revealing if it did, the riskier reading the writer "
        "considered and set aside."
    ),
    "narrative": (
        "a personal-narrative essay. Ask questions that push the writer "
        "toward the more specific or stranger story: the smaller moment "
        "they almost wrote about, the perspective they have not tried, the "
        "version of the story where they are the antagonist."
    ),
    "research": (
        "a research essay. Ask questions that open the synthesis: what "
        "question the sources do not ask, what the writer would actually "
        "argue if not constrained by format, where the conversation among "
        "the sources is leading that the paper does not go."
    ),
    "rhetorical": (
        "a rhetorical-analysis essay. Ask questions that deepen the "
        "rhetorical reading: the second audience the speech also addresses, "
        "the speech the speaker did not give, the device the speaker chose "
        "not to use, how the moment would change if it had happened later."
    ),
}


class QuestionMaster(BaseAgent):
    """Sol the Creative Master. Does not flag errors or suggest fixes.
    Asks the creative-opening question that the writer is one step away
    from finding. fix_suggestion and replacement are always null.
    Adapts his questions to the genre via extra_user_context."""

    name = "question_master"

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        mode: Mode = "journalism",
        essay_type: EssayType = "none",
    ) -> None:
        super().__init__(client=client, model=model, thinking_budget=thinking_budget)
        self.mode = mode
        self.essay_type = essay_type

    def tools(self) -> list[dict]:
        return []

    def extra_user_context(self) -> str:
        # Pick the genre key. For essays, prefer the specific essay_type;
        # fall back to a generic essay framing if the writer did not pick.
        if self.mode == "essays":
            key = self.essay_type if self.essay_type in _GENRE_LABELS else "analytical"
        else:
            key = "journalism"
        return f"The draft below is {_GENRE_LABELS[key]}"

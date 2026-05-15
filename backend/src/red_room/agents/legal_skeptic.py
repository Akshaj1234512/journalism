from red_room.agents.base import BaseAgent


class LegalSkeptic(BaseAgent):
    name = "legal_skeptic"

    def tools(self) -> list[dict]:
        # web_search lets Anne look up libel precedent or check whether a
        # named subject has actually been charged. Optional but high value.
        return [
            {
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": 3,
            }
        ]

from red_room.agents.base import BaseAgent


class DataExpert(BaseAgent):
    name = "data_expert"

    def tools(self) -> list[dict]:
        # Peter can fetch the studies and reports a draft links to, so a note
        # like "you cited a study" becomes "I read it, and it does not say
        # that." web_fetch is an Anthropic server-side tool: it only fetches
        # URLs already present in the draft, never ones the model invents.
        # max_uses bounds cost and keeps the server-tool loop short enough
        # that the response never pauses; max_content_tokens caps a large PDF.
        return [
            {
                "type": "web_fetch_20250910",
                "name": "web_fetch",
                "max_uses": 5,
                "max_content_tokens": 10000,
            }
        ]

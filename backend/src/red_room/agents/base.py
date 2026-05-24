from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from pathlib import Path

import yaml
from anthropic import AsyncAnthropic
from anthropic.types import Message

from red_room.schemas import AgentName, Critique


PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
EXEMPLARS_DIR = Path(__file__).resolve().parent.parent / "exemplars"


# Sonnet 4.6 pricing per million tokens (verify at anthropic.com/pricing).
# Cached reads are billed at ~10% of input rate; cache writes at ~125%.
_PRICING_USD_PER_MTOK = {
    "claude-sonnet-4-6": {
        "input": 3.0,
        "output": 15.0,
        "cache_write": 3.75,
        "cache_read": 0.30,
    },
    "claude-opus-4-7": {
        "input": 15.0,
        "output": 75.0,
        "cache_write": 18.75,
        "cache_read": 1.50,
    },
    "claude-haiku-4-5-20251001": {
        "input": 1.0,
        "output": 5.0,
        "cache_write": 1.25,
        "cache_read": 0.10,
    },
}


def estimate_cost_usd(model: str, usage) -> float:
    rates = _PRICING_USD_PER_MTOK.get(model, _PRICING_USD_PER_MTOK["claude-sonnet-4-6"])
    input_tokens = getattr(usage, "input_tokens", 0) or 0
    output_tokens = getattr(usage, "output_tokens", 0) or 0
    cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cost = (
        input_tokens * rates["input"]
        + output_tokens * rates["output"]
        + cache_write * rates["cache_write"]
        + cache_read * rates["cache_read"]
    ) / 1_000_000
    return round(cost, 6)


_MISSING_BLOCK = (
    "# EXEMPLARS\n\nNo exemplars on file yet for this agent. "
    "Follow the OUTPUT CONTRACT in the system prompt exactly.\n"
)

_HEADER = (
    "# EXEMPLARS\n"
    "Each example below is grounded in a real, documented journalism case: "
    "a press-regulator ruling, a published correction, a recognised review "
    "standard, or an editorial-craft source. The `source` line names where "
    "the case or standard comes from. Study the voice and the structure, "
    "and match them. Do not copy the `source` line into your own output; "
    "the article you are reviewing is not a documented case.\n"
)


def _exemplars_to_block(records: list[dict]) -> str:
    """Render a list of exemplar dicts as the system-prompt exemplars block."""
    if not records:
        return _MISSING_BLOCK
    parts = [_HEADER]
    for i, ex in enumerate(records, 1):
        parts.append(f"\n## Example {i}\n")
        if ex.get("source"):
            parts.append(f"GROUNDED IN: {ex['source']}\n")
        parts.append("ARTICLE:\n")
        parts.append(ex["article"])
        parts.append("\n\nCRITIQUES:\n")
        parts.append(json.dumps(ex["critiques"], indent=2))
        parts.append("\n")
    return "".join(parts)


def _load_yaml(path: Path) -> list[dict]:
    """Load exemplars from a YAML file (human-editable canonical format)."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    if not isinstance(raw, list):
        raise ValueError(f"{path}: top-level YAML must be a list of exemplars")
    return raw


def _load_jsonl(path: Path) -> list[dict]:
    """Legacy loader: read one JSON object per line, skip '#' comments."""
    records = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        records.append(json.loads(line))
    return records


def _format_exemplars(path: Path) -> str:
    """Render exemplars as a compact prompt block.

    Prefers a .yaml file at the same stem (human-editable canonical format);
    falls back to .jsonl for legacy storage. A missing file is tolerated so
    a new persona can be wired in before its exemplars are finalized.
    """
    yaml_path = path.with_suffix(".yaml")
    jsonl_path = path.with_suffix(".jsonl")
    if yaml_path.exists():
        return _exemplars_to_block(_load_yaml(yaml_path))
    if jsonl_path.exists():
        return _exemplars_to_block(_load_jsonl(jsonl_path))
    return _MISSING_BLOCK


class BaseAgent(ABC):
    """Shared logic for every persona agent.

    Subclasses set `name` (the AgentName literal) and rely on the
    `prompts/<name>.md` and `exemplars/<name>.jsonl` files existing.
    """

    name: AgentName

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
    ) -> None:
        # Anthropic returns transient 529 "overloaded" errors under load. The
        # SDK retries 429/529 with exponential backoff; give it more headroom
        # than the default 2 so a brief overload spike does not fail a review.
        self.client = client or AsyncAnthropic(max_retries=6)
        self.model = model or os.getenv("RED_ROOM_MODEL", "claude-sonnet-4-6")
        self.thinking_budget = thinking_budget or int(
            os.getenv("RED_ROOM_MAX_THINKING_TOKENS", "2000")
        )

    @property
    def prompt_path(self) -> Path:
        return PROMPTS_DIR / f"{self.name}.md"

    @property
    def exemplars_path(self) -> Path:
        # YAML is the canonical format (human-editable). _format_exemplars
        # transparently falls back to .jsonl if the .yaml is missing.
        return EXEMPLARS_DIR / f"{self.name}.yaml"

    def load_prompt(self) -> str:
        """Read the persona prompt fresh from disk so in-browser edits take
        effect on the next call without restarting uvicorn."""
        return self.prompt_path.read_text(encoding="utf-8")

    @property
    def system_blocks(self) -> list[dict]:
        """Two cache breakpoints: persona prompt, then exemplars.

        Both are reused across articles. Anthropic caches by content hash,
        so editing a prompt invalidates the cache for that agent only.
        """
        return [
            {
                "type": "text",
                "text": self.load_prompt(),
                "cache_control": {"type": "ephemeral"},
            },
            {
                "type": "text",
                "text": _format_exemplars(self.exemplars_path),
                "cache_control": {"type": "ephemeral"},
            },
        ]

    @abstractmethod
    def tools(self) -> list[dict]:
        ...

    def extra_user_context(self) -> str:
        """Optional one-line context prepended to the user message. Override on
        a subclass that needs per-request state (e.g. citation style)."""
        return ""

    async def critique(self, article: str) -> tuple[list[Critique], Message]:
        prefix = self.extra_user_context()
        prefix_block = f"{prefix}\n\n" if prefix else ""
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            thinking={"type": "enabled", "budget_tokens": self.thinking_budget},
            system=self.system_blocks,
            tools=self.tools(),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{prefix_block}"
                        "Review this draft. Return a JSON array of critique "
                        "objects per the OUTPUT CONTRACT in your system "
                        "prompt. Return [] if there are no issues.\n\n"
                        "DRAFT:\n"
                        f"{article}"
                    ),
                }
            ],
        )
        critiques = self._parse_response(response, article)
        return critiques, response

    def _parse_response(self, response: Message, article: str) -> list[Critique]:
        """Extract the JSON array from the model's text output and validate
        each critique. Drops critiques whose `text_quote` is not a literal
        substring of the article — that catches hallucinated quotes before
        the frontend tries to highlight nothing."""
        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text

        payload = _extract_json_array(text)
        if payload is None:
            return []

        results: list[Critique] = []
        for raw in payload:
            try:
                critique = Critique.model_validate(raw)
            except Exception:
                continue
            if critique.text_quote not in article:
                continue
            # Recompute span from article to be safe — the model's offsets
            # are often off-by-one. We trust text_quote and find it ourselves.
            start = article.find(critique.text_quote)
            critique = critique.model_copy(
                update={"span": (start, start + len(critique.text_quote))}
            )
            results.append(critique)
        return results


def _extract_json_array(text: str) -> list | None:
    """Find the first top-level JSON array in the text.

    The model is instructed to return a bare array, but extended thinking can
    occasionally produce stray prose around it. This pulls the first '[' to
    its matching ']' and parses that.
    """
    start = text.find("[")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None

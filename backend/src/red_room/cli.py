from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from red_room import orchestrator


SEVERITY_COLOR = {"high": "\033[91m", "medium": "\033[93m", "low": "\033[96m"}
RESET = "\033[0m"
DIM = "\033[2m"
BOLD = "\033[1m"


def _format(result, article: str) -> str:
    if not result.critiques:
        return f"{DIM}No critiques.{RESET}"
    lines: list[str] = []
    for c in result.critiques:
        color = SEVERITY_COLOR.get(c.severity, "")
        lines.append(f"\n{color}[{c.severity.upper()}] {BOLD}{c.agent}{RESET}{color} — {c.issue_label}{RESET}")
        lines.append(f"  {DIM}quote:{RESET} {c.text_quote}")
        lines.append(f"  {DIM}question:{RESET} {c.question}")
        lines.append(f"  {DIM}why:{RESET} {c.why_it_matters}")
    lines.append(
        f"\n{DIM}─ {len(result.critiques)} critique(s) · "
        f"{result.elapsed_ms}ms · ${result.cost_usd:.4f}{RESET}"
    )
    return "\n".join(lines)


async def _run(article: str, json_out: bool) -> int:
    result = await orchestrator.run(article)
    if json_out:
        print(json.dumps(result.model_dump(), indent=2))
    else:
        print(_format(result, article))
    return 0


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="red-room")
    parser.add_argument("article", nargs="?", help="Path to article file (omit to read stdin)")
    parser.add_argument("--json", action="store_true", help="Emit raw JSON")
    args = parser.parse_args()

    if args.article:
        article = Path(args.article).read_text(encoding="utf-8")
    else:
        article = sys.stdin.read()

    return asyncio.run(_run(article, json_out=args.json))


if __name__ == "__main__":
    raise SystemExit(main())

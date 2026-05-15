"""Run the Legal Skeptic against golden.jsonl and report recall / FP rate.

Usage (from backend/):
    python -m eval.run_eval

Each row in golden.jsonl looks like:
    {"id": ..., "expected": "high"|"medium"|"clean", "article": ...}

A recall hit = the agent flagged at least one critique with severity at least
the expected severity. A false positive = the agent raised any high-severity
flag on an article labeled "clean".
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from red_room.agents.legal_skeptic import LegalSkeptic
from red_room.schemas import Critique


SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3}


def _meets(expected: str, critiques: list[Critique]) -> bool:
    target = SEVERITY_RANK.get(expected, 0)
    return any(SEVERITY_RANK.get(c.severity, 0) >= target for c in critiques)


async def main() -> int:
    load_dotenv()
    here = Path(__file__).resolve().parent
    rows = [json.loads(l) for l in (here / "golden.jsonl").read_text().splitlines() if l.strip()]
    agent = LegalSkeptic()

    recall_hits = recall_total = 0
    fp_articles = 0
    clean_total = 0
    rows_out: list[dict] = []

    for row in rows:
        critiques, _ = await agent.critique(row["article"])
        labels = [c.issue_label for c in critiques]
        passed: bool

        if row["expected"] == "clean":
            clean_total += 1
            high = [c for c in critiques if c.severity == "high"]
            if high:
                fp_articles += 1
            passed = not high
        else:
            recall_total += 1
            hit = _meets(row["expected"], critiques)
            if hit:
                recall_hits += 1
            passed = hit

        rows_out.append({
            "id": row["id"],
            "expected": row["expected"],
            "passed": passed,
            "labels": labels,
            "n_critiques": len(critiques),
        })

    recall = (recall_hits / recall_total) if recall_total else 1.0
    fp_rate = (fp_articles / clean_total) if clean_total else 0.0

    print(json.dumps({
        "recall": round(recall, 3),
        "false_positive_rate": round(fp_rate, 3),
        "rows": rows_out,
    }, indent=2))
    return 0 if recall >= 0.8 and fp_rate <= 0.5 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

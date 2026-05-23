"""Held-out evaluation harness for the Red Room agents — a dev tool.

The exemplar trim left each agent with ~12 ACTIVE exemplars (shown to the
model as few-shot examples) and ~12 commented-out ones. The commented-out
exemplars are not in the prompt, so they are genuine held-out test cases:
real article -> expected-critique pairs the model was never shown.

For each held-out exemplar this runs the agent on the article and checks:
  * flawed exemplar (expected critiques non-empty): did the agent flag the
    same passage?  -> recall
  * clean exemplar  (expected critiques empty): did the agent stay silent?
    -> false-positive rate

It lets you measure whether a prompt change actually helped, instead of
guessing. It does NOT prove production quality: the exemplars are curated
cases, not a random sample of real drafts.

(Supersedes the old single-agent golden.jsonl eval; golden.jsonl is kept
for reference but no longer used here.)

Run from the backend/ directory, with ANTHROPIC_API_KEY available (a
backend/.env is picked up automatically):

  python eval/run_eval.py                 # every agent, every held-out case
  python eval/run_eval.py --agent legal_skeptic
  python eval/run_eval.py --limit 4       # 4 cases per agent (cheaper)

Each case is one agent call (~$0.05). A full run is roughly $3-4.
"""
from __future__ import annotations

import argparse
import asyncio
import json

from dotenv import load_dotenv

from red_room.agents.base import EXEMPLARS_DIR, estimate_cost_usd
from red_room.agents.clarity import ClarityCritique
from red_room.agents.data_expert import DataExpert
from red_room.agents.human_rights import HumanRightsAdvocate
from red_room.agents.legal_skeptic import LegalSkeptic
from red_room.agents.partisan import PartisanChecker
from red_room.agents.question_master import QuestionMaster

load_dotenv()

AGENTS = {
    "legal_skeptic": LegalSkeptic,
    "data_expert": DataExpert,
    "human_rights": HumanRightsAdvocate,
    "clarity": ClarityCritique,
    "partisan": PartisanChecker,
    "question_master": QuestionMaster,
}


def held_out_cases(agent_name: str) -> list[dict]:
    """The commented-out exemplars — held out from the prompt, so a fair test."""
    path = EXEMPLARS_DIR / f"{agent_name}.jsonl"
    if not path.exists():
        return []
    cases: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("#"):
            continue  # active exemplar — it is in the prompt, skip it
        body = line.lstrip("#").strip()
        if not body:
            continue
        try:
            cases.append(json.loads(body))
        except json.JSONDecodeError:
            continue
    return cases


def span_of(article: str, quote: str) -> tuple[int, int] | None:
    idx = article.find(quote)
    return None if idx == -1 else (idx, idx + len(quote))


def overlaps(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return max(a[0], b[0]) < min(a[1], b[1])


async def eval_agent(agent_name: str, limit: int | None) -> dict:
    agent = AGENTS[agent_name]()
    cases = held_out_cases(agent_name)
    if limit is not None:
        cases = cases[:limit]

    flawed = caught = clean = false_pos = 0
    cost = 0.0

    for ex in cases:
        article = ex["article"]
        expected = ex.get("critiques") or []
        try:
            produced, response = await agent.critique(article)
        except Exception as exc:
            print(f"  [{agent_name}] skipped a case after an error: {exc}")
            continue
        cost += estimate_cost_usd(agent.model, response.usage)

        if not expected:
            clean += 1
            if produced:
                false_pos += 1
        else:
            flawed += 1
            exp_spans = [
                s
                for c in expected
                if (s := span_of(article, c.get("text_quote", ""))) is not None
            ]
            prod_spans = [
                s
                for c in produced
                if (s := span_of(article, c.text_quote)) is not None
            ]
            if any(overlaps(e, p) for e in exp_spans for p in prod_spans):
                caught += 1

    return {
        "agent": agent_name,
        "flawed": flawed,
        "caught": caught,
        "clean": clean,
        "false_pos": false_pos,
        "cost": cost,
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="Red Room held-out eval.")
    parser.add_argument(
        "--agent", choices=sorted(AGENTS), help="evaluate one agent only"
    )
    parser.add_argument(
        "--limit", type=int, help="max held-out cases per agent (lowers cost)"
    )
    args = parser.parse_args()

    names = [args.agent] if args.agent else list(AGENTS)
    results = []
    for name in names:
        print(f"Evaluating {name} ...")
        results.append(await eval_agent(name, args.limit))

    print()
    print(f"{'agent':16}  {'recall':>9}  {'false-pos':>10}  {'cost':>8}")
    print("-" * 51)
    total_cost = 0.0
    for r in results:
        recall = f"{r['caught']}/{r['flawed']}" if r["flawed"] else "n/a"
        fp = f"{r['false_pos']}/{r['clean']}" if r["clean"] else "n/a"
        print(f"{r['agent']:16}  {recall:>9}  {fp:>10}  ${r['cost']:>6.3f}")
        total_cost += r["cost"]
    print("-" * 51)
    print(f"{'total':16}  {'':>9}  {'':>10}  ${total_cost:>6.3f}")
    print()
    print("recall    = flawed exemplars where the agent flagged the right passage")
    print("false-pos = clean exemplars the agent wrongly flagged")


if __name__ == "__main__":
    asyncio.run(main())

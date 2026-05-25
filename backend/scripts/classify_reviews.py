"""
Stage 2C: extract review-craft exemplars from Pitchfork reviews. Each review
is a working critic's exhibit; we surface 2-3 specific craft moves per
review as positive exemplars showing what good review writing does.

The exemplar shape differs from the corrective lanes: instead of "this is
broken, here's the fix," the exemplars say "here's a craft move that
works, and here's why it works." The reviews_editor agent can use these
either as positive bar-setting examples (silence on strong reviews) or as
inverted patterns to flag (reviews that LACK these moves).

Input:  /tmp/reviews_corpus.jsonl
Output: /tmp/reviews_classified.jsonl

Run:
    .venv/bin/python scripts/classify_reviews.py [--max 150] [--concurrency 6]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import sys
from pathlib import Path

from anthropic import AsyncAnthropic
from dotenv import load_dotenv


load_dotenv()


SYSTEM_PROMPT = """You read published music / book / film reviews (typically from Pitchfork, NYT Book Review, similar serious outlets) and extract specific review-craft exemplars. Each exemplar captures a craft move the critic made and what it accomplishes.

You are building training material for Remy, a reviews-editor agent who flags review-craft weaknesses (no clear position by graf 3, plot summary masquerading as review, claims about the work with no evidence drawn from it, missing genre / canon context, authorial-intent fallacies, lazy comparisons).

For each review, pull 2-4 distinct craft observations. These can be EITHER:
- Positive: a specific move the review makes that works (a sharp position-take, a quoted line used as evidence, a genre-context sentence that anchors the take). The exemplar shows "this is what the bar looks like."
- Negative: a specific weakness in the review (vague position, lazy comparison, an unsupported craft claim). The exemplar shows "here's what to flag."

For each observation, output one JSON object:

{
  "lane": "reviews_editor",
  "passage": "<a verbatim 1-3 sentence quote from the review where the craft move (good or bad) appears>",
  "issue_label": "<2-5 words capturing the craft move, e.g. 'sharp position by graf 2', 'specific quoted line as evidence', 'lazy comparison X meets Y', 'authorial-intent fallacy'>",
  "question": "<observation in the voice of a working reviews editor. Terse, specific. Name what the move accomplishes (positive) or what it fails to accomplish (negative). 1-3 sentences max. Do not paraphrase the review's content — that's not the point. The point is the craft move.>",
  "why_it_matters": "<one sentence on what the move adds (or what its absence costs).>",
  "fix_suggestion": "<for negative observations: the craft move that would replace the weakness. For positive observations: the lesson a writer trying the same move should remember. Null if nothing concrete to say.>",
  "severity": "<for negative observations: high if load-bearing; medium for clear flaw; low for polish. For positive observations: use 'medium' as the default.>"
}

Output a JSON array. No prose around it. Empty array if the review is too short / too marketing-y to yield craft material.

Important: capture the critic's actual sentences in `passage`. The reviews_editor will use these to anchor its own critiques later, so they need to be real.
"""


def parse_array(text: str) -> list[dict]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
    matches = list(re.finditer(r"\[(?:.|\n)*?\]", text))
    for m in reversed(matches):
        try:
            out = json.loads(m.group(0))
            if isinstance(out, list):
                return out
        except json.JSONDecodeError:
            continue
    return []


async def classify_one(client, item, sem):
    async with sem:
        try:
            body = (item.get("body_text") or "")[:12000]
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Source: {item.get('source')}\n"
                        f"URL: {item.get('url')}\n"
                        f"Title: {item.get('title','')[:200]}\n"
                        f"Rating: {item.get('rating','?')}/10\n\n"
                        f"Review body:\n{body}"
                    ),
                }],
            )
        except Exception as e:
            print(f"  api err {item.get('url','?')[-40:]}: {e}", file=sys.stderr)
            return []
        text = "".join(b.text for b in msg.content if b.type == "text")
        out = parse_array(text)
        for c in out:
            c["_url"] = item.get("url")
            c["_source"] = item.get("source")
            c["_title"] = item.get("title", "")[:200]
            c["_rating"] = item.get("rating", "")
        return out


async def main_async(max_items: int, concurrency: int):
    client = AsyncAnthropic()
    items = [json.loads(l) for l in Path("/tmp/reviews_corpus.jsonl").read_text().splitlines() if l.strip()]
    random.seed(42)
    random.shuffle(items)
    items = items[:max_items]
    print(f"Classifying {len(items)} reviews (concurrency {concurrency})...",
          file=sys.stderr)

    sem = asyncio.Semaphore(concurrency)
    tasks = [classify_one(client, it, sem) for it in items]
    out_path = Path("/tmp/reviews_classified.jsonl")

    done = 0
    with out_path.open("w") as f:
        for fut in asyncio.as_completed(tasks):
            critiques = await fut
            for c in critiques:
                f.write(json.dumps(c) + "\n")
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(items)}", file=sys.stderr)

    total = sum(1 for _ in out_path.read_text().splitlines() if _.strip())
    print(f"\nDone. {total} review-craft critiques → {out_path}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=150)
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr); sys.exit(1)
    asyncio.run(main_async(args.max, args.concurrency))


if __name__ == "__main__":
    main()

"""
Stage 2B: parse each scraped craft-criticism article into individual editor-
room critique exemplars and classify each by journalism lane.

Input:  /tmp/journalism_craft.jsonl (from ingest_journalism_craft.py)
Output: /tmp/journalism_craft_classified.jsonl

Each input article is itself written by a journalism critic (Nieman / Slate
columnist) analyzing another journalist's work. We extract the EDITOR-ROOM
OBSERVATIONS embedded in it: each one identifies a specific piece of
journalism craft that worked (or didn't), with the critic's own wording.

Run:
    .venv/bin/python scripts/classify_journalism_craft.py
        [--max 250] [--concurrency 6]
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


LANES = [
    "legal_skeptic",
    "data_expert",
    "human_rights",
    "partisan",
    "city_editor",
    "investigations_editor",
    "opinion_editor",
    "features_editor",
    "profile_editor",
    "reviews_editor",
    "explanatory_editor",
]


SYSTEM_PROMPT = f"""You read journalism-criticism articles (typically by Nieman Storyboard, Slate Press Box, or similar veteran editors analyzing another journalist's published work) and extract individual editor-room observations as training exemplars.

These are real editorial-room critiques written by working journalists about specific published journalism. Your job is to pull out 2-5 specific observations the critic makes about the craft of the piece they're analyzing.

# Editor lanes

For each observation, classify which kind of journalism editor would most naturally surface that concern:

- legal_skeptic: factual claims with libel / defamation exposure
- data_expert: quantitative or statistical claims that are wrong or misleading
- human_rights: source-protection / privacy / consent / dignity concerns
- partisan: one-sided framing, loaded adjectives, asymmetric treatment, buried rebuttal
- city_editor: news-desk craft - lede, attribution, nut graf, headline-lede mismatch, 5W gaps
- investigations_editor: document trail, corroboration count, right-to-reply, pattern vs single incident
- opinion_editor: opinion-piece craft - thesis, strawman, fact-vs-opinion, goalpost moves, kicker
- features_editor: feature craft - narrative arc, scene-level writing, sensory specificity, kicker, "feature about nothing"
- profile_editor: profile craft - official-narrative trap, outside voices, direct observation, hagiography
- reviews_editor: review craft - position clarity, specific evidence from work, genre context, plot summary
- explanatory_editor: explainer craft - "why this matters", causation vs correlation, jargon, concrete example

# Output

For each observation, output one JSON object:

{{
  "lane": "<one of the 11 lanes above>",
  "passage": "<the specific journalism the critic was analyzing — a quoted line, sentence, or phrase from the original piece if the critic quotes one, OR a precise description of the journalism move (e.g. 'The opening lede that buries the announcement in graf 4'). 1-3 sentences max.>",
  "issue_label": "<2-5 words capturing the observation, e.g. 'opens with scene that earns the abstraction', 'kicker that lands a small specific gesture', 'sensory detail anchored in one moment'>",
  "question": "<the critic's observation in their voice. Preserve their wording. Can be a positive observation about what works OR a negative one about what fails — both are useful as exemplars. 1-4 sentences max.>",
  "why_it_matters": "<one sentence on what the craft move accomplishes (or fails to accomplish)>",
  "fix_suggestion": "<the lesson for a writer trying the same move, or null if no clear takeaway>",
  "severity": "<high if the observation names a load-bearing flaw; medium for a notable craft move; low for nuance>"
}}

Output a JSON array. No prose around it. Empty array if the article is too meta (about journalism in general, not a specific piece).

IMPORTANT: pull the critic's actual wording into `question` and `why_it_matters`. The point of this exercise is to capture how working editors talk, not to paraphrase them in AI-summary voice.
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
            # Body text can be very long — pass first ~16k chars (about
            # 4000 tokens). Most craft critiques surface their key
            # observations in the first half of the article anyway.
            body = (item.get("body_text") or "")[:16000]
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Source: {item.get('source')}\n"
                        f"URL: {item.get('url')}\n"
                        f"Title: {item.get('title','')[:200]}\n\n"
                        f"Article body:\n{body}"
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
        return out


async def main_async(max_items: int, concurrency: int):
    client = AsyncAnthropic()
    items = [json.loads(l) for l in Path("/tmp/journalism_craft.jsonl").read_text().splitlines() if l.strip()]
    random.seed(42)
    random.shuffle(items)
    items = items[:max_items]
    print(f"Classifying {len(items)} craft articles (concurrency {concurrency})...",
          file=sys.stderr)

    sem = asyncio.Semaphore(concurrency)
    tasks = [classify_one(client, it, sem) for it in items]
    out_path = Path("/tmp/journalism_craft_classified.jsonl")

    done = 0
    with out_path.open("w") as f:
        for fut in asyncio.as_completed(tasks):
            critiques = await fut
            for c in critiques:
                f.write(json.dumps(c) + "\n")
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(items)}", file=sys.stderr)

    counts: dict[str, int] = {}
    for line in out_path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            c = json.loads(line)
        except json.JSONDecodeError:
            continue
        counts[c.get("lane", "?")] = counts.get(c.get("lane", "?"), 0) + 1
    print("\nLane distribution (craft sources):", file=sys.stderr)
    for lane in LANES:
        print(f"  {lane:24s} {counts.get(lane, 0)}", file=sys.stderr)
    other = sum(v for k, v in counts.items() if k not in LANES)
    print(f"  (other:                   {other})", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=250)
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr); sys.exit(1)
    asyncio.run(main_async(args.max, args.concurrency))


if __name__ == "__main__":
    main()

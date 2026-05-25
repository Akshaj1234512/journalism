"""
Stage 2 for journalism: parse each PolitiFact fact-check into 1-3 individual
critiques, classify each into one of the 11 journalism editor lanes.

Input:  /tmp/journalism_filtered.jsonl
Output: /tmp/journalism_classified.jsonl

We classify into:
- legal_skeptic (Anne): factual claims with libel / defamation exposure
- data_expert (Peter): quantitative / statistical / poll claims
- human_rights (Joe): source-protection / privacy / consent issues
- partisan (Parker): one-sided framing, loaded language, smear
- city_editor (Cole): news-desk craft — buried lede, weak attribution
- investigations_editor (Iris): document trail / corroboration / right-to-reply
- opinion_editor (Otto): opinion-piece craft — thesis, strawman, fact-vs-opinion
- features_editor (Faye): feature craft — narrative, scene, sensory detail
- profile_editor (Pia): profile craft — official-narrative, hagiography
- reviews_editor (Remy): review craft — position, evidence from work, genre context
- explanatory_editor (Eli): explainer craft — why-this-matters, jargon, causation

Most LIAR fact-checks will skew to Anne and Peter (factual claims about
people / numbers). Some will surface partisan-framing or evidence-handling
patterns that map to Parker / Iris. That's fine — diverse classification
across the corpus is the point.

Run:
    .venv/bin/python scripts/classify_journalism.py
        [--max-items 600]
        [--concurrency 8]
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


SYSTEM_PROMPT = f"""You read PolitiFact-style fact-checks and convert them into training exemplars for journalism-feedback agents. Each fact-check contains a CLAIM (something a public figure said) and an EXPLAIN section (PolitiFact's full reasoning).

Your job: extract 1-3 distinct critique exemplars from each fact-check. Each exemplar should isolate one specific journalism failing the claim or the surrounding reporting exhibits, classify it into one of 11 editor lanes, and reproduce the critique in the fact-checker's voice (terse, evidence-anchored, slightly skeptical).

# Editor lanes

- legal_skeptic: criminal verbs / accusations / specific factual harm to a named person without proven evidence; defamation-shape claims
- data_expert: statistical or quantitative claims that are wrong, misleading, cherry-picked, or use bad denominators / time-frames / comparisons
- human_rights: source-protection / privacy / consent / dignity-of-subject failures (rare in fact-check data; mostly skip)
- partisan: one-sided framing, loaded adjectives, smear-by-association, asymmetric treatment of parties
- city_editor: news-desk craft issues - buried lede, vague attribution, headline-lede mismatch
- investigations_editor: document trail / corroboration / right-to-reply / pattern-from-one-incident
- opinion_editor: opinion-piece craft - no clear thesis, strawman opposing view, contested fact dressed as opinion, goalpost moves
- features_editor: feature craft (rare in fact-check data; mostly skip)
- profile_editor: profile craft (rare in fact-check data; mostly skip)
- reviews_editor: review craft (rare; skip unless explicitly a review)
- explanatory_editor: explainer craft - missing why-this-matters, causation-from-correlation, abstract-with-no-example, jargon without definition

# Output

For each critique extracted, output one JSON object:

{{
  "lane": "<one of the 11 lanes above>",
  "passage": "<verbatim quote from the CLAIM or EXPLAIN section — 1-3 sentences max. Use the CLAIM text when the critique is about what was said; use a quoted passage from EXPLAIN when the critique is about the fact-checker's analysis of context>",
  "issue_label": "<2-5 words capturing the issue (e.g. 'wrong denominator', 'unsubstantiated criminal verb', 'loaded framing')>",
  "question": "<critique in real-fact-checker voice. Terse, anchored to a specific number or claim element, slightly skeptical. 1-4 sentences max. Preserve the source's wording where possible.>",
  "why_it_matters": "<one sentence on what the gap costs the claim's credibility>",
  "fix_suggestion": "<concrete fix the reporter could implement, or null if no fix obvious>",
  "severity": "<high if a clear false / harmful claim; medium for misleading framing; low for polish>"
}}

Output a JSON array. No prose around it. Empty array if you can't extract usable critiques. Skip fact-checks that are purely political back-and-forth without clear journalistic-craft lessons.
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
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": (
                        f"PolitiFact ruling: {item['label']}\n\n"
                        f"CLAIM: {item['claim']}\n\n"
                        f"EXPLAIN:\n{item['explain']}"
                    ),
                }],
            )
        except Exception as e:
            print(f"  api err {item.get('event_id')}: {e}", file=sys.stderr)
            return []
        text = "".join(b.text for b in msg.content if b.type == "text")
        out = parse_array(text)
        for c in out:
            c["_event_id"] = item.get("event_id")
            c["_source"] = item.get("source")
            c["_label"] = item.get("label")
            c["_claim"] = item.get("claim")
        return out


async def main_async(max_items: int, concurrency: int):
    client = AsyncAnthropic()
    items = [json.loads(l) for l in Path("/tmp/journalism_filtered.jsonl").read_text().splitlines() if l.strip()]
    random.seed(42)
    random.shuffle(items)
    items = items[:max_items]
    print(f"Classifying {len(items)} fact-checks (concurrency {concurrency})...",
          file=sys.stderr)

    sem = asyncio.Semaphore(concurrency)
    tasks = [classify_one(client, it, sem) for it in items]
    out_path = Path("/tmp/journalism_classified.jsonl")

    done = 0
    with out_path.open("w") as f:
        for fut in asyncio.as_completed(tasks):
            critiques = await fut
            for c in critiques:
                f.write(json.dumps(c) + "\n")
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(items)}", file=sys.stderr)

    # lane distribution
    counts: dict[str, int] = {}
    for line in out_path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            c = json.loads(line)
        except json.JSONDecodeError:
            continue
        counts[c.get("lane", "?")] = counts.get(c.get("lane", "?"), 0) + 1
    print("\nLane distribution:", file=sys.stderr)
    for lane in LANES:
        print(f"  {lane:24s} {counts.get(lane, 0)}", file=sys.stderr)
    other = sum(v for k, v in counts.items() if k not in LANES)
    print(f"  (other:                   {other})", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-items", type=int, default=600)
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr); sys.exit(1)
    asyncio.run(main_async(args.max_items, args.concurrency))


if __name__ == "__main__":
    main()

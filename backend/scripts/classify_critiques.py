"""
Stage 2: parse each filtered review into individual critiques and classify
each by lane (which of the 7 research editors should own it). Uses Claude
Haiku for cost efficiency.

Input:  /tmp/openreview_filtered.jsonl (from ingest_openreview.py)
Output: /tmp/openreview_classified.jsonl (one critique per line)

Run:
    .venv/bin/python scripts/classify_critiques.py
        [--in /tmp/openreview_filtered.jsonl]
        [--out /tmp/openreview_classified.jsonl]
        [--max-reviews 400]
        [--concurrency 8]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

from anthropic import AsyncAnthropic
from dotenv import load_dotenv


load_dotenv()

LANES = [
    "methodology",        # missing baselines, ablations, error bars, test-set leakage
    "related_work",       # missing citations, concurrent work, novelty overclaim
    "limitations",        # boilerplate impact, dataset bias, dual-use silence, generality
    "figures_tables",     # truncated axis, missing error bars, cherry-pick, misleading agg
    "theorem_math",       # missing assumption, vacuous bound, notation, proof gaps
    "format",             # page budget, anonymization, template, missing sections
    "cs_ml_specific",     # venue novelty bar, scale confound, LLM eval pitfalls, ablation table conventions
]


SYSTEM_PROMPT = f"""You parse ICLR reviewer comments into individual critiques and classify each by lane.

Lanes:
- methodology: rigor failures (missing baselines, missing ablations, no error bars, test-set leakage, cherry-picked benchmarks, n too small, confounded comparisons, overclaiming relative to design)
- related_work: missing citations, concurrent work the authors should know, overbroad novelty claims, stale state-of-the-art, mischaracterized prior work
- limitations: boilerplate Limitations / Broader Impact, missing failure-mode analysis, dataset bias unacknowledged, dual-use silence, missing IRB / consent, generality claims exceeding evidence
- figures_tables: truncated y-axis, missing error bars in plots, cherry-picked qualitative examples, bolded winners inside noise, misleading aggregations, missing baseline rows, color choices, architecture diagram vs text mismatch, unreadable figure typography
- theorem_math: missing assumption in a theorem, skipped proof step, vacuous bound, convergence mode unspecified, notation inconsistency, asymptotic-to-finite gap, theory contradicts experiment, Big-O misuse, probability space ambiguity, non-standard definition
- format: page budget mis-allocation, broken anonymization, missing required section (Limitations / Broader Impact / Reproducibility), wrong template, load-bearing content in appendix, reference-list issues, tables placed far from references
- cs_ml_specific: venue novelty bar mismatch, scale confound (gain just from bigger model), LLM evaluation pitfalls (prompt sensitivity, contamination), reproducibility checklist gaps, ablation table convention violations, architecture precision, evaluation regime mismatch

For each individual critique in the reviewer's "weaknesses" text, output one JSON object. Skip the critique if it doesn't fit any lane cleanly, is purely a clarifying question (those belong to Questions, not Weaknesses), or is vague ("the writing could be improved" with no specifics).

For each critique, output:
{{
  "lane": "<one of {LANES}>",
  "paper_passage": "<the text from the paper being critiqued — extract from quoted text in the review, or from a paraphrase like 'the authors claim X'. If the reviewer only references a section/figure/table number, use that anchor (e.g. 'Section 4.2', 'Figure 3', 'Table 1 caption'). 1-2 sentences max.>",
  "issue_label": "<2-5 words capturing the issue, e.g. 'missing recent baseline' or 'truncated y-axis Fig 3'>",
  "question": "<the reviewer's critique in their original voice. Preserve their wording, terseness, and tone. Do not soften or expand. 1-4 sentences max.>",
  "why_it_matters": "<one sentence on what the gap costs the paper, synthesized if not stated by the reviewer>",
  "fix_suggestion": "<the fix the reviewer proposed, in their voice, OR null if no fix was given>",
  "severity": "<high if the reviewer flagged this as a blocking issue or rated the paper low; medium for a major concern; low for polish>"
}}

Output a JSON array. No prose around it. Empty array if no usable critiques.
"""


def parse_array(text: str) -> list[dict]:
    """Pull the first `[ ... ]` array from the model's text and parse it."""
    text = text.strip()
    if text.startswith("```"):
        # strip code fence
        text = re.sub(r"^```[a-z]*\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
    m = re.search(r"\[(.|\n)*\]", text)
    if not m:
        return []
    try:
        out = json.loads(m.group(0))
        return out if isinstance(out, list) else []
    except json.JSONDecodeError:
        return []


async def classify_one(
    client: AsyncAnthropic,
    review: dict,
    semaphore: asyncio.Semaphore,
) -> list[dict]:
    """Send one review to Haiku; return list of classified critiques."""
    async with semaphore:
        try:
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Review rating: {review['rating']}/10, "
                        f"confidence: {review['confidence']}/5. "
                        f"Paper summary: {review.get('summary', '')[:400]}\n\n"
                        f"Weaknesses:\n{review['weaknesses']}"
                    ),
                }],
            )
        except Exception as e:
            print(f"  api error on review {review['review_id']}: {e}",
                  file=sys.stderr)
            return []

        text = ""
        for block in msg.content:
            if block.type == "text":
                text += block.text
        critiques = parse_array(text)
        # tag each with provenance
        for c in critiques:
            c["_source_review_id"] = review["review_id"]
            c["_source_submission_id"] = review["submission_id"]
            c["_source_rating"] = review["rating"]
            c["_source_confidence"] = review["confidence"]
        return critiques


async def main_async(in_path: Path, out_path: Path, max_reviews: int, concurrency: int):
    client = AsyncAnthropic()
    reviews = [json.loads(line) for line in in_path.read_text().splitlines() if line.strip()]
    if max_reviews and len(reviews) > max_reviews:
        # take an evenly-spaced sample to avoid biasing toward the start of the file
        step = len(reviews) // max_reviews
        reviews = reviews[::step][:max_reviews]
    print(f"Classifying {len(reviews)} reviews with concurrency {concurrency}...",
          file=sys.stderr)

    sem = asyncio.Semaphore(concurrency)
    tasks = [classify_one(client, r, sem) for r in reviews]

    done = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        for fut in asyncio.as_completed(tasks):
            critiques = await fut
            for c in critiques:
                f.write(json.dumps(c) + "\n")
            done += 1
            if done % 25 == 0:
                print(f"  classified {done}/{len(reviews)} reviews",
                      file=sys.stderr)

    # quick lane-distribution report
    lane_counts: dict[str, int] = {}
    for line in out_path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            c = json.loads(line)
        except json.JSONDecodeError:
            continue
        lane = c.get("lane", "?")
        lane_counts[lane] = lane_counts.get(lane, 0) + 1
    print("\nLane distribution:", file=sys.stderr)
    for lane in LANES:
        print(f"  {lane:18s} {lane_counts.get(lane, 0)}", file=sys.stderr)
    print(f"  (other:           {sum(v for k, v in lane_counts.items() if k not in LANES)})",
          file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default="/tmp/openreview_filtered.jsonl")
    ap.add_argument("--out", default="/tmp/openreview_classified.jsonl")
    ap.add_argument("--max-reviews", type=int, default=400,
                    help="Cap on reviews to classify (cost control).")
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    asyncio.run(main_async(
        Path(args.in_path),
        Path(args.out),
        args.max_reviews,
        args.concurrency,
    ))


if __name__ == "__main__":
    main()

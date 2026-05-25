"""
Stage 2 for essay-mode editors: parse each essay into individual critique
candidates and classify each into one of 12 essay-editor lanes.

Input:  /tmp/essays_filtered.jsonl (from ingest_essays.py)
Output: /tmp/essays_classified.jsonl (one critique per line)

Uses Claude Haiku 4.5 for cost. The model is given the full essay + its
score + (where present) the official rater commentary, and asked to pull
2-4 concrete passages with specific critiques anchored on the editor lane.

Run:
    .venv/bin/python scripts/classify_essay_critiques.py
        [--in /tmp/essays_filtered.jsonl]
        [--out /tmp/essays_classified.jsonl]
        [--max-essays 600]
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

# Essay-mode editor lanes. Keep names aligned with backend AgentName enum.
LANES = [
    "thesis_editor",       # Theo — weak thesis / unclear claim / missing position
    "prose_style",         # Will — sentence-level prose, wordiness, voice
    "structure_editor",    # Stella — paragraph order, transitions, missing nut graf
    "logic_auditor",       # Logan — logical gap, weak rebuttal, non-sequitur
    "evidence_quotation",  # Evan — evidence integration, weak citation, no warrant
    "citation_editor",     # Kate — citation FORMAT (MLA/APA/Chicago) — rare in this corpus
    "argumentative_editor", # Ari — argumentative-essay-specific weaknesses
    "analytical_editor",   # Anya — analytical-essay-specific (literary/scientific analysis)
    "narrative_editor",    # Nora — narrative arc, scene, voice, sensory detail
    "research_editor",     # Reese — research-essay-specific (synthesis, source handling)
    "rhetorical_editor",   # Rhea — rhetorical-analysis (devices, audience, kairos)
    # Sol (question_master) is excluded — he asks, doesn't flag, different schema.
]


SYSTEM_PROMPT = f"""You parse student essays for use as training exemplars for writing-feedback agents. For each essay you read, you identify 2-4 distinct passages that exhibit specific weaknesses, classify each weakness into one of 11 editor lanes, and write a critique in the voice of a real writing teacher or AP/GRE rater.

# Editor lanes

- thesis_editor: weak thesis, vague position, missing claim, thesis that doesn't predict the essay structure
- prose_style: sentence-level issues — wordiness, passive voice where active is stronger, weak verbs, hedging, choppy or run-on sentences, redundant phrasing
- structure_editor: paragraph order, missing topic sentences, transitions that don't carry the argument, buried nut graf, weak conclusion that just restates
- logic_auditor: logical gaps, non-sequiturs, false dichotomies, unaddressed counter-argument, claim-evidence mismatch, circular reasoning
- evidence_quotation: evidence weakly integrated (dropped quote, missing analysis after a quote), no warrant connecting evidence to claim, generic example where specific is needed
- citation_editor: citation format issues (MLA/APA/Chicago) — only flag if the essay shows formal citations. Rare in this corpus; usually skip.
- argumentative_editor: argumentative-essay weaknesses — claim isn't actually arguable, counter-argument unaddressed, evidence not specific to argument
- analytical_editor: analytical-essay weaknesses — analysis that just summarizes, no explicit analytical move, observation without insight
- narrative_editor: narrative weaknesses — telling instead of showing, no scene-level detail, weak sensory imagery, narrative arc collapses, voice inconsistent
- research_editor: research-essay weaknesses — source dropped without synthesis, multiple sources not put in conversation, no original synthesis
- rhetorical_editor: rhetorical-analysis weaknesses — device-spotting without effect, missing audience/kairos, ethos/pathos/logos as labels not analysis

# Tone

Write critiques in the voice of a real teacher who has read 200 essays this semester. Direct, anchored to a specific passage, slightly formal but conversational. Avoid AI-summary cadence ("This passage demonstrates a weakness in..."). Prefer reviewer-voice ("Where's the verb?", "This sentence does two things — split it.", "The claim and the evidence are doing different work.").

# Output

For each passage you identify, output one JSON object:

{{
  "lane": "<one of the 11 lanes above>",
  "passage": "<the exact passage from the essay, verbatim. 1-3 sentences max.>",
  "issue_label": "<2-5 words capturing the issue (e.g. 'buried thesis', 'dropped quote', 'no warrant', 'telling not showing')>",
  "question": "<the critique in real-teacher voice. Anchored to the specific passage. 1-3 sentences max.>",
  "why_it_matters": "<one sentence on what the weakness costs the essay's effect>",
  "fix_suggestion": "<one or two concrete sentences proposing a fix; null if no obvious fix>",
  "severity": "<high if a load-bearing weakness; medium for a clear concern; low for polish>"
}}

Output a JSON array. No prose around it. Empty array if you can't find substantive critiques. Skip generic / pedagogical critiques that could apply to any essay; flag only what is specific to THIS passage.
"""


def parse_array(text: str) -> list[dict]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
    # Prefer last array; sometimes the model writes reasoning before the JSON.
    matches = list(re.finditer(r"\[(?:.|\n)*?\]", text))
    for m in reversed(matches):
        try:
            out = json.loads(m.group(0))
            if isinstance(out, list):
                return out
        except json.JSONDecodeError:
            continue
    return []


def make_user_message(essay: dict) -> str:
    src = essay.get("source", "?")
    score = essay.get("holistic_score")
    max_score = essay.get("holistic_max")
    traits = essay.get("traits") or {}
    weak = essay.get("weak_traits") or []
    commentary = essay.get("scorer_commentary") or ""
    genre = essay.get("genre_hint", "")
    prompt = essay.get("assignment") or essay.get("prompt_name") or ""

    parts = [
        f"Source: {src}",
        f"Genre hint: {genre}",
        f"Holistic score: {score}/{max_score}" if score else "Holistic score: (unscored)",
    ]
    if traits:
        kv = ", ".join(f"{k}={v}" for k, v in traits.items() if v is not None)
        parts.append(f"Trait scores: {kv}")
    if weak:
        parts.append(f"Weak traits flagged: {', '.join(weak)}")
    if prompt:
        parts.append(f"Prompt: {prompt[:400]}")
    if commentary:
        parts.append(f"\nOfficial rater commentary (use this as grounding when picking passages):\n{commentary[:1200]}")
    parts.append(f"\nEssay:\n{essay['text']}")
    return "\n".join(parts)


async def classify_one(
    client: AsyncAnthropic,
    essay: dict,
    sem: asyncio.Semaphore,
) -> list[dict]:
    async with sem:
        try:
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": make_user_message(essay)}],
            )
        except Exception as e:
            print(f"  api err on {essay.get('essay_id')}: {e}", file=sys.stderr)
            return []
        text = "".join(b.text for b in msg.content if b.type == "text")
        out = parse_array(text)
        for c in out:
            c["_essay_id"] = essay.get("essay_id")
            c["_source"] = essay.get("source")
            c["_score"] = essay.get("holistic_score")
            c["_score_max"] = essay.get("holistic_max")
            c["_genre_hint"] = essay.get("genre_hint")
        return out


def stratified_sample(essays: list[dict], target: int) -> list[dict]:
    """Sample so each source contributes proportionally to its volume but
    smaller sources are over-represented (sqrt scaling). This pulls more
    from GRE/ASAP-narrative/ELL where each essay has higher per-essay
    signal, while still drawing the bulk from PERSUADE/AES2."""
    by_source: dict[str, list[dict]] = {}
    for e in essays:
        by_source.setdefault(e.get("source", "?"), []).append(e)

    import math
    weights = {k: math.sqrt(len(v)) for k, v in by_source.items()}
    total_weight = sum(weights.values())
    out = []
    for k, group in by_source.items():
        n = max(1, int(round(target * weights[k] / total_weight)))
        n = min(n, len(group))
        random.shuffle(group)
        out.extend(group[:n])
    random.shuffle(out)
    return out[:target]


async def main_async(in_path: Path, out_path: Path, max_essays: int, concurrency: int):
    client = AsyncAnthropic()
    essays = [json.loads(line) for line in in_path.read_text().splitlines() if line.strip()]
    random.seed(42)
    sample = stratified_sample(essays, max_essays)
    print(f"Sampled {len(sample)} essays for classification (concurrency {concurrency})",
          file=sys.stderr)
    src_breakdown: dict[str, int] = {}
    for e in sample:
        src_breakdown[e.get("source", "?")] = src_breakdown.get(e.get("source", "?"), 0) + 1
    print(f"  by source: {src_breakdown}", file=sys.stderr)

    sem = asyncio.Semaphore(concurrency)
    tasks = [classify_one(client, e, sem) for e in sample]

    done = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        for fut in asyncio.as_completed(tasks):
            critiques = await fut
            for c in critiques:
                f.write(json.dumps(c) + "\n")
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(sample)}", file=sys.stderr)

    # lane distribution
    counts: dict[str, int] = {}
    for line in out_path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            c = json.loads(line)
        except json.JSONDecodeError:
            continue
        lane = c.get("lane", "?")
        counts[lane] = counts.get(lane, 0) + 1
    print("\nLane distribution:", file=sys.stderr)
    for lane in LANES:
        print(f"  {lane:22s} {counts.get(lane, 0)}", file=sys.stderr)
    other = sum(v for k, v in counts.items() if k not in LANES)
    print(f"  (other:                 {other})", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default="/tmp/essays_filtered.jsonl")
    ap.add_argument("--out", default="/tmp/essays_classified.jsonl")
    ap.add_argument("--max-essays", type=int, default=600)
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main_async(Path(args.in_path), Path(args.out),
                           args.max_essays, args.concurrency))


if __name__ == "__main__":
    main()

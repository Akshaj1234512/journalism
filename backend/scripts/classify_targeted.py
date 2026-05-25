"""
Targeted second-pass classification for the 2 lanes that came up empty in
the general pass (rhetorical_editor, research_editor). We re-classify a
focused subset of the corpus with prompts specifically tuned to surface
these patterns.

- rhetorical_editor: re-classify GRE Issue + GRE Argument essays. Both
  tasks are rhetorical at their core (Issue = build a rhetorical case;
  Argument = analyze the rhetorical structure of someone else's case).

- research_editor: re-classify the PERSUADE essays that are *source-based*
  (PERSUADE marks these as Task='Text dependent'). Source-based essays
  involve synthesizing multiple sources — which is exactly the
  research-editor lane.

Output appends to /tmp/essays_classified.jsonl so build_essay_exemplars.py
sees everything in one pool.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from pathlib import Path

from anthropic import AsyncAnthropic
from dotenv import load_dotenv

load_dotenv()


SYSTEM_RHETORICAL = """You are reading student writing for use as exemplars for Rhea, a rhetorical-editor agent. Rhea reads essays as rhetorical analyses — looking for device-spotting without effect-analysis, missing audience/kairos, 'ethos / pathos / logos' used as labels rather than analyzed work, conclusions that restate instead of landing, weak rhetorical positioning.

Pull 2-4 passages from this essay that exhibit one of these patterns. Each output object should look like:

{
  "lane": "rhetorical_editor",
  "passage": "<verbatim 1-3 sentences from the essay>",
  "issue_label": "<2-5 words>",
  "question": "<critique in real writing-teacher voice — terse, specific>",
  "why_it_matters": "<one sentence>",
  "fix_suggestion": "<concrete fix or null>",
  "severity": "<high|medium|low>"
}

Return a JSON array. Skip the essay entirely (return []) if it really doesn't have rhetorical-analysis critique material."""


SYSTEM_RESEARCH = """You are reading student writing for use as exemplars for Reese, a research-editor agent. Reese reads research-flavored essays for: source dropped without synthesis, multiple sources cited but not put in conversation with each other, no original argument synthesizing the sources, source claims accepted uncritically, evidence cherry-picked from sources, weak counter-source treatment.

Pull 2-4 passages from this essay that exhibit one of these patterns. Each output object should look like:

{
  "lane": "research_editor",
  "passage": "<verbatim 1-3 sentences from the essay>",
  "issue_label": "<2-5 words>",
  "question": "<critique in real writing-teacher voice — terse, specific>",
  "why_it_matters": "<one sentence>",
  "fix_suggestion": "<concrete fix or null>",
  "severity": "<high|medium|low>"
}

Return a JSON array. Skip the essay entirely (return []) if it doesn't have research/source-handling material."""


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


async def classify_one(client, system_prompt, essay, sem):
    async with sem:
        try:
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message(essay)}],
            )
        except Exception as e:
            print(f"  api err {essay.get('essay_id')}: {e}", file=sys.stderr)
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


def user_message(essay):
    src = essay.get("source", "?")
    score = essay.get("holistic_score")
    max_score = essay.get("holistic_max")
    commentary = essay.get("scorer_commentary") or ""
    prompt = essay.get("assignment") or ""
    parts = [
        f"Source: {src}",
        f"Holistic score: {score}/{max_score}" if score else "",
    ]
    if prompt:
        parts.append(f"Prompt: {prompt[:400]}")
    if commentary:
        parts.append(f"\nOfficial rater commentary:\n{commentary[:1200]}")
    parts.append(f"\nEssay:\n{essay['text']}")
    return "\n".join(p for p in parts if p)


async def main_async():
    client = AsyncAnthropic()
    essays = [json.loads(line) for line in Path("/tmp/essays_filtered.jsonl").read_text().splitlines() if line.strip()]

    gre = [e for e in essays if (e.get("source") or "").startswith("GRE_")]
    # Source-based PERSUADE essays — these have non-empty source_text
    source_based = [e for e in essays
                    if e.get("source") == "PERSUADE_2.0" and (e.get("source_text") or "").strip()]
    # Cap the source-based sample so we don't burn classification budget
    source_based = source_based[:150]

    print(f"Rhetorical pass: {len(gre)} GRE essays", file=sys.stderr)
    print(f"Research pass:   {len(source_based)} source-based PERSUADE essays",
          file=sys.stderr)

    sem = asyncio.Semaphore(8)
    rh_tasks = [classify_one(client, SYSTEM_RHETORICAL, e, sem) for e in gre]
    rs_tasks = [classify_one(client, SYSTEM_RESEARCH, e, sem) for e in source_based]

    new_count = 0
    out_path = Path("/tmp/essays_classified.jsonl")
    # Append, don't overwrite
    with out_path.open("a") as f:
        for fut in asyncio.as_completed(rh_tasks):
            for c in await fut:
                f.write(json.dumps(c) + "\n")
                new_count += 1
        for fut in asyncio.as_completed(rs_tasks):
            for c in await fut:
                f.write(json.dumps(c) + "\n")
                new_count += 1
    print(f"\nAppended {new_count} new critiques to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr); sys.exit(1)
    asyncio.run(main_async())

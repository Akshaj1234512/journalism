"""
Stage 3 for essay-mode editors: pick the top 15 per lane (with diversity
constraint) and write YAML exemplar files.

Diversity constraint:
- Group candidates by normalized issue_label (so "buried thesis", "vague
  thesis", and "missing thesis" become distinct buckets)
- Round-robin pick from buckets: take the best of each, then the second
  best of each, etc., until target is reached
- This guarantees coverage across distinct sub-issues rather than picking
  15 near-duplicates from the most common failure mode

Quality score per critique:
- passage length sweet spot (40-200 words):                  +1
- question length sweet spot (50-400 chars):                 +1
- non-null fix_suggestion:                                    +1
- source is GRE (has official rater commentary):              +2
- source is ASAP narrative (cleaner narrative genre signal):  +0.5
- severity medium or high (not just polish):                 +0.5
- passage is multi-sentence (more concrete):                  +0.5
- low source score (more critique material from weak essays): +0.5

Sol (question_master) and Kate (citation_editor) keep their existing
synthetic exemplars — both lanes have near-zero candidates in this
corpus and the synthetic versions are already well-anchored on style
guides / craft pedagogy.

Run:
    .venv/bin/python scripts/build_essay_exemplars.py
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml


# Lane name (in classifier output) → exemplar filename + agent_name. These
# all already exist in src/red_room/exemplars/ as synthetic versions; we
# overwrite them with real-data versions.
LANE_TO_EDITOR = {
    "thesis_editor":         ("thesis_editor",        "thesis_editor"),
    "prose_style":           ("prose_style",          "prose_style"),
    "structure_editor":      ("structure_editor",     "structure_editor"),
    "logic_auditor":         ("logic_auditor",        "logic_auditor"),
    "evidence_quotation":    ("evidence_quotation",   "evidence_quotation"),
    "citation_editor":       ("citation_editor",      "citation_editor"),
    "argumentative_editor":  ("argumentative_editor", "argumentative_editor"),
    "analytical_editor":     ("analytical_editor",    "analytical_editor"),
    "narrative_editor":      ("narrative_editor",     "narrative_editor"),
    "research_editor":       ("research_editor",      "research_editor"),
    "rhetorical_editor":     ("rhetorical_editor",    "rhetorical_editor"),
}

EXEMPLARS_DIR = Path(__file__).resolve().parent.parent / "src" / "red_room" / "exemplars"


def quality(c: dict) -> float:
    s = 0.0
    passage = (c.get("passage") or "").strip()
    pwords = len(passage.split())
    if 40 <= pwords <= 200:
        s += 1.0
    elif 25 <= pwords < 40 or 200 < pwords <= 300:
        s += 0.5

    q = (c.get("question") or "").strip()
    if 50 <= len(q) <= 400:
        s += 1.0
    elif 30 <= len(q) < 50 or 400 < len(q) <= 600:
        s += 0.5

    fix = (c.get("fix_suggestion") or "").strip()
    if fix and fix.lower() not in ("null", "none"):
        s += 1.0

    src = c.get("_source", "")
    if src.startswith("GRE_"):
        s += 2.0
    elif src.startswith("ASAP-8") or src.startswith("ASAP-7"):
        s += 0.5

    sev = (c.get("severity") or "").lower()
    if sev in ("medium", "high"):
        s += 0.5

    if passage.count(".") >= 2:
        s += 0.5

    score = c.get("_score") or 0
    score_max = c.get("_score_max") or 6
    if score and score / score_max <= 0.5:
        s += 0.5

    return s


def normalize_label(label: str) -> str:
    """Normalize issue_label for diversity bucketing: lowercase, strip
    leading articles / qualifiers, collapse whitespace, take leading 4
    significant words."""
    s = (label or "").lower().strip()
    s = re.sub(r"^(weak|missing|vague|unclear|poor|inadequate)\s+", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    words = s.split()[:4]
    return " ".join(words) if words else "uncategorized"


def diverse_pick(candidates: list[dict], target: int) -> list[dict]:
    """Round-robin from issue-label buckets to enforce diversity."""
    if not candidates:
        return []

    # Bucket by normalized issue label
    buckets: dict[str, list[dict]] = {}
    for c in candidates:
        key = normalize_label(c.get("issue_label", ""))
        buckets.setdefault(key, []).append(c)

    # Sort each bucket by quality (desc)
    for k in buckets:
        buckets[k].sort(key=quality, reverse=True)

    # Round-robin pick
    picks: list[dict] = []
    while len(picks) < target and any(buckets[k] for k in buckets):
        for k in list(buckets.keys()):
            if buckets[k]:
                picks.append(buckets[k].pop(0))
                if len(picks) >= target:
                    break

    return picks[:target]


def source_label(c: dict) -> str:
    src = c.get("_source", "?")
    score = c.get("_score")
    smax = c.get("_score_max")
    if score and smax:
        return f"{src} (score {int(score) if score == int(score) else score}/{smax})"
    return src


def to_yaml_exemplar(c: dict, agent_name: str) -> dict:
    text_quote = (c.get("passage") or "").strip()
    if not text_quote:
        text_quote = (c.get("issue_label") or "").strip()
    severity = (c.get("severity") or "medium").lower()
    if severity not in ("high", "medium", "low"):
        severity = "medium"
    fix = (c.get("fix_suggestion") or "").strip()
    return {
        "source": f"{source_label(c)}: {c.get('issue_label') or 'reviewer concern'}",
        "article": text_quote,
        "critiques": [{
            "agent": agent_name,
            "text_quote": text_quote,
            "span": [0, len(text_quote)],
            "issue_label": (c.get("issue_label") or "").strip(),
            "question": (c.get("question") or "").strip(),
            "why_it_matters": (c.get("why_it_matters") or "").strip(),
            "fix_suggestion": fix if fix and fix.lower() not in ("null", "none") else None,
            "replacement": None,
            "severity": severity,
        }],
    }


class LiteralStr(str):
    pass


def _literal_repr(d, data):
    return d.represent_scalar("tag:yaml.org,2002:str", data, style="|")


yaml.add_representer(LiteralStr, _literal_repr)


def block_strings(o):
    if isinstance(o, dict):
        return {k: block_strings(v) for k, v in o.items()}
    if isinstance(o, list):
        return [block_strings(v) for v in o]
    if isinstance(o, str) and ("\n" in o or len(o) > 80):
        return LiteralStr(o)
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default="/tmp/essays_classified.jsonl")
    ap.add_argument("--per-lane", type=int, default=15)
    args = ap.parse_args()

    raw = [json.loads(line) for line in Path(args.in_path).read_text().splitlines() if line.strip()]
    print(f"Loaded {len(raw)} classified critiques.", file=sys.stderr)

    by_lane: dict[str, list[dict]] = {}
    for c in raw:
        lane = c.get("lane")
        if lane in LANE_TO_EDITOR:
            by_lane.setdefault(lane, []).append(c)

    print("\nCandidates per lane (after lane filter):", file=sys.stderr)
    for lane in LANE_TO_EDITOR:
        n = len(by_lane.get(lane, []))
        # also report distinct issue labels for diversity awareness
        labels = {normalize_label(c.get("issue_label", "")) for c in by_lane.get(lane, [])}
        print(f"  {lane:22s} {n:4d} candidates / {len(labels):3d} distinct sub-issues",
              file=sys.stderr)

    print(f"\nWriting top {args.per_lane} per lane (diversity-aware) to {EXEMPLARS_DIR}/",
          file=sys.stderr)

    for lane, (filename, agent_name) in LANE_TO_EDITOR.items():
        cs = by_lane.get(lane, [])
        if not cs:
            print(f"  SKIP {lane}: no candidates (keeping existing file)",
                  file=sys.stderr)
            continue

        picks = diverse_pick(cs, args.per_lane)
        if len(picks) < args.per_lane:
            print(f"  WARN {lane}: only {len(picks)} after diversity selection "
                  f"(out of {len(cs)} candidates)", file=sys.stderr)

        exemplars = [to_yaml_exemplar(p, agent_name) for p in picks]
        # Also report the bucket coverage we achieved
        buckets_used = {normalize_label(p.get("issue_label", "")) for p in picks}

        exemplars = block_strings(exemplars)

        header = (
            f"# Exemplars for {agent_name}\n"
            f"# Pulled from real student essays across PERSUADE 2.0, Feedback Prize ELL,\n"
            f"# AES2, ASAP 7+8 (narrative), and ETS GRE Issue + Argument official samples.\n"
            f"# Classified per editor lane via Claude Haiku, then top {args.per_lane}\n"
            f"# selected with a diversity constraint (round-robin across distinct\n"
            f"# sub-issue buckets) so the exemplars cover the lane's full failure-mode\n"
            f"# range rather than 15 variants of the same critique.\n"
            f"#\n"
        )
        out_path = EXEMPLARS_DIR / f"{filename}.yaml"
        with out_path.open("w") as f:
            f.write(header)
            yaml.dump(exemplars, f, sort_keys=False, allow_unicode=True,
                      width=92, default_flow_style=False)
        print(f"  {filename}.yaml: {len(picks)} exemplars across {len(buckets_used)} sub-issues",
              file=sys.stderr)


if __name__ == "__main__":
    main()

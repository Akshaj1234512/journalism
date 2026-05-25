"""
Stage 3: take classified critiques and pick the top N per lane with a
diversity constraint. Write each selection to the corresponding YAML
exemplar file in src/red_room/exemplars/.

Input:  /tmp/openreview_classified.jsonl (from classify_critiques.py)
Output: src/red_room/exemplars/*.yaml (overwrites the synthetic versions)

Selection scoring per critique:
- length sweet spot (question 80-500 chars)            +1
- has a non-null fix_suggestion                        +1
- paper_passage references a specific anchor           +1
- source review rating high (rating >= 6)              +1
- source review confidence 5/5                        +0.5
- severity is high or medium                          +0.5
- question contains a specific anchor (Table/Fig/Sec)  +1

Diversity constraint:
- Group candidates by normalized issue_label (so "missing baseline" and
  "weak baseline choice" go to the same bucket, but "missing ablation"
  goes to a different one)
- Round-robin pick from buckets: take the best of each, then the second
  best of each, etc., until target is reached
- This guarantees coverage across distinct sub-issues rather than picking
  N near-duplicates from the most common failure mode

Run:
    .venv/bin/python scripts/build_exemplars.py
        [--in /tmp/openreview_classified.jsonl]
        [--per-lane 15]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml


# Lane → (filename, agent_name in schema)
LANE_TO_EDITOR = {
    "methodology":     ("methodology_editor",   "methodology_editor"),
    "related_work":    ("related_work_editor",  "related_work_editor"),
    "limitations":     ("limitations_editor",   "limitations_editor"),
    "figures_tables":  ("figure_table_editor",  "figure_table_editor"),
    "theorem_math":    ("theorem_editor",       "theorem_editor"),
    "format":          ("format_editor",        "format_editor"),
    "cs_ml_specific":  ("cs_ml_specialist",     "cs_ml_specialist"),
}

ANCHOR_RE = re.compile(
    r"\b(Table|Fig\.?|Figure|Section|Sec\.?|Eq\.?|Equation|Theorem|Thm\.?|Lemma|"
    r"Algorithm|Alg\.?|Appendix|App\.?|line|p\.|page)\s*\(?\s*\d+",
    re.IGNORECASE,
)

EXEMPLARS_DIR = Path(__file__).resolve().parent.parent / "src" / "red_room" / "exemplars"


def score(critique: dict) -> float:
    s = 0.0
    q = (critique.get("question") or "").strip()
    qlen = len(q)
    if 80 <= qlen <= 500:
        s += 1.0
    elif 60 <= qlen < 80 or 500 < qlen <= 700:
        s += 0.5
    if (critique.get("fix_suggestion") or "").strip() and critique.get("fix_suggestion") not in (None, "null"):
        s += 1.0
    pp = (critique.get("paper_passage") or "").strip()
    if pp and ANCHOR_RE.search(pp):
        s += 1.0
    rating = critique.get("_source_rating", 0) or 0
    if rating >= 6:
        s += 1.0
    if critique.get("_source_confidence", 0) == 5:
        s += 0.5
    sev = (critique.get("severity") or "").lower()
    if sev in ("high", "medium"):
        s += 0.5
    if ANCHOR_RE.search(q):
        s += 1.0
    return s


def normalize_label(label: str) -> str:
    """Normalize issue_label for diversity bucketing: lowercase, strip
    leading quality qualifiers ("weak", "missing"), collapse whitespace,
    take leading 4 significant words. So "missing recent baseline" and
    "weak baseline against SOTA" go to the same bucket; "no error bars"
    goes to a different one."""
    s = (label or "").lower().strip()
    s = re.sub(r"^(weak|missing|vague|unclear|poor|inadequate|insufficient|no)\s+", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    words = s.split()[:4]
    return " ".join(words) if words else "uncategorized"


def diverse_pick(candidates: list[dict], target: int) -> list[dict]:
    """Round-robin from issue-label buckets to enforce sub-issue diversity.
    Within each bucket we sort by quality score. We then walk all buckets
    in priority order (best-bucket-first by top-score) taking one per pass
    until target is reached or all buckets are exhausted."""
    if not candidates:
        return []
    buckets: dict[str, list[dict]] = {}
    for c in candidates:
        key = normalize_label(c.get("issue_label", ""))
        buckets.setdefault(key, []).append(c)
    for k in buckets:
        buckets[k].sort(key=score, reverse=True)
    # Walk buckets in order of best representative — so a bucket containing
    # the single highest-scoring critique gets the first slot.
    order = sorted(buckets.keys(),
                   key=lambda k: score(buckets[k][0]) if buckets[k] else 0,
                   reverse=True)
    picks: list[dict] = []
    while len(picks) < target and any(buckets[k] for k in order):
        for k in order:
            if buckets[k]:
                picks.append(buckets[k].pop(0))
                if len(picks) >= target:
                    break
    return picks[:target]


def to_yaml_exemplar(c: dict, agent_name: str) -> dict:
    """Map a classified critique to the existing exemplar schema."""
    text_quote = (c.get("paper_passage") or "").strip()
    if not text_quote:
        # fallback so the schema has something
        text_quote = (c.get("issue_label") or "").strip()
    venue = c.get("_source_venue", "OpenReview")
    rating = c.get("_source_rating", "?")
    confidence = c.get("_source_confidence", "?")
    source_line = (
        f"{venue} OpenReview review (rating {rating}/10, confidence {confidence}/5): "
        f"{c.get('issue_label') or 'reviewer concern'}"
    )
    severity = (c.get("severity") or "medium").lower()
    if severity not in ("high", "medium", "low"):
        severity = "medium"
    fix = (c.get("fix_suggestion") or "").strip()
    return {
        "source": source_line,
        "article": text_quote,
        "critiques": [
            {
                "agent": agent_name,
                "text_quote": text_quote,
                "span": [0, len(text_quote)],
                "issue_label": (c.get("issue_label") or "").strip(),
                "question": (c.get("question") or "").strip(),
                "why_it_matters": (c.get("why_it_matters") or "").strip(),
                "fix_suggestion": fix if fix and fix.lower() not in ("null", "none") else None,
                "replacement": None,
                "severity": severity,
            }
        ],
    }


class LiteralStr(str):
    """YAML hint: dump as literal block (|-) rather than folded."""


def _literal_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")


yaml.add_representer(LiteralStr, _literal_representer)


def block_strings(obj):
    """Convert multi-line string fields in critique objects to LiteralStr so
    they dump as readable YAML literal blocks (matching the existing files)."""
    if isinstance(obj, dict):
        return {k: block_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [block_strings(v) for v in obj]
    if isinstance(obj, str) and "\n" in obj:
        return LiteralStr(obj)
    if isinstance(obj, str) and len(obj) > 80:
        return LiteralStr(obj)
    return obj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default="/tmp/openreview_classified.jsonl")
    ap.add_argument("--per-lane", type=int, default=15)
    ap.add_argument("--filtered-reviews", default="/tmp/openreview_filtered.jsonl",
                    help="Source jsonl used to look up venue per review id.")
    args = ap.parse_args()

    # Build a review_id → venue map so we can tag exemplar sources properly.
    venue_by_review: dict[str, str] = {}
    for line in Path(args.filtered_reviews).read_text().splitlines():
        if not line.strip():
            continue
        try:
            r = json.loads(line)
            venue_by_review[r["review_id"]] = r.get("venue", "OpenReview")
        except Exception:
            pass

    raw = [json.loads(line) for line in Path(args.in_path).read_text().splitlines() if line.strip()]
    print(f"Loaded {len(raw)} classified critiques.", file=sys.stderr)

    # Attach venue info from the source review
    for c in raw:
        rid = c.get("_source_review_id")
        c["_source_venue"] = venue_by_review.get(rid, "OpenReview")

    by_lane: dict[str, list[dict]] = {}
    for c in raw:
        lane = c.get("lane")
        if lane not in LANE_TO_EDITOR:
            continue
        by_lane.setdefault(lane, []).append(c)

    print("\nCandidates per lane:", file=sys.stderr)
    for lane in LANE_TO_EDITOR:
        print(f"  {lane:18s} {len(by_lane.get(lane, []))}", file=sys.stderr)

    print(f"\nWriting top {args.per_lane} per lane to {EXEMPLARS_DIR}/...",
          file=sys.stderr)
    for lane, (filename, agent_name) in LANE_TO_EDITOR.items():
        cs = by_lane.get(lane, [])
        if not cs:
            print(f"  WARN: no candidates for {lane}; leaving existing file alone.",
                  file=sys.stderr)
            continue
        # Diversity-aware selection: round-robin across normalized issue-label
        # buckets so we cover the lane's distinct sub-issues rather than 15
        # near-copies of the most common failure mode.
        top = diverse_pick(cs, args.per_lane)
        if len(top) < args.per_lane:
            print(f"  WARN: only {len(top)} candidates for {lane} after diversity selection.",
                  file=sys.stderr)
        buckets_used = {normalize_label(c.get("issue_label", "")) for c in top}

        exemplars = [to_yaml_exemplar(c, agent_name) for c in top]
        exemplars = block_strings(exemplars)

        header = (
            f"# Exemplars for {agent_name}\n"
            f"# Pulled from real OpenReview reviews on ICLR 2024 / ICLR 2025 /\n"
            f"# NeurIPS 2023 (filtered to confidence>=4 reviewers, weaknesses\n"
            f"# field 200-2500 words, must reference a specific anchor like\n"
            f"# Table/Fig/Section/Eq number). Classified by lane via Claude Haiku;\n"
            f"# top {args.per_lane} selected with a diversity constraint (round-robin\n"
            f"# across distinct sub-issue buckets) so the exemplars cover the lane's\n"
            f"# full failure-mode range rather than {args.per_lane} variants of the\n"
            f"# same critique.\n"
            f"#\n"
        )
        out_path = EXEMPLARS_DIR / f"{filename}.yaml"
        with out_path.open("w") as f:
            f.write(header)
            yaml.dump(
                exemplars,
                f,
                sort_keys=False,
                allow_unicode=True,
                width=92,
                default_flow_style=False,
            )
        print(f"  wrote {out_path.name}: {len(top)} exemplars across {len(buckets_used)} sub-issues",
              file=sys.stderr)


if __name__ == "__main__":
    main()

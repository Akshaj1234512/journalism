"""
Stage 3 for journalism: pick the top 15 per lane (diversity-aware) and
write YAML exemplar files. Mirrors the essays build script.

Input:  /tmp/journalism_all_classified.jsonl (merged LIAR + craft sources)
Output: src/red_room/exemplars/{legal_skeptic, data_expert, ...}.yaml

For lanes with < 15 real candidates we keep the existing bootstrap synthetic
exemplars (Phase-1 work) and report which lanes were skipped.

Run:
    .venv/bin/python scripts/build_journalism_exemplars.py [--per-lane 15]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml


# Map classified lane -> exemplar filename + agent_name (these match the
# AgentName Literal in the backend schemas).
LANE_TO_EDITOR = {
    "legal_skeptic":         ("legal_skeptic",        "legal_skeptic"),
    "data_expert":           ("data_expert",          "data_expert"),
    "human_rights":          ("human_rights",         "human_rights"),
    "partisan":              ("partisan",             "partisan"),
    "city_editor":           ("city_editor",          "city_editor"),
    "investigations_editor": ("investigations_editor","investigations_editor"),
    "opinion_editor":        ("opinion_editor",       "opinion_editor"),
    "features_editor":       ("features_editor",      "features_editor"),
    "profile_editor":        ("profile_editor",       "profile_editor"),
    "reviews_editor":        ("reviews_editor",       "reviews_editor"),
    "explanatory_editor":    ("explanatory_editor",   "explanatory_editor"),
}

# Quality scoring per critique. Heuristic-driven; same shape as essays.
def quality(c: dict) -> float:
    s = 0.0
    passage = (c.get("passage") or "").strip()
    pwords = len(passage.split())
    if 30 <= pwords <= 180:
        s += 1.0
    elif 15 <= pwords < 30 or 180 < pwords <= 300:
        s += 0.5

    q = (c.get("question") or "").strip()
    if 50 <= len(q) <= 450:
        s += 1.0
    elif 30 <= len(q) < 50 or 450 < len(q) <= 700:
        s += 0.5

    fix = (c.get("fix_suggestion") or "").strip()
    if fix and fix.lower() not in ("null", "none"):
        s += 1.0

    # Craft-source critiques tend to be richer than fact-check critiques
    src = (c.get("_source") or "").lower()
    if "nieman" in src:
        s += 1.5
    elif "slate" in src or "pressbox" in src:
        s += 1.0
    elif src.startswith("politifact"):
        s += 0.5

    sev = (c.get("severity") or "").lower()
    if sev in ("medium", "high"):
        s += 0.5

    # Reward critiques that anchor to specific text (named numbers, quoted text)
    if re.search(r"\d", q) or '"' in q or "'" in q:
        s += 0.3

    return s


def normalize_label(label: str) -> str:
    s = (label or "").lower().strip()
    s = re.sub(r"^(weak|missing|vague|unclear|poor|inadequate|no|bad|wrong)\s+", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    words = s.split()[:4]
    return " ".join(words) if words else "uncategorized"


def diverse_pick(candidates: list[dict], target: int) -> list[dict]:
    if not candidates:
        return []
    buckets: dict[str, list[dict]] = {}
    for c in candidates:
        key = normalize_label(c.get("issue_label", ""))
        buckets.setdefault(key, []).append(c)
    for k in buckets:
        buckets[k].sort(key=quality, reverse=True)
    # Walk best-bucket-first
    order = sorted(buckets.keys(),
                   key=lambda k: quality(buckets[k][0]) if buckets[k] else 0,
                   reverse=True)
    picks: list[dict] = []
    while len(picks) < target and any(buckets[k] for k in order):
        for k in order:
            if buckets[k]:
                picks.append(buckets[k].pop(0))
                if len(picks) >= target:
                    break
    return picks[:target]


def source_quota_pick(
    candidates: list[dict],
    target: int,
    min_quotas: dict[str, int],
) -> list[dict]:
    """Pick `target` exemplars with guaranteed minimum representation per
    source. `min_quotas` maps source name -> minimum slots reserved.

    Algorithm:
    1. Bucket candidates by source (_source field).
    2. For each source with a quota, run diversity-aware selection within
       that source's pool to satisfy its minimum.
    3. Fill remaining slots from the combined pool (still diversity-aware
       across labels) without revisiting already-picked items.

    Sources with no quota entry get whatever's left over via the global
    pool. Sources whose pool is smaller than their quota contribute
    everything they have and the deficit is filled from other sources.
    """
    if not candidates:
        return []
    by_source: dict[str, list[dict]] = {}
    for c in candidates:
        src = c.get("_source") or "?"
        by_source.setdefault(src, []).append(c)

    picked_ids: set[int] = set()
    picks: list[dict] = []

    # Phase 1: satisfy each quota using diversity-aware selection per source.
    for src, quota in min_quotas.items():
        pool = by_source.get(src, [])
        if not pool or quota <= 0:
            continue
        take = min(quota, len(pool))
        chosen = diverse_pick(pool, take)
        for c in chosen:
            cid = id(c)
            if cid in picked_ids:
                continue
            picks.append(c)
            picked_ids.add(cid)
            if len(picks) >= target:
                return picks

    # Phase 2: fill remaining slots from the full pool, diversity-aware.
    remaining_pool = [c for c in candidates if id(c) not in picked_ids]
    if len(picks) < target:
        extras = diverse_pick(remaining_pool, target - len(picks))
        for c in extras:
            cid = id(c)
            if cid in picked_ids:
                continue
            picks.append(c)
            picked_ids.add(cid)
            if len(picks) >= target:
                break
    return picks[:target]


def source_label(c: dict) -> str:
    src = c.get("_source") or "?"
    url = c.get("_url") or ""
    label = c.get("_label") or ""
    claim = c.get("_claim") or ""
    if src.startswith("PolitiFact"):
        # Fact-check provenance
        return f"PolitiFact fact-check (ruling: {label})"
    if url:
        # Craft article — use the URL's slug for clarity
        host = url.split("/")[2] if "://" in url else "?"
        slug = url.rstrip("/").split("/")[-1]
        return f"{host} — {slug[:80]}"
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
        "source": f"{source_label(c)}: {c.get('issue_label') or 'editorial observation'}",
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


EXEMPLARS_DIR = Path(__file__).resolve().parent.parent / "src" / "red_room" / "exemplars"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default="/tmp/journalism_all_classified.jsonl")
    ap.add_argument("--per-lane", type=int, default=15)
    args = ap.parse_args()

    raw = [json.loads(line) for line in Path(args.in_path).read_text().splitlines() if line.strip()]
    print(f"Loaded {len(raw)} classified critiques.", file=sys.stderr)

    by_lane: dict[str, list[dict]] = {}
    for c in raw:
        lane = c.get("lane")
        if lane in LANE_TO_EDITOR:
            by_lane.setdefault(lane, []).append(c)

    print("\nCandidates per lane:", file=sys.stderr)
    for lane in LANE_TO_EDITOR:
        cs = by_lane.get(lane, [])
        labels = {normalize_label(c.get("issue_label", "")) for c in cs}
        print(f"  {lane:24s} {len(cs):4d} candidates / {len(labels):3d} sub-issues",
              file=sys.stderr)

    print(f"\nWriting top {args.per_lane} per lane (diversity-aware)...",
          file=sys.stderr)

    # Per-lane source quotas. Used for lanes whose candidate pool is heavily
    # skewed toward one source — we want to guarantee representation from
    # smaller-but-high-quality sources (Guardian for reviews) rather than
    # have them lose every issue-label tiebreak to a higher-volume source.
    SOURCE_QUOTAS: dict[str, dict[str, int]] = {
        "reviews_editor": {
            "Guardian": 4,   # ~27% of slots even though only 15 source articles
            "AVClub":   4,
            "Pitchfork": 7,
        },
    }

    for lane, (filename, agent_name) in LANE_TO_EDITOR.items():
        cs = by_lane.get(lane, [])
        if len(cs) < 3:
            print(f"  SKIP {lane}: only {len(cs)} candidates (keeping bootstrap synthetic)",
                  file=sys.stderr)
            continue
        if lane in SOURCE_QUOTAS:
            picks = source_quota_pick(cs, args.per_lane, SOURCE_QUOTAS[lane])
        else:
            picks = diverse_pick(cs, args.per_lane)
        if len(picks) < args.per_lane:
            print(f"  WARN {lane}: only {len(picks)} after diversity selection",
                  file=sys.stderr)
        buckets_used = {normalize_label(p.get("issue_label", "")) for p in picks}

        exemplars = [to_yaml_exemplar(p, agent_name) for p in picks]
        exemplars = block_strings(exemplars)

        header = (
            f"# Exemplars for {agent_name}\n"
            f"# Real editorial-room critique material pulled from two sources:\n"
            f"#   1. PolitiFact fact-checks (via LIAR_RAW_RAWFC, 11k items)\n"
            f"#   2. Nieman Storyboard + Slate Press Box craft criticism articles\n"
            f"#      (Annotation Tuesday, Essays on Craft, 5 Questions)\n"
            f"# Each was passed through Claude Haiku to extract specific editor-\n"
            f"# room observations, classified into the {agent_name} lane, and\n"
            f"# the top {args.per_lane} were selected with a diversity constraint\n"
            f"# (round-robin across distinct sub-issue buckets) so the exemplars\n"
            f"# cover the lane's failure-mode range rather than {args.per_lane}\n"
            f"# variants of the same critique.\n"
            f"#\n"
        )
        out_path = EXEMPLARS_DIR / f"{filename}.yaml"
        with out_path.open("w") as f:
            f.write(header)
            yaml.dump(exemplars, f, sort_keys=False, allow_unicode=True,
                      width=92, default_flow_style=False)
        # Report source mix per lane so we can verify smaller-but-quality
        # sources (e.g. Guardian for reviews) got their quota.
        from collections import Counter as _C
        src_mix = _C((p.get("_source") or "?") for p in picks)
        src_mix_str = ", ".join(f"{s}={n}" for s, n in src_mix.most_common())
        print(
            f"  {filename}.yaml: {len(picks)} exemplars / "
            f"{len(buckets_used)} sub-issues / sources: {src_mix_str}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()

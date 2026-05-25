"""
Stage 1: pull ICLR 2024 reviews from OpenReview and apply mechanical
filters. Output: /tmp/openreview_filtered.jsonl, one filtered review per line.

Filters:
- Self-reported confidence >= 4 (out of 5)
- "weaknesses" field word count between 200 and 2500
- "weaknesses" contains >= 1 specific anchor (Table N, Fig N, Section N.M, Eq N, etc.)
- Numeric rating present and parseable

Run:
    .venv/bin/python scripts/ingest_openreview.py [--venue ICLR.cc/2024/Conference] [--limit 3000]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import openreview


ANCHOR_RE = re.compile(
    r"\b(Table|Fig\.?|Figure|Section|Sec\.?|Eq\.?|Equation|Theorem|Thm\.?|Lemma|"
    r"Algorithm|Alg\.?|Proposition|Prop\.?|Definition|Def\.?|Appendix|App\.?|"
    r"line|lines|p\.|page|pp\.)"
    r"\s*\(?\s*\d+(\.\d+)?\)?",
    re.IGNORECASE,
)


def val(content: dict, key: str):
    v = content.get(key)
    if isinstance(v, dict):
        return v.get("value")
    return v


def parse_score(raw) -> int | None:
    """Scores often arrive as '5: marginally above acceptance threshold'."""
    if raw is None:
        return None
    s = str(raw).strip()
    m = re.match(r"^\s*(\d+)", s)
    return int(m.group(1)) if m else None


def fetch(venue: str, limit: int) -> list[dict]:
    """Fetch up to `limit` submissions from `venue`, each with its replies."""
    client = openreview.api.OpenReviewClient(baseurl="https://api2.openreview.net")
    submission_invitation = f"{venue}/-/Submission"

    out: list[dict] = []
    fetched = 0
    offset = 0
    PAGE = 500
    while fetched < limit:
        page_limit = min(PAGE, limit - fetched)
        try:
            page = client.get_notes(
                invitation=submission_invitation,
                details="replies",
                limit=page_limit,
                offset=offset,
            )
        except Exception as e:
            print(f"  fetch error at offset {offset}: {e}", file=sys.stderr)
            break
        if not page:
            break
        for s in page:
            replies = s.details.get("replies", []) if s.details else []
            for r in replies:
                invs = r.get("invitations") or []
                if not any("Official_Review" in i for i in invs):
                    continue
                out.append({
                    "submission_id": s.id,
                    "review_id": r.get("id"),
                    "content": r.get("content") or {},
                })
        offset += len(page)
        fetched += len(page)
        print(
            f"  fetched {fetched} submissions ({len(out)} reviews) at offset {offset}",
            file=sys.stderr,
        )
        if len(page) < page_limit:
            break
        time.sleep(0.3)  # be polite to the API
    return out


def keep(review: dict, venue: str) -> dict | None:
    """Apply Stage 1 mechanical filters. Returns the filtered review or None."""
    c = review["content"]
    confidence = parse_score(val(c, "confidence"))
    if confidence is None or confidence < 4:
        return None
    rating = parse_score(val(c, "rating"))
    if rating is None:
        return None
    weaknesses = val(c, "weaknesses") or ""
    words = len(weaknesses.split())
    if words < 200 or words > 2500:
        return None
    if not ANCHOR_RE.search(weaknesses):
        return None
    return {
        "venue": venue,
        "submission_id": review["submission_id"],
        "review_id": review["review_id"],
        "confidence": confidence,
        "rating": rating,
        "soundness": parse_score(val(c, "soundness")),
        "presentation": parse_score(val(c, "presentation")),
        "contribution": parse_score(val(c, "contribution")),
        "summary": val(c, "summary") or "",
        "weaknesses": weaknesses,
        # NeurIPS reviews carry a dedicated `limitations` field; ICLR doesn't.
        # When present this is a goldmine for the Lina exemplars.
        "limitations": val(c, "limitations") or "",
        "questions": val(c, "questions") or "",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--venue", default="ICLR.cc/2024/Conference")
    ap.add_argument("--limit", type=int, default=3000,
                    help="Max submissions to scan (each has ~3-6 reviews).")
    ap.add_argument("--out", default="/tmp/openreview_filtered.jsonl")
    args = ap.parse_args()

    print(f"Fetching up to {args.limit} submissions from {args.venue}...",
          file=sys.stderr)
    raw_reviews = fetch(args.venue, args.limit)
    print(f"Raw reviews collected: {len(raw_reviews)}", file=sys.stderr)

    kept = []
    for r in raw_reviews:
        k = keep(r, args.venue)
        if k is not None:
            kept.append(k)

    out_path = Path(args.out)
    with out_path.open("w") as f:
        for k in kept:
            f.write(json.dumps(k) + "\n")
    print(
        f"Filtered: {len(kept)} reviews "
        f"({100 * len(kept) / max(len(raw_reviews), 1):.1f}% of raw) "
        f"→ {out_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()

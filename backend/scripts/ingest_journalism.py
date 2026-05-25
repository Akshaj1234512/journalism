"""
Stage 1 for journalism-mode editors: pull real fact-check material from the
LIAR_RAW_RAWFC corpus (11,677 PolitiFact fact-checks with full fact-checker
explanations). Output: /tmp/journalism_filtered.jsonl

Each row in the source carries:
- claim:    the factual statement being checked (real text from a public figure)
- label:    PolitiFact ruling (pants-fire / false / barely-true / half-true / mostly-true / true)
- explain:  the full PolitiFact write-up explaining the ruling (the critique itself)

We filter to:
- "false" or "half-true" rulings (these have actual critique material)
- explanations 250-2500 words (substantive but not bloated)

Run:
    .venv/bin/python scripts/ingest_journalism.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from datasets import load_dataset


OUT = Path("/tmp/journalism_filtered.jsonl")
MIN_WORDS = 250
MAX_WORDS = 2500
KEEP_LABELS = {"false", "half-true"}  # the ones with critique signal


def main():
    print("Loading LIAR_RAW_RAWFC_Merged...", file=sys.stderr)
    ds = load_dataset("NoAtmosphere0/LIAR_RAW_RAWFC_Merged", split="train")
    print(f"  raw rows: {len(ds)}", file=sys.stderr)

    kept: list[dict] = []
    for row in ds:
        label = (row.get("label") or "").strip().lower()
        if label not in KEEP_LABELS:
            continue
        explain = (row.get("explain") or "").strip()
        words = len(explain.split())
        if words < MIN_WORDS or words > MAX_WORDS:
            continue
        claim = (row.get("claim") or "").strip()
        if not claim:
            continue
        kept.append({
            "source": "PolitiFact_via_LIAR_RAW",
            "event_id": row.get("event_id"),
            "claim": claim,
            "label": label,
            "explain": explain,
            "explain_words": words,
        })

    OUT.write_text("\n".join(json.dumps(r) for r in kept) + "\n")
    print(f"Filtered: {len(kept)} fact-checks ({100*len(kept)/len(ds):.1f}% of raw) → {OUT}",
          file=sys.stderr)
    # label split
    from collections import Counter
    cnt = Counter(r["label"] for r in kept)
    print(f"  by label: {dict(cnt)}", file=sys.stderr)


if __name__ == "__main__":
    main()

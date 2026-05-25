"""
Replace journalism-trade shorthand with plain-language equivalents in all
journalism prompts + exemplar YAMLs. Word-boundary aware, case-preserving.

Run:
    .venv/bin/python scripts/strip_journalism_shorthand.py [--dry-run]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# Order matters: longer phrases first so "nut graf" is consumed before "graf".
REPLACEMENTS = [
    (r"\bnut grafs\b",   "context paragraphs"),
    (r"\bnut graf\b",    "context paragraph"),
    (r"\bgrafs\b",       "paragraphs"),
    (r"\bgraf\b",        "paragraph"),
    (r"\blede\b",        "opening"),
    (r"\bkickers\b",     "closing paragraphs"),
    (r"\bkicker\b",      "closing"),
]


def preserve_case(match: re.Match, replacement: str) -> str:
    """If the matched original is all-caps, return replacement all-caps.
    If first letter is capitalized, capitalize the replacement.
    Otherwise lowercase."""
    matched = match.group(0)
    if matched.isupper():
        return replacement.upper()
    if matched[0].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement


def apply_replacements(text: str) -> tuple[str, int]:
    n_replaced = 0
    for pat, repl in REPLACEMENTS:
        def _sub(m, repl=repl):
            nonlocal n_replaced
            n_replaced += 1
            return preserve_case(m, repl)
        text = re.sub(pat, _sub, text, flags=re.IGNORECASE)
    return text, n_replaced


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Report counts without writing.")
    args = ap.parse_args()

    base = Path(__file__).resolve().parent.parent / "src" / "red_room"
    journalism_only = [
        "legal_skeptic", "data_expert", "human_rights", "partisan",
        "city_editor", "investigations_editor", "opinion_editor",
        "features_editor", "profile_editor", "reviews_editor",
        "explanatory_editor",
    ]

    targets: list[Path] = []
    for name in journalism_only:
        for p in (base / "exemplars" / f"{name}.yaml",
                  base / "prompts" / f"{name}.md"):
            if p.exists():
                targets.append(p)

    grand_total = 0
    for p in targets:
        text = p.read_text()
        new_text, n = apply_replacements(text)
        if n > 0:
            print(f"  {p.relative_to(base.parent.parent)}: {n} replacements",
                  file=sys.stderr)
            grand_total += n
            if not args.dry_run:
                p.write_text(new_text)

    print(f"\nTotal: {grand_total} replacements across {len(targets)} files",
          file=sys.stderr)
    if args.dry_run:
        print("(dry-run: no files modified)", file=sys.stderr)


if __name__ == "__main__":
    main()

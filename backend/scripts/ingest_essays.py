"""
Stage 1 for essay-mode editors: pull essays from several public datasets and
normalize to a common schema. Output: /tmp/essays_filtered.jsonl

Sources:
- PERSUADE 2.0           (nlpatunt/D_persuade_2)        — argumentative w/ holistic
- Feedback Prize ELL     (tcapelle/feedback-prize-...)  — trait scores
- AES2                   (tasksource/AES2-essay-scoring)— supplementary holistic
- ASAP-7                 (llm-aes/asap-7-original)      — narrative (set 7)
- ASAP-8                 (llm-aes/asap-8-original)      — narrative (set 8)
- GRE Issue + Argument   (ETS official PDFs)            — rhetorical/argument

Run:
    .venv/bin/python scripts/ingest_essays.py
"""
from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Iterable

import fitz  # pymupdf
from datasets import load_dataset


OUT = Path("/tmp/essays_filtered.jsonl")

# Length filter: short essays don't have enough material to critique;
# very long essays slow classification and aren't the target user input.
MIN_WORDS = 200
MAX_WORDS = 1500

# Holistic-score thresholds — for sources with a single overall score we
# only keep essays in the lower 2/3 (since strong essays have no critique
# material). Each dataset uses a different scale so we normalize to 0-1.
KEEP_NORMALIZED_SCORE_AT_MOST = 0.75


def words(s: str) -> int:
    return len(s.split())


def emit(out_lines: list[str], row: dict) -> None:
    """Append a normalized essay row to the output buffer."""
    out_lines.append(json.dumps(row))


def normalize_persuade(out: list[str]) -> int:
    """nlpatunt/D_persuade_2 — holistic score 1-6, has prompt + assignment."""
    ds = load_dataset("nlpatunt/D_persuade_2", split="train")
    kept = 0
    for row in ds:
        text = (row.get("full_text") or "").strip()
        if not text or not (MIN_WORDS <= words(text) <= MAX_WORDS):
            continue
        score = row.get("holistic_essay_score")
        if not isinstance(score, (int, float)) or score < 1:
            continue
        # 6-point scale; normalize and drop the top end (no critique material).
        if score / 6.0 > KEEP_NORMALIZED_SCORE_AT_MOST:
            continue
        emit(out, {
            "source": "PERSUADE_2.0",
            "essay_id": row.get("essay_id_comp"),
            "prompt_name": row.get("prompt_name"),
            "assignment": row.get("assignment"),
            "source_text": row.get("source_text") or "",
            "text": text,
            "holistic_score": float(score),
            "holistic_max": 6,
            "traits": {},
            "genre_hint": "argumentative",
        })
        kept += 1
    return kept


def normalize_ell(out: list[str]) -> int:
    """tcapelle/feedback-prize-ELL — six trait scores (1-5) per essay."""
    ds = load_dataset("tcapelle/feedback-prize-english-language-learning-fluency", split="train")
    kept = 0
    for row in ds:
        text = (row.get("full_text") or "").strip()
        if not text or not (MIN_WORDS <= words(text) <= MAX_WORDS):
            continue
        traits = {
            k: row.get(k) for k in ("cohesion", "syntax", "vocabulary",
                                     "phraseology", "grammar", "conventions")
        }
        if not any(isinstance(v, (int, float)) for v in traits.values()):
            continue
        # Keep essays where at least one trait is weak (<= 3) so we have
        # something concrete to critique on.
        weak = [k for k, v in traits.items()
                if isinstance(v, (int, float)) and v <= 3.0]
        if not weak:
            continue
        emit(out, {
            "source": "Feedback_Prize_ELL",
            "essay_id": row.get("text_id"),
            "prompt_name": None,
            "assignment": None,
            "source_text": "",
            "text": text,
            "holistic_score": row.get("mss"),
            "holistic_max": 5,
            "traits": traits,
            "weak_traits": weak,
            "genre_hint": "argumentative_or_expository",
        })
        kept += 1
    return kept


def normalize_aes2(out: list[str]) -> int:
    """tasksource/AES2-essay-scoring — holistic score 1-6, no prompt."""
    ds = load_dataset("tasksource/AES2-essay-scoring", split="train")
    kept = 0
    for row in ds:
        text = (row.get("full_text") or "").strip()
        if not text or not (MIN_WORDS <= words(text) <= MAX_WORDS):
            continue
        score = row.get("score")
        if not isinstance(score, (int, float)) or score < 1:
            continue
        if score / 6.0 > KEEP_NORMALIZED_SCORE_AT_MOST:
            continue
        emit(out, {
            "source": "AES2",
            "essay_id": row.get("essay_id"),
            "prompt_name": None,
            "assignment": None,
            "source_text": "",
            "text": text,
            "holistic_score": float(score),
            "holistic_max": 6,
            "traits": {},
            "genre_hint": "argumentative",
        })
        kept += 1
    return kept


def normalize_asap(set_num: int, out: list[str]) -> int:
    """llm-aes/asap-{7,8}-original — narrative essays with trait scores."""
    ds = load_dataset(f"llm-aes/asap-{set_num}-original", split="train")
    kept = 0
    max_score = {7: 30, 8: 60}.get(set_num, 60)
    for row in ds:
        text = (row.get("essay") or "").strip()
        if not text or not (MIN_WORDS <= words(text) <= MAX_WORDS):
            continue
        score = row.get("domain1_score")
        if not isinstance(score, (int, float)) or score < 1:
            continue
        if score / max_score > KEEP_NORMALIZED_SCORE_AT_MOST:
            continue
        traits = {
            f"trait{i}": row.get(f"rater1_trait{i}")
            for i in range(1, 7)
            if row.get(f"rater1_trait{i}") is not None
        }
        emit(out, {
            "source": f"ASAP-{set_num}",
            "essay_id": str(row.get("essay_id")),
            "prompt_name": None,
            "assignment": (row.get("prompt") or "")[:500],
            "source_text": "",
            "text": text,
            "holistic_score": float(score),
            "holistic_max": max_score,
            "traits": traits,
            "genre_hint": "narrative" if set_num == 8 else "reflective",
        })
        kept += 1
    return kept


# ----- GRE PDF samples -----

GRE_URLS = {
    "GRE_Issue": "https://www.ets.org/content/dam/ets-org/pdfs/gre/sample-issue-task.pdf",
    "GRE_Argument": "https://www.ets.org/content/dam/ets-org/pdfs/gre/sample-argument-task.pdf",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=20).read()


def pdf_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return "\n\n".join(p.get_text("text") for p in doc)
    finally:
        doc.close()


def parse_gre(text: str, source_label: str) -> list[dict]:
    """The ETS sample PDFs use this structure:
        Essay Response — Score 6
        [essay text]
        Rater Commentary for Essay Response — Score 6
        [commentary text]
        Essay Response — Score 5
        ...
    We find each `Essay Response — Score N` marker, take the text until the
    next `Essay Response — Score M`, and split out the commentary section
    within each chunk.
    """
    # Use a Unicode-aware pattern: match em dash, en dash, or hyphen.
    # Exclude the "Rater Commentary for Essay Response — Score X" headers,
    # which would otherwise also match and confuse the chunk boundaries.
    marker = re.compile(
        r"(?<!for )Essay\s+Response\s*[-—–]\s*Score\s*([1-6])",
        flags=re.IGNORECASE,
    )
    starts = [(m.start(), int(m.group(1)), m.end()) for m in marker.finditer(text)]
    if not starts:
        return []

    out = []
    for i, (start, score, body_start) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        chunk = text[body_start:end]
        # Inside the chunk: essay text, then "Rater Commentary for Essay Response — Score N"
        cm = re.search(
            r"Rater\s+Commentary\s+for\s+Essay\s+Response\s*[-—–]\s*Score\s*[1-6]",
            chunk,
            flags=re.IGNORECASE,
        )
        if cm:
            essay = chunk[:cm.start()].strip()
            commentary = chunk[cm.end():].strip()
        else:
            essay = chunk.strip()
            commentary = ""
        if not essay or len(essay.split()) < 80:
            continue
        out.append({
            "source": source_label,
            "essay_id": f"{source_label}_score{score}",
            "prompt_name": None,
            "assignment": None,
            "source_text": "",
            "text": essay,
            "holistic_score": score,
            "holistic_max": 6,
            "traits": {},
            "scorer_commentary": commentary,
            "genre_hint": "issue_argument",
        })
    return out


def normalize_gre(out: list[str]) -> int:
    kept = 0
    for label, url in GRE_URLS.items():
        try:
            data = fetch(url)
            text = pdf_text(data)
            rows = parse_gre(text, label)
            for r in rows:
                if MIN_WORDS // 2 <= words(r["text"]) <= MAX_WORDS * 2:
                    # tighter score keep — drop the 6s (no critique material)
                    if r["holistic_score"] / 6.0 > KEEP_NORMALIZED_SCORE_AT_MOST:
                        continue
                    emit(out, r)
                    kept += 1
        except Exception as e:
            print(f"  GRE {label} fetch failed: {e}", file=sys.stderr)
    return kept


def main():
    out_lines: list[str] = []

    print("Pulling PERSUADE 2.0...", file=sys.stderr)
    n = normalize_persuade(out_lines)
    print(f"  +{n} essays", file=sys.stderr)

    print("Pulling Feedback Prize ELL...", file=sys.stderr)
    n = normalize_ell(out_lines)
    print(f"  +{n} essays", file=sys.stderr)

    print("Pulling AES2...", file=sys.stderr)
    n = normalize_aes2(out_lines)
    print(f"  +{n} essays", file=sys.stderr)

    print("Pulling ASAP-7 (narrative-leaning)...", file=sys.stderr)
    n = normalize_asap(7, out_lines)
    print(f"  +{n} essays", file=sys.stderr)

    print("Pulling ASAP-8 (narrative)...", file=sys.stderr)
    n = normalize_asap(8, out_lines)
    print(f"  +{n} essays", file=sys.stderr)

    print("Pulling GRE Issue + Argument samples...", file=sys.stderr)
    n = normalize_gre(out_lines)
    print(f"  +{n} essays", file=sys.stderr)

    OUT.write_text("\n".join(out_lines) + "\n")
    print(f"\nTotal: {len(out_lines)} essays → {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()

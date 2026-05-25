"""
Stage 1C: scrape Pitchfork album reviews as exemplar material for Remy
(reviews_editor). Each Pitchfork review is a working critic's exhibit of
review craft — position-taking, specific quoted material from the work,
genre / artist context, sensory specificity.

Sources tried for review craft:
- Pitchfork album reviews (paginated index — ~10 pages × 96 URLs each)
- Pitchfork "Best" reviews (high-quality curated picks)

Output: /tmp/reviews_corpus.jsonl, one review per line.

Run:
    .venv/bin/python scripts/ingest_reviews.py [--max 200]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path


HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux) RedRoom/1.0"}
OUT = Path("/tmp/reviews_corpus.jsonl")


def fetch(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="ignore")


def clean(html: str) -> tuple[str, str, str]:
    """Return (title, rating, body_text)."""
    body = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S)
    body = re.sub(r"<style[^>]*>.*?</style>", " ", body, flags=re.S)
    body = re.sub(r"<nav[^>]*>.*?</nav>", " ", body, flags=re.S)
    body = re.sub(r"<footer[^>]*>.*?</footer>", " ", body, flags=re.S)
    body = re.sub(r"<header[^>]*>.*?</header>", " ", body, flags=re.S)
    tm = re.search(r"<title>([^<]+)</title>", html, flags=re.I)
    title = tm.group(1).strip() if tm else ""
    # Pitchfork ratings live in a span near the top — pull from raw HTML
    rm = re.search(r'class="[^"]*Rating[^"]*"[^>]*>\s*<[^>]+>\s*(\d+(?:\.\d+)?)', html)
    rating = rm.group(1) if rm else ""
    text = re.sub(r"<[^>]+>", " ", body)
    text = re.sub(r"&#8217;|&rsquo;", "'", text)
    text = re.sub(r"&#8216;|&lsquo;", "'", text)
    text = re.sub(r"&#8220;|&ldquo;", '"', text)
    text = re.sub(r"&#8221;|&rdquo;", '"', text)
    text = re.sub(r"&#8211;|&ndash;", "-", text)
    text = re.sub(r"&#8212;|&mdash;", "—", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return title, rating, text


def enumerate_index(max_pages: int = 12) -> list[str]:
    out: set[str] = set()
    for page in range(1, max_pages + 1):
        url = "https://pitchfork.com/reviews/albums/" if page == 1 \
              else f"https://pitchfork.com/reviews/albums/?page={page}"
        try:
            html = fetch(url)
        except Exception:
            break
        urls = re.findall(r"/reviews/albums/[a-z0-9-]+/?", html)
        urls = [f"https://pitchfork.com{u}" if not u.startswith("http") else u for u in urls]
        before = len(out)
        out.update(urls)
        if len(out) == before:
            break
        time.sleep(0.3)
    # Also scrape the "Best" curated list once
    try:
        html = fetch("https://pitchfork.com/reviews/best/albums/")
        urls = re.findall(r"/reviews/albums/[a-z0-9-]+/?", html)
        out.update(f"https://pitchfork.com{u}" if not u.startswith("http") else u for u in urls)
    except Exception:
        pass
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=200)
    args = ap.parse_args()

    print("Enumerating Pitchfork review URLs...", file=sys.stderr)
    urls = enumerate_index()
    print(f"  found {len(urls)} unique review URLs", file=sys.stderr)
    if args.max and len(urls) > args.max:
        urls = urls[: args.max]
        print(f"  capped to {len(urls)}", file=sys.stderr)

    print(f"Fetching {len(urls)} reviews...", file=sys.stderr)
    kept = 0
    errs = 0
    with OUT.open("w") as f:
        for i, u in enumerate(urls):
            try:
                html = fetch(u)
                title, rating, text = clean(html)
                words = len(text.split())
                if words < 500 or words > 4000:
                    continue
                row = {
                    "source": "Pitchfork",
                    "url": u,
                    "title": title,
                    "rating": rating,
                    "body_text": text,
                }
                f.write(json.dumps(row) + "\n")
                kept += 1
            except Exception:
                errs += 1
            if (i + 1) % 25 == 0:
                print(f"  {i+1}/{len(urls)} (kept {kept}, err {errs})",
                      file=sys.stderr)
            time.sleep(0.2)

    print(f"\nDone. Kept {kept}, errors {errs} → {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()

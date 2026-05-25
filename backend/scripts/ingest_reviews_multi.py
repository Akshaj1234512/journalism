"""
Stage 1C+: extend the reviews corpus beyond Pitchfork with AV Club (film,
TV, books, albums via sitemap) and the Guardian (mixed-genre via news
sitemap). Appends to /tmp/reviews_corpus.jsonl (already populated by the
Pitchfork run).

Run:
    .venv/bin/python scripts/ingest_reviews_multi.py [--target-each 100]
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


HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux; rv:120.0) Gecko/20100101 Firefox/120.0"}
OUT = Path("/tmp/reviews_corpus.jsonl")


def fetch(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def clean(html: str) -> tuple[str, str]:
    body = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S)
    body = re.sub(r"<style[^>]*>.*?</style>", " ", body, flags=re.S)
    body = re.sub(r"<nav[^>]*>.*?</nav>", " ", body, flags=re.S)
    body = re.sub(r"<aside[^>]*>.*?</aside>", " ", body, flags=re.S)
    body = re.sub(r"<footer[^>]*>.*?</footer>", " ", body, flags=re.S)
    body = re.sub(r"<header[^>]*>.*?</header>", " ", body, flags=re.S)
    body = re.sub(r"<form[^>]*>.*?</form>", " ", body, flags=re.S)
    tm = re.search(r"<title>([^<]+)</title>", html, flags=re.I)
    title = tm.group(1).strip() if tm else ""
    text = re.sub(r"<[^>]+>", " ", body)
    text = re.sub(r"&#8217;|&rsquo;", "'", text)
    text = re.sub(r"&#8220;|&ldquo;", '"', text)
    text = re.sub(r"&#8221;|&rdquo;", '"', text)
    text = re.sub(r"&#8211;|&ndash;", "-", text)
    text = re.sub(r"&#8212;|&mdash;", "—", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return title, text


def enumerate_avclub(target: int = 150) -> list[str]:
    """Walk a few AV Club sitemaps and collect review URLs."""
    review_urls: set[str] = set()
    # Walk multiple sub-sitemaps until we have enough
    for n in range(1, 20):
        if len(review_urls) >= target * 2:
            break
        sm_url = f"https://www.avclub.com/wp-content/site-maps/sitemap-{n:05d}.xml"
        try:
            body = fetch(sm_url).decode()
        except Exception:
            break
        urls = re.findall(r"<loc>([^<]+)</loc>", body)
        for u in urls:
            if "review" in u.lower():
                review_urls.add(u)
        time.sleep(0.3)
    return sorted(review_urls)


def enumerate_guardian() -> list[str]:
    """Pull the Guardian news sitemap and filter to review-flavored URLs across
    film / books / music / stage / food / tv-and-radio."""
    out: set[str] = set()
    for sm_url in (
        "https://www.theguardian.com/sitemaps/news.xml",
        # The Guardian also has rolling Friday-publication sitemaps, but the
        # `news.xml` covers the past several days and refreshes frequently.
    ):
        try:
            body = fetch(sm_url).decode()
        except Exception:
            continue
        urls = re.findall(r"<loc>([^<]+)</loc>", body)
        for u in urls:
            if "review" not in u.lower():
                continue
            if any(seg in u for seg in ["/film/", "/books/", "/music/",
                                          "/stage/", "/food/", "/tv-and-radio/",
                                          "/games/", "/artanddesign/"]):
                out.add(u)
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-each", type=int, default=100,
                    help="Target reviews per non-Pitchfork source.")
    args = ap.parse_args()

    print("Enumerating AV Club review URLs (via sitemaps)...", file=sys.stderr)
    av = enumerate_avclub(args.target_each)
    print(f"  {len(av)} AV Club review URLs", file=sys.stderr)

    print("Enumerating Guardian review URLs (via sitemap)...", file=sys.stderr)
    guard = enumerate_guardian()
    print(f"  {len(guard)} Guardian review URLs", file=sys.stderr)

    # Cap each to target_each, even spread across sources
    av = av[: args.target_each]
    # Guardian is small — take all
    plan = [("AVClub", u) for u in av] + [("Guardian", u) for u in guard]
    print(f"\nFetching {len(plan)} new reviews...", file=sys.stderr)

    kept = 0
    errs = 0
    # Append to the existing reviews_corpus.jsonl
    with OUT.open("a") as f:
        for i, (src, u) in enumerate(plan):
            try:
                body = fetch(u).decode("utf-8", errors="ignore")
                title, text = clean(body)
                words = len(text.split())
                if words < 400 or words > 5000:
                    continue
                row = {
                    "source": src,
                    "url": u,
                    "title": title,
                    "rating": "",
                    "body_text": text,
                }
                f.write(json.dumps(row) + "\n")
                kept += 1
            except Exception:
                errs += 1
            if (i + 1) % 25 == 0:
                print(f"  {i+1}/{len(plan)} (kept {kept}, err {errs})",
                      file=sys.stderr)
            time.sleep(0.2)

    print(f"\nAppended {kept} reviews ({errs} errors)", file=sys.stderr)
    # Final corpus mix
    from collections import Counter
    c = Counter()
    for line in OUT.read_text().splitlines():
        if line.strip():
            try:
                c[json.loads(line).get("source", "?")] += 1
            except Exception:
                pass
    print(f"\nFinal corpus source mix:", file=sys.stderr)
    for k, v in c.most_common():
        print(f"  {k:<12} {v}", file=sys.stderr)


if __name__ == "__main__":
    main()

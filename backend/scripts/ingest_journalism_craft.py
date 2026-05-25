"""
Stage 1B: scrape real journalism-criticism articles from public sources.
These articles are themselves journalism (often by veteran editors) analyzing
specific journalism craft in specific stories. They contain real editorial-
room observations we can extract as exemplars.

Sources:
- Nieman Storyboard / Annotation Tuesday — line-by-line annotations of features
- Nieman Storyboard / Essays on Craft — craft analyses
- Nieman Storyboard / 5 Questions — interviews where craft is discussed
- Slate Press Box — Jack Shafer's media criticism column

Output: /tmp/journalism_craft.jsonl, one article per line, fields:
  source, url, title, body_text

Body text gets cleaned of HTML and tracking junk so the downstream classifier
sees the actual prose.

Run:
    .venv/bin/python scripts/ingest_journalism_craft.py [--max 200]
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
OUT = Path("/tmp/journalism_craft.jsonl")


def fetch(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="ignore")


def clean(html: str) -> tuple[str, str]:
    # Strip script/style/aside/nav, then strip tags
    body = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S)
    body = re.sub(r"<style[^>]*>.*?</style>", " ", body, flags=re.S)
    body = re.sub(r"<nav[^>]*>.*?</nav>", " ", body, flags=re.S)
    body = re.sub(r"<aside[^>]*>.*?</aside>", " ", body, flags=re.S)
    body = re.sub(r"<footer[^>]*>.*?</footer>", " ", body, flags=re.S)
    body = re.sub(r"<header[^>]*>.*?</header>", " ", body, flags=re.S)
    body = re.sub(r"<form[^>]*>.*?</form>", " ", body, flags=re.S)
    # Title
    tm = re.search(r"<title>([^<]+)</title>", html, flags=re.I)
    title = tm.group(1).strip() if tm else ""
    # Body text
    text = re.sub(r"<[^>]+>", " ", body)
    text = re.sub(r"&nbsp;|&#160;", " ", text)
    text = re.sub(r"&#8217;|&rsquo;", "'", text)
    text = re.sub(r"&#8216;|&lsquo;", "'", text)
    text = re.sub(r"&#8220;|&ldquo;", '"', text)
    text = re.sub(r"&#8221;|&rdquo;", '"', text)
    text = re.sub(r"&#8211;|&ndash;", "-", text)
    text = re.sub(r"&#8212;|&mdash;", "—", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return title, text


def enumerate_nieman(slug: str, max_pages: int = 16) -> list[str]:
    out: set[str] = set()
    for page in range(1, max_pages + 1):
        suffix = "" if page == 1 else f"page/{page}/"
        url = f"https://niemanstoryboard.org/category/{slug}/{suffix}"
        try:
            html = fetch(url)
        except Exception:
            break
        urls = set(re.findall(
            r"https://niemanstoryboard\.org/\d{4}/\d{2}/\d{2}/[a-z0-9-]+/?", html))
        before = len(out)
        out.update(urls)
        if len(out) == before:
            break
        time.sleep(0.3)
    return sorted(out)


def enumerate_slate_pressbox(max_pages: int = 8) -> list[str]:
    out: set[str] = set()
    for page in range(1, max_pages + 1):
        url = f"https://slate.com/news-and-politics/press-box" if page == 1 \
              else f"https://slate.com/news-and-politics/press-box?page={page}"
        try:
            html = fetch(url)
        except Exception:
            break
        urls = set(re.findall(
            r"https://slate\.com/news-and-politics/\d{4}/\d{2}/[a-z0-9-]+\.html", html))
        before = len(out)
        out.update(urls)
        if len(out) == before:
            break
        time.sleep(0.3)
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=300,
                    help="Max articles to fetch across all sources.")
    args = ap.parse_args()

    urls: list[tuple[str, str]] = []

    print("Enumerating Nieman categories...", file=sys.stderr)
    for slug in ("annotation-tuesday", "essays-on-craft", "5-questions"):
        cat_urls = enumerate_nieman(slug)
        for u in cat_urls:
            urls.append((f"Nieman_{slug}", u))
        print(f"  {slug}: {len(cat_urls)} URLs", file=sys.stderr)

    print("Enumerating Slate Press Box...", file=sys.stderr)
    sb_urls = enumerate_slate_pressbox()
    for u in sb_urls:
        urls.append(("Slate_PressBox", u))
    print(f"  Press Box: {len(sb_urls)} URLs", file=sys.stderr)

    # De-dupe by URL (some Nieman pieces appear in multiple categories)
    seen: set[str] = set()
    deduped: list[tuple[str, str]] = []
    for src, u in urls:
        if u in seen:
            continue
        seen.add(u)
        deduped.append((src, u))
    print(f"Total unique: {len(deduped)} URLs", file=sys.stderr)

    if args.max and len(deduped) > args.max:
        # Even sample across sources
        from collections import defaultdict
        by_src = defaultdict(list)
        for src, u in deduped:
            by_src[src].append(u)
        per_src = max(1, args.max // len(by_src))
        sampled = []
        for src, us in by_src.items():
            sampled.extend((src, u) for u in us[:per_src])
        deduped = sampled[: args.max]
        print(f"Capped to {len(deduped)} articles", file=sys.stderr)

    print(f"Fetching {len(deduped)} articles...", file=sys.stderr)
    n_kept = 0
    n_err = 0
    with OUT.open("w") as f:
        for i, (src, u) in enumerate(deduped):
            try:
                html = fetch(u)
                title, text = clean(html)
                words = len(text.split())
                if words < 400 or words > 8000:
                    continue
                row = {"source": src, "url": u, "title": title, "body_text": text}
                f.write(json.dumps(row) + "\n")
                n_kept += 1
            except Exception as e:
                n_err += 1
            if (i + 1) % 25 == 0:
                print(f"  fetched {i+1}/{len(deduped)} (kept {n_kept}, err {n_err})",
                      file=sys.stderr)
            time.sleep(0.2)
    print(f"\nDone. Kept {n_kept}, errors {n_err} → {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()

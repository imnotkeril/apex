from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import feedparser


@dataclass
class ParsedItem:
    raw_text: str
    post_date: datetime
    source_url: str | None
    author: str | None
    content_hash: str


def _content_hash(text: str) -> str:
    sample = text[:500] if text else ""
    return hashlib.md5(sample.encode("utf-8", errors="ignore")).hexdigest()


def parse_rss_feed(source_id_url: str, last_parsed_at: datetime | None) -> list[ParsedItem]:
    """Parse RSS/Atom URL into ParsedItem list (M4 TZ §4.2)."""
    feed = feedparser.parse(source_id_url)
    cutoff = last_parsed_at or (datetime.now(UTC) - timedelta(days=7))
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=UTC)

    out: list[ParsedItem] = []
    for entry in getattr(feed, "entries", []) or []:
        published = entry.get("published_parsed") or entry.get("updated_parsed")
        if not published:
            continue
        try:
            entry_date = datetime(*published[:6], tzinfo=UTC)
        except (TypeError, ValueError):
            continue
        if entry_date <= cutoff:
            continue
        title = entry.get("title") or ""
        summary = entry.get("summary", "") or entry.get("description", "") or ""
        raw_text = f"{title}\n\n{summary}".strip()
        if not raw_text:
            continue
        link = entry.get("link")
        author = entry.get("author")
        out.append(
            ParsedItem(
                raw_text=raw_text,
                post_date=entry_date,
                source_url=str(link) if link else None,
                author=str(author) if author else None,
                content_hash=_content_hash(raw_text),
            )
        )
    return out

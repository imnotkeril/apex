from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ParsedItem:
    raw_text: str
    post_date: datetime
    source_url: str | None
    author: str | None
    content_hash: str
    media_urls: list[str] | None = field(default=None)


def content_hash(text: str) -> str:
    """MD5 of first 500 chars — dedup key per M4 TZ."""
    sample = text[:500] if text else ""
    return hashlib.md5(sample.encode("utf-8", errors="ignore")).hexdigest()

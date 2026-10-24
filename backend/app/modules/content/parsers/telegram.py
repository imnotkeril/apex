from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


@dataclass
class ParsedItem:
    raw_text: str
    post_date: datetime
    source_url: str | None
    author: str | None
    content_hash: str
    media_urls: list[str] | None


def _content_hash(text: str) -> str:
    sample = text[:500] if text else ""
    return hashlib.md5(sample.encode("utf-8", errors="ignore")).hexdigest()


async def parse_telegram_channel(
    source_id: str,
    connection_config: dict[str, Any] | None,
    last_parsed_at: datetime | None,
    min_post_length: int,
    org_id: Any = None,
) -> list[ParsedItem]:
    """
    Parse Telegram channel via Telethon user session (M4 TZ §4.1).
    Requires connection_config.session_string; API ID/hash from org Settings → env fallback.
    """
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError as e:
        raise RuntimeError("telethon is not installed") from e

    from app.core.org_secrets import decrypt_secret, get_secret

    session_string = decrypt_secret((connection_config or {}).get("session_string") or "")
    if not session_string:
        raise ValueError("Telegram source requires connection_config.session_string")

    api_id = await get_secret(org_id, "telegram_api_id") or getattr(settings, "TELEGRAM_API_ID", 0)
    api_hash = await get_secret(org_id, "telegram_api_hash") or getattr(settings, "TELEGRAM_API_HASH", "")
    if not api_id or not api_hash:
        raise ValueError("Telegram API ID/hash must be set (Settings → Integrations or environment)")

    client = TelegramClient(StringSession(session_string), int(api_id), str(api_hash))
    out: list[ParsedItem] = []
    async with client:
        channel = await client.get_entity(source_id)
        kwargs: dict[str, Any] = {"limit": 50}
        if last_parsed_at:
            if last_parsed_at.tzinfo is None:
                last_parsed_at = last_parsed_at.replace(tzinfo=timezone.utc)
            kwargs["offset_date"] = last_parsed_at
        messages = await client.get_messages(channel, **kwargs)
        for msg in messages:
            text = msg.message or ""
            if not text or len(text) < min_post_length:
                continue
            post_date = msg.date
            if post_date.tzinfo is None:
                post_date = post_date.replace(tzinfo=timezone.utc)
            uname = getattr(channel, "username", None) or str(source_id).lstrip("@")
            source_url = f"https://t.me/{uname}/{msg.id}"
            out.append(
                ParsedItem(
                    raw_text=text,
                    post_date=post_date,
                    source_url=source_url,
                    author=getattr(msg.sender, "username", None),
                    content_hash=_content_hash(text),
                    media_urls=None,
                )
            )
    return out

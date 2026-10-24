"""IMAP email parser (M4 TZ §4.5): pull recent messages from a mailbox.

connection_config: {host, port?, username, password, folder?, use_ssl?}
The password may be stored encrypted ("enc:..." Fernet token) — decrypted here.
"""

from __future__ import annotations

import asyncio
import email
import imaplib
from datetime import UTC, datetime, timedelta
from email.header import decode_header
from email.message import Message
from typing import Any

from app.core.org_secrets import decrypt_secret
from app.modules.content.parsers.base import ParsedItem, content_hash

MAX_MESSAGES = 50


def _decode(value: str | None) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    out = []
    for data, enc in parts:
        if isinstance(data, bytes):
            out.append(data.decode(enc or "utf-8", errors="ignore"))
        else:
            out.append(data)
    return "".join(out)


def _body_text(msg: Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition") or ""):
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
        # fallback: first HTML part stripped crudely
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    import re

                    html = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                    return re.sub(r"<[^>]+>", " ", html)
        return ""
    payload = msg.get_payload(decode=True)
    if payload:
        return payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")
    return ""


def _fetch_sync(config: dict[str, Any], since: datetime) -> list[ParsedItem]:
    host = str(config.get("host") or "")
    username = str(config.get("username") or "")
    password = decrypt_secret(str(config.get("password") or "")) or ""
    if not host or not username or not password:
        raise ValueError("IMAP source requires connection_config: host, username, password")
    port = int(config.get("port") or 993)
    folder = str(config.get("folder") or "INBOX")
    use_ssl = bool(config.get("use_ssl", True))

    client = imaplib.IMAP4_SSL(host, port) if use_ssl else imaplib.IMAP4(host, port)
    out: list[ParsedItem] = []
    try:
        client.login(username, password)
        client.select(folder, readonly=True)
        since_str = since.strftime("%d-%b-%Y")
        status, data = client.search(None, f'(SINCE "{since_str}")')
        if status != "OK":
            return []
        ids = (data[0] or b"").split()
        for mid in ids[-MAX_MESSAGES:]:
            status, msg_data = client.fetch(mid, "(RFC822)")
            if status != "OK" or not msg_data or not msg_data[0]:
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            subject = _decode(msg.get("Subject"))
            sender = _decode(msg.get("From"))
            body = _body_text(msg).strip()
            if not body and not subject:
                continue
            date_hdr = msg.get("Date")
            try:
                post_date = email.utils.parsedate_to_datetime(date_hdr) if date_hdr else datetime.now(UTC)
                if post_date.tzinfo is None:
                    post_date = post_date.replace(tzinfo=UTC)
            except (TypeError, ValueError):
                post_date = datetime.now(UTC)
            if post_date <= since:
                continue
            raw_text = f"{subject}\n\n{body}".strip()[:50000]
            out.append(
                ParsedItem(
                    raw_text=raw_text,
                    post_date=post_date,
                    source_url=None,
                    author=sender or None,
                    content_hash=content_hash(raw_text),
                )
            )
    finally:
        try:
            client.logout()
        except Exception:  # noqa: BLE001
            pass
    return out


async def parse_email_inbox(connection_config: dict[str, Any] | None, last_parsed_at: datetime | None) -> list[ParsedItem]:
    since = last_parsed_at or (datetime.now(UTC) - timedelta(days=7))
    if since.tzinfo is None:
        since = since.replace(tzinfo=UTC)
    return await asyncio.to_thread(_fetch_sync, connection_config or {}, since)

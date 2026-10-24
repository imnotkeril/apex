"""Publishers (M4 TZ §8.9): Telegram (Phase 1), Twitter/X and LinkedIn (Phase 2).

All credentials resolve from org-level Settings → Integrations first, then env vars.
Each function returns {"platform_post_id": str | None, "post_url": str | None}.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

import httpx

from app.core.org_secrets import get_secret

PublishResult = dict[str, str | None]


async def publish_to_telegram(text: str, *, org_id: uuid.UUID | str | None = None, chat_id: str | None = None) -> PublishResult:
    """Send plain text to Telegram via Bot API."""
    token = await get_secret(org_id, "telegram_bot_token")
    cid = chat_id or await get_secret(org_id, "telegram_chat_id")
    if not token or not cid:
        raise RuntimeError("Telegram bot token and chat id must be set (Settings → Integrations)")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json={"chat_id": cid, "text": text[:4096], "disable_web_page_preview": True})
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or "Telegram API error")
        msg = data.get("result") or {}
        chat = msg.get("chat") or {}
        username = chat.get("username")
        post_url = f"https://t.me/{username}/{msg.get('message_id')}" if username else None
        return {"platform_post_id": str(msg.get("message_id")), "post_url": post_url}


def _twitter_client(creds: dict[str, str]) -> Any:
    import tweepy  # local import: optional dependency

    return tweepy.Client(
        consumer_key=creds["api_key"],
        consumer_secret=creds["api_secret"],
        access_token=creds["access_token"],
        access_token_secret=creds["access_secret"],
    )


async def publish_to_twitter(
    text: str,
    *,
    org_id: uuid.UUID | str | None = None,
    thread_tweets: list[str] | None = None,
) -> PublishResult:
    """Post a tweet or a thread via Twitter API v2 (OAuth 1.0a user context)."""
    creds = {
        "api_key": await get_secret(org_id, "twitter_api_key"),
        "api_secret": await get_secret(org_id, "twitter_api_secret"),
        "access_token": await get_secret(org_id, "twitter_access_token"),
        "access_secret": await get_secret(org_id, "twitter_access_secret"),
    }
    if not all(creds.values()):
        raise RuntimeError("Twitter/X credentials incomplete (Settings → Integrations: 4 keys required)")

    def _post_sync() -> PublishResult:
        client = _twitter_client(creds)
        tweets = [t for t in (thread_tweets or []) if t.strip()] or [text]
        tweets = tweets[:10]  # TZ §9: cap threads at 10 tweets
        first_id: str | None = None
        reply_to: str | None = None
        for t in tweets:
            resp = client.create_tweet(text=t[:280], in_reply_to_tweet_id=reply_to)
            tid = str(resp.data["id"])
            if first_id is None:
                first_id = tid
            reply_to = tid
        return {"platform_post_id": first_id, "post_url": f"https://x.com/i/status/{first_id}" if first_id else None}

    return await asyncio.to_thread(_post_sync)


async def publish_to_linkedin(text: str, *, org_id: uuid.UUID | str | None = None) -> PublishResult:
    """Publish a text post via LinkedIn UGC Posts API."""
    token = await get_secret(org_id, "linkedin_access_token")
    author = await get_secret(org_id, "linkedin_author_urn")  # e.g. urn:li:person:XXXX
    if not token or not author:
        raise RuntimeError("LinkedIn access token and author URN must be set (Settings → Integrations)")
    payload = {
        "author": author,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text[:2990]},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        post_id = r.headers.get("x-restli-id") or (r.json() or {}).get("id")
        post_url = f"https://www.linkedin.com/feed/update/{post_id}/" if post_id else None
        return {"platform_post_id": str(post_id) if post_id else None, "post_url": post_url}


def _send_smtp(cfg: dict[str, str], message: Any) -> None:
    """Blocking SMTP delivery. Port 465 uses implicit TLS, anything else STARTTLS."""
    import smtplib
    import ssl

    host, port = cfg["host"], int(cfg["port"])
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as smtp:
            _smtp_login_and_send(smtp, cfg, message)
    else:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls(context=context)
            _smtp_login_and_send(smtp, cfg, message)


def _smtp_login_and_send(smtp: Any, cfg: dict[str, str], message: Any) -> None:
    if cfg.get("user"):
        smtp.login(cfg["user"], cfg.get("password", ""))
    smtp.send_message(message)


async def publish_to_email(
    text: str,
    *,
    org_id: uuid.UUID | str | None = None,
    subject: str | None = None,
    html: str | None = None,
) -> PublishResult:
    """Send the draft as an email to the configured recipient list via SMTP."""
    from email.message import EmailMessage
    from email.utils import make_msgid

    cfg = {
        "host": await get_secret(org_id, "smtp_host"),
        "port": await get_secret(org_id, "smtp_port") or "587",
        "user": await get_secret(org_id, "smtp_user"),
        "password": await get_secret(org_id, "smtp_password"),
        "from": await get_secret(org_id, "smtp_from"),
    }
    recipients = [r.strip() for r in (await get_secret(org_id, "email_recipients")).replace(";", ",").split(",") if r.strip()]
    if not cfg["host"] or not cfg["from"] or not recipients:
        raise RuntimeError("Email needs SMTP host, From address and recipients (Settings → Integrations)")
    if not cfg["port"].isdigit():
        raise RuntimeError("SMTP port must be a number")

    msg = EmailMessage()
    msg["Subject"] = (subject or text.strip().splitlines()[0])[:200] if text.strip() else (subject or "APEX")
    msg["From"] = cfg["from"]
    msg["To"] = ", ".join(recipients)
    message_id = make_msgid(domain=cfg["from"].rsplit("@", 1)[-1].strip("<> ") or None)
    msg["Message-ID"] = message_id
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    await asyncio.to_thread(_send_smtp, cfg, msg)
    return {"platform_post_id": message_id, "post_url": None}

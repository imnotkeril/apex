"""Engagement sync (M4 TZ §7 sync_engagement_stats): pull likes/reposts/comments/views from the platform.

Only Twitter/X exposes post metrics through the credentials we already hold. Telegram (bot API),
LinkedIn (UGC posts without the Marketing API) and email give nothing back, so those are reported as
unsupported rather than silently stamped as synced.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from app.core.org_secrets import get_secret
from app.modules.content.models import PublishedPost

Metrics = dict[str, int]

SYNCABLE_PLATFORMS = {"twitter"}


class SyncUnsupported(Exception):
    """The platform has no metrics source for us."""


def parse_twitter_metrics(public_metrics: dict | None) -> Metrics:
    m = public_metrics or {}
    return {
        "likes": int(m.get("like_count") or 0),
        "reposts": int(m.get("retweet_count") or 0) + int(m.get("quote_count") or 0),
        "comments": int(m.get("reply_count") or 0),
        "views": int(m.get("impression_count") or 0),
    }


def _fetch_twitter_sync(creds: dict[str, str], tweet_id: str) -> Metrics:
    from app.modules.content.services.publish import _twitter_client

    resp = _twitter_client(creds).get_tweet(tweet_id, tweet_fields=["public_metrics"], user_auth=True)
    if not resp.data:
        raise RuntimeError("Tweet not found (deleted?)")
    return parse_twitter_metrics(getattr(resp.data, "public_metrics", None) or resp.data.get("public_metrics"))


async def fetch_engagement(post: PublishedPost, org_id: uuid.UUID | str | None = None) -> Metrics:
    """Return fresh metrics for a published post or raise SyncUnsupported / RuntimeError."""
    if post.platform not in SYNCABLE_PLATFORMS:
        raise SyncUnsupported(f"Engagement sync is not available for {post.platform}")
    if not post.platform_post_id:
        raise RuntimeError("Post has no platform id to look up")
    creds = {
        "api_key": await get_secret(org_id, "twitter_api_key"),
        "api_secret": await get_secret(org_id, "twitter_api_secret"),
        "access_token": await get_secret(org_id, "twitter_access_token"),
        "access_secret": await get_secret(org_id, "twitter_access_secret"),
    }
    if not all(creds.values()):
        raise RuntimeError("Twitter/X credentials incomplete (Settings → Integrations)")
    return await asyncio.to_thread(_fetch_twitter_sync, creds, post.platform_post_id)


async def sync_post(post: PublishedPost, fetch=fetch_engagement) -> None:
    """Update one post in place. Raises SyncUnsupported / RuntimeError from the fetcher."""
    metrics = await fetch(post, post.org_id)
    for k, v in metrics.items():
        setattr(post, k, v)
    post.last_synced_at = datetime.now(timezone.utc)


async def sync_many(posts: list[PublishedPost], fetch=fetch_engagement) -> dict[str, int]:
    """Best-effort sync; one failing post never stops the rest."""
    out = {"synced": 0, "unsupported": 0, "failed": 0}
    for post in posts:
        try:
            await sync_post(post, fetch)
            out["synced"] += 1
        except SyncUnsupported:
            out["unsupported"] += 1
        except Exception:  # noqa: BLE001
            out["failed"] += 1
    return out

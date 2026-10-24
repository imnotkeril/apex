"""
Async Redis client for Foundation (cache, future rate limits).

Uses redis.asyncio; connection is created lazily.
"""

from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from redis.asyncio import Redis

_redis: "Redis | None" = None


async def get_redis() -> "Redis":
    global _redis
    if _redis is None:
        import redis.asyncio as redis_async

        _redis = redis_async.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def redis_ping() -> bool:
    client = await get_redis()
    return await client.ping()

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import ContentSource, RawPost
from app.modules.content.parsers import email_imap as email_parser
from app.modules.content.parsers import rss as rss_parser
from app.modules.content.parsers import telegram as tg_parser
from app.modules.content.parsers import web as web_parser
from app.modules.content.parsers import youtube as yt_parser


async def parse_single_source(session: AsyncSession, source_id: uuid.UUID) -> dict[str, int | str | list]:
    """Fetch new items from a content source and persist raw_posts. Returns counts and new post ids."""
    src_result = await session.execute(select(ContentSource).where(ContentSource.id == source_id))
    source = src_result.scalar_one_or_none()
    if not source:
        return {"inserted": 0, "new_post_ids": [], "error": "source_not_found"}

    inserted = 0
    new_post_ids: list[uuid.UUID] = []
    now = datetime.now(timezone.utc)
    try:
        if source.source_type == "rss":
            items = rss_parser.parse_rss_feed(source.source_id, source.last_parsed_at)
        elif source.source_type == "telegram":
            items = await tg_parser.parse_telegram_channel(
                source.source_id,
                source.connection_config,
                source.last_parsed_at,
                source.min_post_length or 0,
                org_id=source.org_id,
            )
        elif source.source_type == "youtube":
            items = await yt_parser.parse_youtube_channel(
                source.source_id,
                source.last_parsed_at,
                org_id=source.org_id,
                preferred_lang=source.default_language or "en",
            )
        elif source.source_type == "web":
            item = await web_parser.parse_web_article(source.source_id)
            items = [item] if item else []
        elif source.source_type == "email":
            items = await email_parser.parse_email_inbox(source.connection_config, source.last_parsed_at)
        else:
            source.last_error = f"Unsupported source_type: {source.source_type}"
            source.error_count = (source.error_count or 0) + 1
            await session.flush()
            return {"inserted": 0, "new_post_ids": [], "error": source.last_error or "unsupported"}

        for it in items:
            media_urls = getattr(it, "media_urls", None)
            stmt = (
                insert(RawPost)
                .values(
                    org_id=source.org_id,
                    source_id=source.id,
                    raw_text=it.raw_text,
                    author=it.author,
                    post_date=it.post_date,
                    source_url=it.source_url,
                    media_urls=media_urls,
                    links=None,
                    language=source.default_language or "en",
                    content_hash=it.content_hash,
                )
                .on_conflict_do_nothing(constraint="uq_raw_posts_org_content_hash")
                .returning(RawPost.id)
            )
            res = await session.execute(stmt)
            row = res.fetchone()
            if row:
                inserted += 1
                new_post_ids.append(row[0])

        source.last_parsed_at = now
        if items:
            source.last_post_date = max(it.post_date for it in items)
        source.total_posts_parsed = (source.total_posts_parsed or 0) + inserted
        source.last_error = None
        await session.flush()
        return {"inserted": inserted, "new_post_ids": new_post_ids, "error": ""}
    except Exception as e:  # noqa: BLE001
        source.error_count = (source.error_count or 0) + 1
        source.last_error = str(e)[:2000]
        await session.flush()
        return {"inserted": inserted, "new_post_ids": new_post_ids, "error": str(e)}


async def parse_all_active_for_org(session: AsyncSession, org_id: uuid.UUID) -> list[uuid.UUID]:
    """Return list of source ids that were scheduled to parse."""
    res = await session.execute(
        select(ContentSource.id).where(ContentSource.org_id == org_id, ContentSource.is_active.is_(True))
    )
    return [row[0] for row in res.all()]

"""Related content for a draft: other raw / published posts that share its topic tags."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import ContentDraft, PublishedPost, RawPost

MAX_RELATED = 8


def _overlap(mine: set[str], theirs: list[str] | None) -> int:
    return len(mine & {t.lower() for t in (theirs or [])})


def rank(mine: set[str], items: list, limit: int = MAX_RELATED) -> list:
    """Highest tag overlap first, then newest; zero overlap is dropped."""
    scored = [(_overlap(mine, i.tags), i) for i in items]
    scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: (x[0], getattr(x[1], "post_date", None) or getattr(x[1], "published_at", None)), reverse=True)
    return [i for _, i in scored[:limit]]


async def populate_related(session: AsyncSession, draft: ContentDraft) -> None:
    """Fill related_raw_ids / related_published_ids from tag overlap (draft tags, else its sources' tags)."""
    own_posts = list(draft.source_post_ids or [])
    tags = {t.lower() for t in (draft.tags or [])}
    if not tags and own_posts:
        r = await session.execute(select(RawPost.tags).where(RawPost.org_id == draft.org_id, RawPost.id.in_(own_posts)))
        for (post_tags,) in r.all():
            tags |= {t.lower() for t in (post_tags or [])}
    if not tags:
        draft.related_raw_ids, draft.related_published_ids = [], []
        return
    tag_list = sorted(tags)
    raw = (
        await session.execute(
            select(RawPost)
            .where(RawPost.org_id == draft.org_id, RawPost.tags.overlap(tag_list), RawPost.id.notin_(own_posts or [draft.id]))
            .order_by(RawPost.post_date.desc())
            .limit(100)
        )
    ).scalars().all()
    pub = (
        await session.execute(
            select(PublishedPost)
            .where(PublishedPost.org_id == draft.org_id, PublishedPost.tags.overlap(tag_list), PublishedPost.draft_id != draft.id)
            .order_by(PublishedPost.published_at.desc())
            .limit(100)
        )
    ).scalars().all()
    draft.related_raw_ids = [p.id for p in rank(tags, list(raw))]
    draft.related_published_ids = [p.id for p in rank(tags, list(pub))]

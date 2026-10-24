from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_router import TaskType, ai_router
from app.modules.content.models import PublishedPost, RawPost, TopicCluster
from app.modules.content.prompts import SUMMARY_SYSTEM, cluster_user_prompt
from app.modules.content.services.embeddings import embed_text


def _strip_json_fence(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        parts = s.split("\n", 1)
        s = parts[1] if len(parts) > 1 else s
        if "```" in s:
            s = s.rsplit("```", 1)[0]
    return s.strip()


async def cluster_topics_for_org(session: AsyncSession, org_id: uuid.UUID) -> int:
    """Run topic clustering for recent analyzed posts. Returns number of clusters created."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    posts_result = await session.execute(
        select(RawPost)
        .where(
            RawPost.org_id == org_id,
            RawPost.status == "analyzed",
            RawPost.post_date >= since,
        )
        .order_by(RawPost.post_date.desc())
        .limit(200)
    )
    posts = list(posts_result.scalars().all())
    if not posts:
        return 0

    pub_since = now - timedelta(days=7)
    pub_result = await session.execute(
        select(PublishedPost).where(PublishedPost.org_id == org_id, PublishedPost.published_at >= pub_since).limit(50)
    )
    published = list(pub_result.scalars().all())
    published_payload = [{"topic": (p.published_text or "")[:200], "tags": p.tags or [], "published_at": p.published_at.isoformat()} for p in published]

    posts_payload = [
        {
            "id": str(p.id),
            "source_id": str(p.source_id),
            "summary": p.summary or "",
            "tags": p.tags or [],
            "post_date": p.post_date.isoformat(),
        }
        for p in posts
    ]

    posts_json = json.dumps(posts_payload)
    published_json = json.dumps(published_payload)

    res = await ai_router.complete(
        TaskType.CONTENT_SYNTHESIS,
        user_prompt=cluster_user_prompt(posts_json, published_json),
        system_prompt=SUMMARY_SYSTEM,
        max_tokens=4096,
        org_id=str(org_id),
        module="content",
    )
    raw = _strip_json_fence(res.get("content") or "[]")
    try:
        clusters_data = json.loads(raw)
    except json.JSONDecodeError:
        return 0
    if not isinstance(clusters_data, list):
        return 0

    created = 0
    for item in clusters_data:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or "Untitled topic"
        description = item.get("description")
        post_ids_str = item.get("post_ids") or []
        pid_list: list[uuid.UUID] = []
        for x in post_ids_str:
            try:
                pid_list.append(uuid.UUID(str(x)))
            except (ValueError, TypeError):
                continue
        tags = item.get("tags") if isinstance(item.get("tags"), list) else None
        priority = item.get("priority") or "medium"
        priority_reason = item.get("priority_reason")
        source_diversity = int(item.get("source_diversity") or 0)
        freshness_hours = float(item.get("freshness_hours") or 0)

        cluster = TopicCluster(
            org_id=org_id,
            title=title,
            description=description,
            tags=tags,
            post_ids=pid_list or None,
            post_count=len(pid_list),
            source_diversity=source_diversity,
            freshness_hours=freshness_hours,
            priority=str(priority),
            priority_reason=priority_reason,
            status="active",
            expires_at=now + timedelta(days=7),
        )
        text_for_embed = f"{title}\n{description or ''}"
        try:
            cluster.embedding = await embed_text(text_for_embed, org_id=org_id)
        except Exception:
            cluster.embedding = None
        session.add(cluster)
        await session.flush()

        for rid in pid_list:
            rp = await session.get(RawPost, rid)
            if rp and rp.org_id == org_id:
                rp.cluster_id = cluster.id
        created += 1

    return created

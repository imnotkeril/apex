from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_router import TaskType, ai_router
from app.modules.content.models import RawPost, TagsConfig
from app.modules.content.prompts import SUMMARY_SYSTEM, summary_user_prompt, tagging_user_prompt
from app.modules.content.services.embeddings import embed_text


async def analyze_raw_post(session: AsyncSession, org_id: uuid.UUID, post_id: uuid.UUID) -> None:
    result = await session.execute(
        select(RawPost).where(RawPost.id == post_id, RawPost.org_id == org_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        return

    tags_rows = await session.execute(select(TagsConfig).where(TagsConfig.org_id == org_id, TagsConfig.is_active.is_(True)))
    tags_list = tags_rows.scalars().all()
    tags_json = json.dumps(
        [
            {"tag_name": t.tag_name, "description": t.description or "", "keywords": t.keywords or []}
            for t in tags_list
        ]
    )

    org_s = str(org_id)
    summary_res = await ai_router.complete(
        TaskType.SUMMARY,
        user_prompt=summary_user_prompt(post.raw_text),
        system_prompt=SUMMARY_SYSTEM,
        max_tokens=256,
        org_id=org_s,
        module="content",
    )
    post.summary = (summary_res.get("content") or "").strip()

    tagging_res = await ai_router.complete(
        TaskType.SUMMARY,
        user_prompt=tagging_user_prompt(post.raw_text, tags_json),
        system_prompt=SUMMARY_SYSTEM,
        max_tokens=128,
        org_id=org_s,
        module="content",
    )
    raw_tags = (tagging_res.get("content") or "").strip()
    post.tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    post.embedding = await embed_text(post.raw_text, org_id=org_id)
    post.status = "analyzed"
    post.analyzed_at = datetime.now(timezone.utc)

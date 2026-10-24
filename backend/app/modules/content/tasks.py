from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.modules.content.models import ContentDraft, ContentSource, PublishedPost, TopicCluster
from app.modules.content.services.analysis import analyze_raw_post
from app.modules.content.services.clustering import cluster_topics_for_org
from app.modules.content.services.parse_service import parse_all_active_for_org, parse_single_source
from app.modules.content.services.pipeline import run_draft_pipeline
from app.modules.content.services.publish import (
    publish_to_email,
    publish_to_linkedin,
    publish_to_telegram,
    publish_to_twitter,
)

logger = logging.getLogger(__name__)


@celery_app.task(name="app.modules.content.tasks.parse_source")
def parse_source(source_id: str) -> dict:
    async def inner() -> dict:
        sid = uuid.UUID(source_id)
        async with AsyncSessionLocal() as session:
            try:
                src = await session.get(ContentSource, sid)
                if not src:
                    return {"inserted": 0, "new_post_ids": [], "error": "source_not_found"}
                org_id = src.org_id
                out = await parse_single_source(session, sid)
                await session.commit()
                for pid in out.get("new_post_ids") or []:
                    analyze_raw_post_task.delay(str(pid), str(org_id))
                return out
            except Exception as e:  # noqa: BLE001
                await session.rollback()
                return {"inserted": 0, "new_post_ids": [], "error": str(e)}

    return asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.analyze_raw_post_task")
def analyze_raw_post_task(post_id: str, org_id: str) -> None:
    async def inner() -> None:
        async with AsyncSessionLocal() as session:
            await analyze_raw_post(session, uuid.UUID(org_id), uuid.UUID(post_id))
            await session.commit()

    asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.cluster_topics")
def cluster_topics(org_id: str) -> dict:
    async def inner() -> dict:
        async with AsyncSessionLocal() as session:
            n = await cluster_topics_for_org(session, uuid.UUID(org_id))
            await session.commit()
            return {"clusters_created": n}

    return asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.run_draft_pipeline")
def run_draft_pipeline_task(draft_id: str, steps: list[str] | None = None) -> None:
    async def inner() -> None:
        async with AsyncSessionLocal() as session:
            await run_draft_pipeline(session, uuid.UUID(draft_id), set(steps) if steps else None)
            await session.commit()

    asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.parse_all_sources")
def parse_all_sources() -> dict[str, int]:
    async def inner() -> dict[str, int]:
        total = 0
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(ContentSource.org_id).distinct())
            org_ids = [row[0] for row in res.all()]
            for org_id in org_ids:
                sids = await parse_all_active_for_org(session, org_id)
                await session.commit()
                for sid in sids:
                    parse_source.delay(str(sid))
                    total += 1
        return {"sources_scheduled": total}

    return asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.generate_recommendations")
def generate_recommendations() -> dict:
    """Every 6h (beat): AI ranks active clusters — which topics are hot right now.
    Writes priority + priority_reason back to topic_clusters; /recommendations reads them."""
    import json as _json

    from app.core.ai_router import TaskType, ai_router
    from app.modules.content.prompts import recommendations_user

    async def inner() -> dict:
        updated = 0
        async with AsyncSessionLocal() as session:
            orgs = await session.execute(select(TopicCluster.org_id).distinct())
            for (org_id,) in orgs.all():
                r = await session.execute(
                    select(TopicCluster).where(TopicCluster.org_id == org_id, TopicCluster.status == "active")
                )
                clusters = list(r.scalars().all())
                if not clusters:
                    continue
                payload = [
                    {
                        "cluster_id": str(c.id),
                        "title": c.title,
                        "tags": c.tags or [],
                        "post_count": c.post_count,
                        "source_diversity": c.source_diversity,
                        "freshness_hours": c.freshness_hours,
                    }
                    for c in clusters
                ]
                try:
                    res = await ai_router.complete(
                        TaskType.SUMMARY,  # Haiku — cheap ranking
                        user_prompt=recommendations_user(_json.dumps(payload, ensure_ascii=False)),
                        system_prompt="Return only valid JSON.",
                        max_tokens=2048,
                        org_id=str(org_id),
                        module="content",
                    )
                    raw = (res.get("content") or "").strip()
                    if raw.startswith("```"):
                        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
                    ranking = {str(x.get("cluster_id")): x for x in _json.loads(raw) if isinstance(x, dict)}
                except Exception as e:  # noqa: BLE001
                    logger.warning("recommendations_failed org=%s error=%s", org_id, e)
                    continue
                for c in clusters:
                    item = ranking.get(str(c.id))
                    if not item:
                        continue
                    if item.get("priority") in ("high", "medium", "low"):
                        c.priority = str(item["priority"])
                    if item.get("reason"):
                        c.priority_reason = str(item["reason"])[:500]
                    updated += 1
                await session.commit()
        return {"clusters_ranked": updated}

    return asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.archive_old_clusters")
def archive_old_clusters() -> None:
    async def inner() -> None:
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as session:
            res = await session.execute(
                select(TopicCluster).where(
                    TopicCluster.expires_at.isnot(None),
                    TopicCluster.expires_at < now,
                    TopicCluster.status == "active",
                )
            )
            for c in res.scalars().all():
                c.status = "archived"
            await session.commit()

    asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.run_auto_mode")
def run_auto_mode() -> dict:
    """Auto-mode (M4 TZ §1.12): hourly beat. For each enabled org whose publish_times
    match the current hour (org timezone), pick the best fresh cluster (weights +
    avoid_repeat_hours + min_source_count + max_posts_per_day) and enqueue a draft
    pipeline. Publishing stays manual review unless the pipeline finishes clean —
    then it publishes to config.publish_to."""
    from app.modules.content.services.auto_mode import run_auto_mode_cycle

    async def inner() -> dict:
        async with AsyncSessionLocal() as session:
            out = await run_auto_mode_cycle(session)
            await session.commit()
            return out

    return asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.auto_publish_when_ready")
def auto_publish_when_ready(draft_id: str, platforms: list[str], languages: list[str], attempts: int = 0) -> dict:
    """Poll a pipeline-created auto-mode draft; publish when ready and fact-check passed."""
    async def inner() -> dict:
        async with AsyncSessionLocal() as session:
            draft = await session.get(ContentDraft, uuid.UUID(draft_id))
            if not draft:
                return {"error": "draft_not_found"}
            status = (draft.pipeline_status or "").lower()
            if status == "ready":
                if (draft.fact_check_status or "").lower() in ("passed", "pending"):
                    publish_draft_task.delay(draft_id, platforms, languages)
                    return {"ok": True, "action": "published"}
                return {"ok": False, "action": "blocked_by_fact_check"}
            if status == "failed":
                return {"ok": False, "action": "pipeline_failed"}
            if attempts < 30:  # up to ~15 minutes
                auto_publish_when_ready.apply_async(
                    args=[draft_id, platforms, languages, attempts + 1], countdown=30
                )
            return {"ok": True, "action": "waiting"}

    return asyncio.run(inner())


def _platform_text(draft: ContentDraft, platform: str, lang: str) -> str:
    """Platform-specific version in draft language; translated styled text otherwise."""
    if lang and lang != draft.language:
        return str((draft.translations or {}).get(lang) or "")
    if platform == "telegram":
        return draft.telegram_version or draft.styled_text or ""
    if platform == "twitter":
        return draft.twitter_version or draft.styled_text or ""
    if platform == "linkedin":
        return draft.linkedin_post_version or draft.styled_text or ""
    return draft.styled_text or ""


async def _publish_draft(draft_id: str, platforms: list[str], languages: list[str]) -> dict:
    async with AsyncSessionLocal() as session:
        draft = await session.get(ContentDraft, uuid.UUID(draft_id))
        if not draft:
            return {"error": "draft_not_found"}
        langs = languages or [draft.language]
        published = 0
        errors: list[str] = []
        for platform in platforms:
            if platform == "local":
                continue  # handled below — local archive always saved
            if platform not in ("telegram", "twitter", "linkedin", "email"):
                errors.append(f"{platform}: unsupported")
                continue
            for lang in langs:
                text = _platform_text(draft, platform, lang)
                if not text:
                    errors.append(f"{platform}/{lang}: no text")
                    continue
                try:
                    if platform == "telegram":
                        info = await publish_to_telegram(text, org_id=draft.org_id)
                    elif platform == "twitter":
                        thread = None
                        if draft.twitter_is_thread and isinstance(draft.twitter_thread_tweets, list):
                            thread = [str(t) for t in draft.twitter_thread_tweets]
                        info = await publish_to_twitter(text, org_id=draft.org_id, thread_tweets=thread)
                    elif platform == "email":
                        info = await publish_to_email(
                            text,
                            org_id=draft.org_id,
                            subject=draft.email_subject or draft.topic,
                            html=draft.email_html_version if lang == draft.language else None,
                        )
                    else:
                        info = await publish_to_linkedin(text, org_id=draft.org_id)
                except Exception as e:  # noqa: BLE001
                    errors.append(f"{platform}/{lang}: {e}")
                    logger.warning("publish_failed draft_id=%s platform=%s error=%s", draft_id, platform, e)
                    continue
                session.add(
                    PublishedPost(
                        org_id=draft.org_id,
                        draft_id=draft.id,
                        platform=platform,
                        platform_post_id=info.get("platform_post_id"),
                        post_url=info.get("post_url"),
                        published_text=text,
                        language=lang,
                        tags=draft.tags,
                    )
                )
                published += 1
        external = published
        # The final text is ALWAYS archived locally, even when every external
        # platform failed or none was selected — output must never be lost.
        if published == 0:
            local_text = _platform_text(draft, "local", draft.language)
            if local_text:
                session.add(
                    PublishedPost(
                        org_id=draft.org_id,
                        draft_id=draft.id,
                        platform="local",
                        published_text=local_text,
                        language=draft.language,
                        tags=draft.tags,
                    )
                )
                published += 1
        if published:
            draft.status = "published"
            draft.published_at = datetime.now(timezone.utc)
        await session.commit()

        if published:
            from app.models.organisation import Organisation
            from app.modules.content.notifications import send_notification

            pub_org = await session.get(Organisation, draft.org_id)
            if pub_org:
                await send_notification(pub_org, "published", f'APEX: draft "{draft.topic}" was published.')

        return {"ok": published > 0, "published": published, "external_published": external, "errors": errors}


@celery_app.task(name="app.modules.content.tasks.publish_draft_task")
def publish_draft_task(draft_id: str, platforms: list[str], languages: list[str]) -> dict:
    return asyncio.run(_publish_draft(draft_id, platforms, languages))


@celery_app.task(name="app.modules.content.tasks.publish_due_calendar")
def publish_due_calendar() -> dict:
    """Beat (every minute): publish calendar entries whose scheduled time has come."""
    from app.modules.content.services.scheduler import publish_due_entries

    async def inner() -> dict:
        async with AsyncSessionLocal() as session:
            return await publish_due_entries(session, _publish_draft)

    return asyncio.run(inner())


@celery_app.task(name="app.modules.content.tasks.sync_engagement_stats")
def sync_engagement_stats(published_post_id: str | None = None) -> dict:
    """Beat (daily): refresh metrics of recent posts on platforms that expose them; or one post by id."""
    from datetime import timedelta

    from app.modules.content.services.engagement import SYNCABLE_PLATFORMS, sync_many

    async def inner() -> dict:
        async with AsyncSessionLocal() as session:
            q = select(PublishedPost)
            if published_post_id:
                q = q.where(PublishedPost.id == uuid.UUID(published_post_id))
            else:
                q = q.where(
                    PublishedPost.platform.in_(SYNCABLE_PLATFORMS),
                    PublishedPost.published_at >= datetime.now(timezone.utc) - timedelta(days=14),
                )
            posts = list((await session.execute(q)).scalars().all())
            result = await sync_many(posts)
            await session.commit()
            return result

    return asyncio.run(inner())

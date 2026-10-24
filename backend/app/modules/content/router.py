from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ResourceNotFoundException
from app.models.user import User
from app.modules.content.models import (
    AutoModeConfig,
    AutoModeRun,
    ContentCalendarEntry,
    ContentDraft,
    ContentLink,
    ContentSource,
    ImageStylePreset,
    PublishedPost,
    RawPost,
    StylePreset,
    TagsConfig,
    TopicCluster,
)
from app.modules.content.schemas import (
    AutoModeActivity,
    AutoModeRead,
    AutoModeUpdate,
    CalendarEntryRead,
    CalendarReschedule,
    ContentSourceCreate,
    ContentSourceRead,
    ContentSourceUpdate,
    CustomInputCreate,
    DraftCreate,
    DraftDetailRead,
    DraftPatch,
    DraftRead,
    GraphData,
    GraphEdge,
    GraphNode,
    GraphStats,
    ImageStylePresetCreate,
    ImageStylePresetRead,
    ImageStylePresetUpdate,
    ManualLinkCreate,
    PublishBody,
    PublishedPostRead,
    RawPostPatch,
    RawPostRead,
    RelatedContent,
    StylePresetCreate,
    StylePresetRead,
    StylePresetUpdate,
    TagsConfigCreate,
    TagsConfigRead,
    TagsConfigUpdate,
    TopicClusterRead,
)
from app.modules.content.services import chart_render, engagement, style_versions
from app.modules.content.services.auto_mode import build_activity
from app.modules.content.tasks import (
    cluster_topics,
    parse_source,
    publish_draft_task,
    run_draft_pipeline_task,
)

router = APIRouter()

# connection_config keys that must never be stored in plain text
_SENSITIVE_CONFIG_KEYS = {"password", "session_string", "api_hash", "token", "secret"}


def _encrypt_connection_config(config: dict | None) -> dict | None:
    """Encrypt sensitive connection_config values (idempotent — skips already-encrypted)."""
    if not config:
        return config
    from app.core.org_secrets import encrypt_secret

    out = dict(config)
    for k, v in out.items():
        if k in _SENSITIVE_CONFIG_KEYS and isinstance(v, str) and v and not v.startswith("enc:"):
            out[k] = encrypt_secret(v)
    return out


@router.get("/sources", response_model=list[ContentSourceRead])
async def list_sources(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[ContentSource]:
    r = await db.execute(select(ContentSource).where(ContentSource.org_id == current_user.org_id))
    return list(r.scalars().all())


@router.post("/sources", response_model=ContentSourceRead, status_code=status.HTTP_201_CREATED)
async def create_source(
    body: ContentSourceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ContentSource:
    data = body.model_dump()
    data["connection_config"] = _encrypt_connection_config(data.get("connection_config"))
    src = ContentSource(org_id=current_user.org_id, **data)
    db.add(src)
    await db.flush()
    await db.refresh(src)
    return src


@router.put("/sources/{source_id}", response_model=ContentSourceRead)
async def update_source(
    source_id: uuid.UUID,
    body: ContentSourceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ContentSource:
    r = await db.execute(
        select(ContentSource).where(ContentSource.id == source_id, ContentSource.org_id == current_user.org_id)
    )
    src = r.scalar_one_or_none()
    if not src:
        raise ResourceNotFoundException("ContentSource", str(source_id))
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "connection_config":
            v = _encrypt_connection_config(v)
        setattr(src, k, v)
    await db.flush()
    await db.refresh(src)
    return src


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_source(
    source_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(
        select(ContentSource).where(ContentSource.id == source_id, ContentSource.org_id == current_user.org_id)
    )
    src = r.scalar_one_or_none()
    if not src:
        raise ResourceNotFoundException("ContentSource", str(source_id))
    await db.execute(delete(ContentSource).where(ContentSource.id == source_id, ContentSource.org_id == current_user.org_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sources/{source_id}/parse")
async def trigger_parse(
    source_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    r = await db.execute(
        select(ContentSource).where(ContentSource.id == source_id, ContentSource.org_id == current_user.org_id)
    )
    if not r.scalar_one_or_none():
        raise ResourceNotFoundException("ContentSource", str(source_id))
    parse_source.delay(str(source_id))
    return {"status": "queued"}


@router.post("/sources/parse-all")
async def trigger_parse_all(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    r = await db.execute(
        select(ContentSource.id).where(ContentSource.org_id == current_user.org_id, ContentSource.is_active.is_(True))
    )
    for (sid,) in r.all():
        parse_source.delay(str(sid))
    return {"status": "queued"}


@router.get("/raw-posts", response_model=list[RawPostRead])
async def list_raw_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
) -> list[RawPost]:
    q = select(RawPost).where(RawPost.org_id == current_user.org_id)
    if status_filter:
        q = q.where(RawPost.status == status_filter)
    q = q.order_by(RawPost.post_date.desc()).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


@router.get("/raw-posts/{post_id}", response_model=RawPostRead)
async def get_raw_post(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> RawPost:
    r = await db.execute(select(RawPost).where(RawPost.id == post_id, RawPost.org_id == current_user.org_id))
    post = r.scalar_one_or_none()
    if not post:
        raise ResourceNotFoundException("RawPost", str(post_id))
    return post


@router.patch("/raw-posts/{post_id}", response_model=RawPostRead)
async def patch_raw_post(
    post_id: uuid.UUID,
    body: RawPostPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> RawPost:
    r = await db.execute(select(RawPost).where(RawPost.id == post_id, RawPost.org_id == current_user.org_id))
    post = r.scalar_one_or_none()
    if not post:
        raise ResourceNotFoundException("RawPost", str(post_id))
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(post, k, v)
    await db.flush()
    await db.refresh(post)
    return post


@router.get("/clusters", response_model=list[TopicClusterRead])
async def list_clusters(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[TopicCluster]:
    r = await db.execute(
        select(TopicCluster)
        .where(TopicCluster.org_id == current_user.org_id, TopicCluster.status == "active")
        .order_by(TopicCluster.updated_at.desc())
    )
    return list(r.scalars().all())


@router.post("/clusters/refresh")
async def refresh_clusters(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    cluster_topics.delay(str(current_user.org_id))
    return {"status": "queued"}


@router.post("/clusters/{cluster_id}/dismiss")
async def dismiss_cluster(
    cluster_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    r = await db.execute(
        select(TopicCluster).where(TopicCluster.id == cluster_id, TopicCluster.org_id == current_user.org_id)
    )
    c = r.scalar_one_or_none()
    if not c:
        raise ResourceNotFoundException("TopicCluster", str(cluster_id))
    c.status = "dismissed"
    await db.flush()
    return {"status": "ok"}


@router.get("/drafts", response_model=list[DraftRead])
async def list_drafts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    status_filter: str | None = Query(None, alias="status"),
) -> list[ContentDraft]:
    q = select(ContentDraft).where(ContentDraft.org_id == current_user.org_id)
    if status_filter:
        q = q.where(ContentDraft.status == status_filter)
    q = q.order_by(ContentDraft.created_at.desc()).limit(100)
    r = await db.execute(q)
    return list(r.scalars().all())


@router.post("/drafts", response_model=DraftRead, status_code=status.HTTP_201_CREATED)
async def create_draft(
    body: DraftCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ContentDraft:
    draft = ContentDraft(
        org_id=current_user.org_id,
        created_by_user_id=current_user.id,
        topic=body.topic,
        source_post_ids=body.source_post_ids,
        cluster_id=body.cluster_id,
        style_preset_id=body.style_preset_id,
        language=body.language,
        tags=body.tags,
        requested_formats=body.output_formats,
        translation_targets=body.translation_targets,
        source_type="manual",
    )
    db.add(draft)
    await db.flush()
    await db.refresh(draft)
    run_draft_pipeline_task.delay(str(draft.id))
    return draft


@router.get("/drafts/{draft_id}", response_model=DraftDetailRead)
async def get_draft(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ContentDraft:
    r = await db.execute(select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id))
    d = r.scalar_one_or_none()
    if not d:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    return d


@router.get("/drafts/{draft_id}/status")
async def draft_status(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str | None]:
    r = await db.execute(select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id))
    d = r.scalar_one_or_none()
    if not d:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    return {"pipeline_status": d.pipeline_status, "pipeline_error": d.pipeline_error, "status": d.status}


@router.post("/drafts/{draft_id}/publish")
async def publish_draft(
    draft_id: uuid.UUID,
    body: PublishBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    r = await db.execute(select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id))
    draft = r.scalar_one_or_none()
    if not draft:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    when = body.scheduled_at
    if when and when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    if when and when > datetime.now(timezone.utc):
        # Future time: park it on the calendar; the minutely beat task publishes it when due.
        entry = ContentCalendarEntry(
            org_id=current_user.org_id,
            draft_id=draft.id,
            scheduled_at=when,
            platforms=body.platforms,
            languages=body.languages,
        )
        db.add(entry)
        draft.status = "scheduled"
        await db.flush()
        return {"status": "scheduled", "calendar_entry_id": str(entry.id)}
    publish_draft_task.delay(str(draft_id), body.platforms, body.languages)
    return {"status": "queued"}


@router.get("/tags", response_model=list[TagsConfigRead])
async def list_tags(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[TagsConfig]:
    r = await db.execute(select(TagsConfig).where(TagsConfig.org_id == current_user.org_id))
    return list(r.scalars().all())


@router.post("/tags", response_model=TagsConfigRead, status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: TagsConfigCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> TagsConfig:
    t = TagsConfig(org_id=current_user.org_id, **body.model_dump(), is_system=False)
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return t


@router.get("/style-presets", response_model=list[StylePresetRead])
async def list_styles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[StylePreset]:
    r = await db.execute(select(StylePreset).where(StylePreset.org_id == current_user.org_id))
    return list(r.scalars().all())


@router.post("/style-presets", response_model=StylePresetRead, status_code=status.HTTP_201_CREATED)
async def create_style(
    body: StylePresetCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> StylePreset:
    sp = StylePreset(
        org_id=current_user.org_id,
        name=body.name,
        display_name=body.display_name,
        language=body.language,
        system_prompt=body.system_prompt,
        rewrite_instructions=body.rewrite_instructions,
        synthesis_instructions=body.synthesis_instructions,
        temperature=body.temperature,
    )
    db.add(sp)
    await db.flush()
    await db.refresh(sp)
    return sp


@router.get("/auto-mode", response_model=AutoModeRead)
async def get_auto_mode(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> AutoModeConfig:
    r = await db.execute(select(AutoModeConfig).where(AutoModeConfig.org_id == current_user.org_id))
    cfg = r.scalar_one_or_none()
    if not cfg:
        cfg = AutoModeConfig(org_id=current_user.org_id)
        db.add(cfg)
        await db.flush()
        await db.refresh(cfg)
    return cfg


@router.put("/auto-mode", response_model=AutoModeRead)
async def put_auto_mode(
    body: AutoModeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> AutoModeConfig:
    r = await db.execute(select(AutoModeConfig).where(AutoModeConfig.org_id == current_user.org_id))
    cfg = r.scalar_one_or_none()
    if not cfg:
        cfg = AutoModeConfig(org_id=current_user.org_id)
        db.add(cfg)
        await db.flush()
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    await db.flush()
    await db.refresh(cfg)
    return cfg


@router.get("/dashboard-stats")
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    oid = current_user.org_id
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    d1, d2 = now - timedelta(hours=24), now - timedelta(hours=48)
    w1, w2 = now - timedelta(days=7), now - timedelta(days=14)

    async def count(stmt) -> int:
        return int((await db.execute(stmt)).scalar_one() or 0)

    def pct(curr: int, prev: int) -> int:
        if prev <= 0:
            return 0
        return round((curr - prev) / prev * 100)

    # new posts (24h) + prior 24h for delta — count by post_date (parsed/ingested time)
    new_24 = await count(select(func.count()).select_from(RawPost).where(
        RawPost.org_id == oid, RawPost.post_date >= d1))
    new_prev = await count(select(func.count()).select_from(RawPost).where(
        RawPost.org_id == oid, RawPost.post_date >= d2, RawPost.post_date < d1))

    active_clusters = await count(select(func.count()).select_from(TopicCluster).where(
        TopicCluster.org_id == oid, TopicCluster.status == "active"))

    drafts_ready = await count(select(func.count()).select_from(ContentDraft).where(
        ContentDraft.org_id == oid, ContentDraft.status == "ready"))
    drafts_prev = await count(select(func.count()).select_from(ContentDraft).where(
        ContentDraft.org_id == oid, ContentDraft.status == "ready",
        ContentDraft.created_at >= w2, ContentDraft.created_at < w1))

    pub_week = await count(select(func.count()).select_from(PublishedPost).where(
        PublishedPost.org_id == oid, PublishedPost.published_at >= w1))
    pub_prev = await count(select(func.count()).select_from(PublishedPost).where(
        PublishedPost.org_id == oid, PublishedPost.published_at >= w2, PublishedPost.published_at < w1))

    views_week = await count(select(func.coalesce(func.sum(PublishedPost.views), 0)).where(
        PublishedPost.org_id == oid, PublishedPost.published_at >= w1))
    views_prev = await count(select(func.coalesce(func.sum(PublishedPost.views), 0)).where(
        PublishedPost.org_id == oid, PublishedPost.published_at >= w2, PublishedPost.published_at < w1))

    return {
        "new_posts_24h": new_24,
        "new_posts_24h_delta": pct(new_24, new_prev),
        "active_clusters": active_clusters,
        "drafts_ready": drafts_ready,
        "drafts_ready_delta": pct(drafts_ready, drafts_prev),
        "published_this_week": pub_week,
        "published_this_week_delta": pct(pub_week, pub_prev),
        "total_views_week": views_week,
        "total_views_week_delta": pct(views_week, views_prev),
    }


# ════════════════════════════════════════════════════════════════════
# Clusters (extended)
# ════════════════════════════════════════════════════════════════════
@router.get("/clusters/{cluster_id}", response_model=TopicClusterRead)
async def get_cluster(
    cluster_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> TopicCluster:
    r = await db.execute(
        select(TopicCluster).where(TopicCluster.id == cluster_id, TopicCluster.org_id == current_user.org_id)
    )
    c = r.scalar_one_or_none()
    if not c:
        raise ResourceNotFoundException("TopicCluster", str(cluster_id))
    return c


# ════════════════════════════════════════════════════════════════════
# Drafts (extended): patch, delete, related
# ════════════════════════════════════════════════════════════════════
@router.patch("/drafts/{draft_id}", response_model=DraftDetailRead)
async def patch_draft(
    draft_id: uuid.UUID,
    body: DraftPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ContentDraft:
    r = await db.execute(
        select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id)
    )
    d = r.scalar_one_or_none()
    if not d:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    changes = body.model_dump(exclude_unset=True)
    if changes.get("chart_data"):
        try:
            chart_render.validate(changes["chart_data"])
        except chart_render.InvalidChartData as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    for k, v in changes.items():
        setattr(d, k, v)
    await db.flush()
    await db.refresh(d)
    return d


@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_draft(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(
        select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id)
    )
    if not r.scalar_one_or_none():
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    await db.execute(delete(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/drafts/{draft_id}/related", response_model=RelatedContent)
async def draft_related(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> RelatedContent:
    r = await db.execute(
        select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id)
    )
    d = r.scalar_one_or_none()
    if not d:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    raw: list[RawPost] = []
    pub: list[PublishedPost] = []
    if d.related_raw_ids:
        rr = await db.execute(select(RawPost).where(RawPost.id.in_(d.related_raw_ids)))
        raw = list(rr.scalars().all())
    if d.related_published_ids:
        rp = await db.execute(select(PublishedPost).where(PublishedPost.id.in_(d.related_published_ids)))
        pub = list(rp.scalars().all())
    return RelatedContent(
        raw=[RawPostRead.model_validate(x) for x in raw],
        published=[PublishedPostRead.model_validate(x) for x in pub],
    )


# ════════════════════════════════════════════════════════════════════
# Published posts
# ════════════════════════════════════════════════════════════════════
@router.get("/published", response_model=list[PublishedPostRead])
async def list_published(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    platform: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[PublishedPost]:
    q = select(PublishedPost).where(PublishedPost.org_id == current_user.org_id)
    if platform:
        q = q.where(PublishedPost.platform == platform)
    q = q.order_by(PublishedPost.published_at.desc()).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


@router.get("/published/{post_id}", response_model=PublishedPostRead)
async def get_published(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> PublishedPost:
    r = await db.execute(
        select(PublishedPost).where(PublishedPost.id == post_id, PublishedPost.org_id == current_user.org_id)
    )
    p = r.scalar_one_or_none()
    if not p:
        raise ResourceNotFoundException("PublishedPost", str(post_id))
    return p


@router.post("/published/{post_id}/sync", response_model=PublishedPostRead)
async def sync_published(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> PublishedPost:
    r = await db.execute(
        select(PublishedPost).where(PublishedPost.id == post_id, PublishedPost.org_id == current_user.org_id)
    )
    p = r.scalar_one_or_none()
    if not p:
        raise ResourceNotFoundException("PublishedPost", str(post_id))
    try:
        await engagement.sync_post(p)
    except engagement.SyncUnsupported as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Platform sync failed: {e}")
    await db.flush()
    await db.refresh(p)
    return p


# ════════════════════════════════════════════════════════════════════
# Calendar
# ════════════════════════════════════════════════════════════════════
@router.get("/calendar", response_model=list[CalendarEntryRead])
async def list_calendar(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
) -> list[ContentCalendarEntry]:
    q = select(ContentCalendarEntry).where(ContentCalendarEntry.org_id == current_user.org_id)
    if date_from:
        q = q.where(ContentCalendarEntry.scheduled_at >= date_from)
    if date_to:
        q = q.where(ContentCalendarEntry.scheduled_at <= date_to)
    q = q.order_by(ContentCalendarEntry.scheduled_at.asc())
    r = await db.execute(q)
    return list(r.scalars().all())


@router.put("/calendar/{entry_id}/reschedule", response_model=CalendarEntryRead)
async def reschedule_calendar(
    entry_id: uuid.UUID,
    body: CalendarReschedule,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ContentCalendarEntry:
    r = await db.execute(
        select(ContentCalendarEntry).where(
            ContentCalendarEntry.id == entry_id, ContentCalendarEntry.org_id == current_user.org_id
        )
    )
    e = r.scalar_one_or_none()
    if not e:
        raise ResourceNotFoundException("ContentCalendarEntry", str(entry_id))
    e.scheduled_at = body.scheduled_at
    await db.flush()
    await db.refresh(e)
    return e


@router.delete("/calendar/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_calendar(
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(
        select(ContentCalendarEntry).where(
            ContentCalendarEntry.id == entry_id, ContentCalendarEntry.org_id == current_user.org_id
        )
    )
    entry = r.scalar_one_or_none()
    if not entry:
        raise ResourceNotFoundException("ContentCalendarEntry", str(entry_id))
    if entry.status == "scheduled":
        scheduled_draft = await db.get(ContentDraft, entry.draft_id)
        if scheduled_draft and scheduled_draft.status == "scheduled":
            scheduled_draft.status = "draft"  # cancelled before it went out
    await db.execute(
        delete(ContentCalendarEntry).where(
            ContentCalendarEntry.id == entry_id, ContentCalendarEntry.org_id == current_user.org_id
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ════════════════════════════════════════════════════════════════════
# Style presets (extended): update, delete, duplicate
# ════════════════════════════════════════════════════════════════════
@router.put("/style-presets/{preset_id}", response_model=StylePresetRead)
async def update_style(
    preset_id: uuid.UUID,
    body: StylePresetUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> StylePreset:
    r = await db.execute(
        select(StylePreset).where(StylePreset.id == preset_id, StylePreset.org_id == current_user.org_id)
    )
    sp = r.scalar_one_or_none()
    if not sp:
        raise ResourceNotFoundException("StylePreset", str(preset_id))
    style_versions.apply_update(sp, body.model_dump(exclude_unset=True))
    await db.flush()
    await db.refresh(sp)
    return sp


@router.delete("/style-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_style(
    preset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(
        select(StylePreset).where(StylePreset.id == preset_id, StylePreset.org_id == current_user.org_id)
    )
    if not r.scalar_one_or_none():
        raise ResourceNotFoundException("StylePreset", str(preset_id))
    await db.execute(delete(StylePreset).where(StylePreset.id == preset_id, StylePreset.org_id == current_user.org_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/style-presets/{preset_id}/duplicate", response_model=StylePresetRead, status_code=status.HTTP_201_CREATED)
async def duplicate_style(
    preset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> StylePreset:
    r = await db.execute(
        select(StylePreset).where(StylePreset.id == preset_id, StylePreset.org_id == current_user.org_id)
    )
    sp = r.scalar_one_or_none()
    if not sp:
        raise ResourceNotFoundException("StylePreset", str(preset_id))
    copy = StylePreset(
        org_id=current_user.org_id,
        name=f"{sp.name}_copy_{uuid.uuid4().hex[:6]}",
        display_name=f"{sp.display_name} (copy)",
        description=sp.description,
        language=sp.language,
        system_prompt=sp.system_prompt,
        synthesis_instructions=sp.synthesis_instructions,
        rewrite_instructions=sp.rewrite_instructions,
        temperature=sp.temperature,
        is_default=False,
    )
    db.add(copy)
    await db.flush()
    await db.refresh(copy)
    return copy


# ════════════════════════════════════════════════════════════════════
# Image style presets (CRUD)
# ════════════════════════════════════════════════════════════════════
@router.get("/image-style-presets", response_model=list[ImageStylePresetRead])
async def list_image_styles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[ImageStylePreset]:
    r = await db.execute(select(ImageStylePreset).where(ImageStylePreset.org_id == current_user.org_id))
    return list(r.scalars().all())


@router.post("/image-style-presets", response_model=ImageStylePresetRead, status_code=status.HTTP_201_CREATED)
async def create_image_style(
    body: ImageStylePresetCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ImageStylePreset:
    isp = ImageStylePreset(org_id=current_user.org_id, **body.model_dump())
    db.add(isp)
    await db.flush()
    await db.refresh(isp)
    return isp


@router.put("/image-style-presets/{preset_id}", response_model=ImageStylePresetRead)
async def update_image_style(
    preset_id: uuid.UUID,
    body: ImageStylePresetUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> ImageStylePreset:
    r = await db.execute(
        select(ImageStylePreset).where(ImageStylePreset.id == preset_id, ImageStylePreset.org_id == current_user.org_id)
    )
    isp = r.scalar_one_or_none()
    if not isp:
        raise ResourceNotFoundException("ImageStylePreset", str(preset_id))
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(isp, k, v)
    await db.flush()
    await db.refresh(isp)
    return isp


@router.delete("/image-style-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_image_style(
    preset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(
        select(ImageStylePreset).where(ImageStylePreset.id == preset_id, ImageStylePreset.org_id == current_user.org_id)
    )
    if not r.scalar_one_or_none():
        raise ResourceNotFoundException("ImageStylePreset", str(preset_id))
    await db.execute(
        delete(ImageStylePreset).where(
            ImageStylePreset.id == preset_id, ImageStylePreset.org_id == current_user.org_id
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ════════════════════════════════════════════════════════════════════
# Tags (extended): update, delete (non-system only)
# ════════════════════════════════════════════════════════════════════
@router.put("/tags/{tag_id}", response_model=TagsConfigRead)
async def update_tag(
    tag_id: uuid.UUID,
    body: TagsConfigUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> TagsConfig:
    r = await db.execute(select(TagsConfig).where(TagsConfig.id == tag_id, TagsConfig.org_id == current_user.org_id))
    t = r.scalar_one_or_none()
    if not t:
        raise ResourceNotFoundException("TagsConfig", str(tag_id))
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    await db.flush()
    await db.refresh(t)
    return t


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_tag(
    tag_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(select(TagsConfig).where(TagsConfig.id == tag_id, TagsConfig.org_id == current_user.org_id))
    t = r.scalar_one_or_none()
    if not t:
        raise ResourceNotFoundException("TagsConfig", str(tag_id))
    if t.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System tags cannot be deleted")
    await db.execute(delete(TagsConfig).where(TagsConfig.id == tag_id, TagsConfig.org_id == current_user.org_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ════════════════════════════════════════════════════════════════════
# Knowledge graph
# ════════════════════════════════════════════════════════════════════
@router.get("/graph", response_model=GraphData)
async def get_graph(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    types: str = Query("raw,published"),
    limit: int = Query(150, ge=1, le=500),
) -> GraphData:
    oid = current_user.org_id
    want = {t.strip() for t in types.split(",") if t.strip()}
    nodes: list[GraphNode] = []
    raw_count = 0
    pub_count = 0

    if "raw" in want:
        rr = await db.execute(
            select(RawPost).where(RawPost.org_id == oid).order_by(RawPost.post_date.desc()).limit(limit)
        )
        for p in rr.scalars().all():
            raw_count += 1
            nodes.append(
                GraphNode(
                    id=p.id,
                    type="raw",
                    title=(p.summary or p.raw_text or "")[:80],
                    date=p.post_date,
                    tags=p.tags,
                    summary=p.summary,
                )
            )
    if "published" in want:
        rp = await db.execute(
            select(PublishedPost)
            .where(PublishedPost.org_id == oid)
            .order_by(PublishedPost.published_at.desc())
            .limit(limit)
        )
        for p in rp.scalars().all():
            pub_count += 1
            nodes.append(
                GraphNode(
                    id=p.id,
                    type="published",
                    title=(p.published_text or "")[:80],
                    source=p.platform,
                    date=p.published_at,
                    tags=p.tags,
                    summary=p.published_text,
                    metrics={
                        "views": p.views,
                        "reactions": p.likes,
                        "shares": p.reposts,
                        "comments": p.comments,
                    },
                )
            )

    node_ids = {n.id for n in nodes}
    re = await db.execute(select(ContentLink).where(ContentLink.org_id == oid))
    edges: list[GraphEdge] = []
    for link in re.scalars().all():
        if link.from_id in node_ids and link.to_id in node_ids:
            edges.append(
                GraphEdge(
                    id=link.id,
                    **{"from": link.from_id, "to": link.to_id},
                    link_type=link.link_type,
                    confidence=link.confidence,
                    is_auto=link.is_auto,
                )
            )

    return GraphData(
        nodes=nodes,
        edges=edges,
        stats=GraphStats(nodes=len(nodes), edges=len(edges), raw=raw_count, published=pub_count),
    )


@router.post("/graph/links", status_code=status.HTTP_201_CREATED)
async def create_link(
    body: ManualLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    link = ContentLink(
        org_id=current_user.org_id,
        from_type=body.from_type,
        from_id=body.from_id,
        to_type=body.to_type,
        to_id=body.to_id,
        link_type=body.link_type,
        confidence=1.0,
        is_auto=False,
    )
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return {"id": str(link.id), "status": "created"}


@router.delete("/graph/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_link(
    link_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(select(ContentLink).where(ContentLink.id == link_id, ContentLink.org_id == current_user.org_id))
    if not r.scalar_one_or_none():
        raise ResourceNotFoundException("ContentLink", str(link_id))
    await db.execute(delete(ContentLink).where(ContentLink.id == link_id, ContentLink.org_id == current_user.org_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ════════════════════════════════════════════════════════════════════
# Auto mode (extended) + recommendations
# ════════════════════════════════════════════════════════════════════
async def _get_or_create_auto_mode(db: AsyncSession, org_id: uuid.UUID) -> AutoModeConfig:
    r = await db.execute(select(AutoModeConfig).where(AutoModeConfig.org_id == org_id))
    cfg = r.scalar_one_or_none()
    if not cfg:
        cfg = AutoModeConfig(org_id=org_id)
        db.add(cfg)
        await db.flush()
        await db.refresh(cfg)
    return cfg


@router.get("/auto-mode/activity", response_model=AutoModeActivity)
async def auto_mode_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = await db.execute(
        select(AutoModeRun, ContentDraft.status, ContentDraft.pipeline_status)
        .outerjoin(ContentDraft, ContentDraft.id == AutoModeRun.draft_id)
        .where(AutoModeRun.org_id == current_user.org_id, AutoModeRun.ran_at >= since)
        .order_by(AutoModeRun.ran_at.desc())
        .limit(limit)
    )
    return build_activity([(run, st, pipe) for run, st, pipe in r.all()])


@router.post("/auto-mode/enable", response_model=AutoModeRead)
async def enable_auto_mode(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> AutoModeConfig:
    cfg = await _get_or_create_auto_mode(db, current_user.org_id)
    cfg.is_enabled = True
    await db.flush()
    await db.refresh(cfg)
    return cfg


@router.post("/auto-mode/disable", response_model=AutoModeRead)
async def disable_auto_mode(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> AutoModeConfig:
    cfg = await _get_or_create_auto_mode(db, current_user.org_id)
    cfg.is_enabled = False
    await db.flush()
    await db.refresh(cfg)
    return cfg


@router.get("/auto-mode/preview", response_model=list[TopicClusterRead])
async def auto_mode_preview(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[TopicCluster]:
    cfg = await _get_or_create_auto_mode(db, current_user.org_id)
    r = await db.execute(
        select(TopicCluster)
        .where(TopicCluster.org_id == current_user.org_id, TopicCluster.status == "active")
        .order_by(TopicCluster.post_count.desc())
        .limit(cfg.max_posts_per_day)
    )
    return list(r.scalars().all())


@router.get("/recommendations", response_model=list[TopicClusterRead])
async def recommendations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
) -> list[TopicCluster]:
    # AI-ranked (generate_recommendations beat task): high priority first, then hottest
    priority_rank = case(
        (TopicCluster.priority == "high", 0),
        (TopicCluster.priority == "medium", 1),
        else_=2,
    )
    r = await db.execute(
        select(TopicCluster)
        .where(TopicCluster.org_id == current_user.org_id, TopicCluster.status == "active")
        .order_by(priority_rank, TopicCluster.post_count.desc())
        .limit(limit)
    )
    return list(r.scalars().all())


# ════════════════════════════════════════════════════════════════════
# Custom input (manual URL / video / text → raw post)
# ════════════════════════════════════════════════════════════════════
async def _get_or_create_manual_source(db: AsyncSession, org_id: uuid.UUID) -> ContentSource:
    r = await db.execute(
        select(ContentSource).where(
            ContentSource.org_id == org_id,
            ContentSource.source_type == "manual",
            ContentSource.source_id == "manual",
        )
    )
    src = r.scalar_one_or_none()
    if not src:
        src = ContentSource(
            org_id=org_id,
            source_type="manual",
            source_id="manual",
            display_name="Manual Input",
            auto_parse=False,
        )
        db.add(src)
        await db.flush()
        await db.refresh(src)
    return src


@router.post("/custom-input", response_model=RawPostRead, status_code=status.HTTP_201_CREATED)
async def custom_input(
    body: CustomInputCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> RawPost:
    import hashlib

    if body.input_type not in {"url", "youtube", "text"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="input_type must be url|youtube|text")
    src = await _get_or_create_manual_source(db, current_user.org_id)
    is_link = body.input_type in {"url", "youtube"}

    # Resolve links to actual content before storing (M4 TZ §6.5)
    raw_text = body.value
    author: str | None = None
    if body.input_type == "url":
        from app.modules.content.parsers.web import parse_web_article

        try:
            item = await parse_web_article(body.value)
            raw_text, author = item.raw_text, item.author
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"URL parse failed: {e}") from e
    elif body.input_type == "youtube":
        from app.modules.content.parsers.youtube import parse_youtube_video

        try:
            item = await parse_youtube_video(body.value, org_id=current_user.org_id, preferred_lang=body.language or "en")
            if item:
                raw_text, author = item.raw_text, item.author
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"YouTube parse failed: {e}") from e

    post = RawPost(
        org_id=current_user.org_id,
        source_id=src.id,
        raw_text=raw_text,
        author=author,
        post_date=datetime.now(),
        source_url=body.value if is_link else None,
        language=body.language,
        tags=body.tags,
        status="new",
        content_hash=hashlib.sha256(raw_text.encode()).hexdigest(),
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)
    # Kick off summary/tags/embedding in the background
    from app.modules.content.tasks import analyze_raw_post_task

    analyze_raw_post_task.delay(str(post.id), str(current_user.org_id))
    return post


@router.post("/published/sync-all")
async def sync_all_published(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    r = await db.execute(select(PublishedPost).where(PublishedPost.org_id == current_user.org_id))
    result = await engagement.sync_many(list(r.scalars().all()))
    await db.flush()
    return result


@router.get("/export")
async def export_org_content(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict:
    """Settings -> Advanced: full org-scoped content export as a JSON download."""
    payload = await build_org_export(db, current_user)
    response.headers["Content-Disposition"] = 'attachment; filename="apex-export.json"'
    return payload


async def build_org_export(db: AsyncSession, current_user: User) -> dict:
    """Org-scoped export payload shared by /content/export and the root /api/content/export alias."""
    from datetime import timezone as _tz

    from app.models.organisation import Organisation

    oid = current_user.org_id
    org_row = await db.execute(select(Organisation).where(Organisation.id == oid))
    org = org_row.scalar_one_or_none()
    if not org:
        raise ResourceNotFoundException("Organisation", str(oid))

    sources = (await db.execute(select(ContentSource).where(ContentSource.org_id == oid))).scalars().all()
    drafts = (await db.execute(select(ContentDraft).where(ContentDraft.org_id == oid))).scalars().all()
    published = (await db.execute(select(PublishedPost).where(PublishedPost.org_id == oid))).scalars().all()
    tags = (await db.execute(select(TagsConfig).where(TagsConfig.org_id == oid))).scalars().all()

    return {
        "org": {"id": str(org.id), "name": org.name, "slug": org.slug},
        "sources": [ContentSourceRead.model_validate(s).model_dump(mode="json") for s in sources],
        "drafts": [DraftDetailRead.model_validate(d).model_dump(mode="json") for d in drafts],
        "published": [PublishedPostRead.model_validate(p).model_dump(mode="json") for p in published],
        "tags": [TagsConfigRead.model_validate(t).model_dump(mode="json") for t in tags],
        "exported_at": datetime.now(_tz.utc).isoformat(),
    }


@router.get("/ai-usage")
async def ai_usage_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict:
    """Cost transparency: who eats how much — today/30d totals, per model, per task."""
    from datetime import timedelta, timezone as _tz

    from app.core.ai_router import get_org_daily_limit_usd
    from app.models.ai_usage import AIUsage
    from app.models.organisation import Organisation

    oid = current_user.org_id
    org_settings_row = await db.execute(select(Organisation.settings).where(Organisation.id == oid))
    daily_limit = get_org_daily_limit_usd(org_settings_row.scalar_one_or_none())
    now = datetime.now(_tz.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now - timedelta(days=30)

    async def _agg(since, group_col):
        r = await db.execute(
            select(
                group_col,
                func.coalesce(func.sum(AIUsage.cost_usd), 0),
                func.count(),
                func.coalesce(func.sum(AIUsage.input_tokens + AIUsage.output_tokens), 0),
            )
            .where(AIUsage.org_id == oid, AIUsage.created_at >= since)
            .group_by(group_col)
        )
        return [
            {"key": row[0], "cost_usd": float(row[1]), "calls": int(row[2]), "tokens": int(row[3])}
            for row in r.all()
        ]

    total_today = await db.execute(
        select(func.coalesce(func.sum(AIUsage.cost_usd), 0)).where(AIUsage.org_id == oid, AIUsage.created_at >= day_start)
    )
    total_month = await db.execute(
        select(func.coalesce(func.sum(AIUsage.cost_usd), 0)).where(AIUsage.org_id == oid, AIUsage.created_at >= month_start)
    )
    today = float(total_today.scalar_one())
    return {
        "today_usd": today,
        "month_usd": float(total_month.scalar_one()),
        "daily_limit_usd": daily_limit,
        "daily_remaining_usd": max(0.0, daily_limit - today),
        "by_model": await _agg(month_start, AIUsage.model),
        "by_task": await _agg(month_start, AIUsage.task_type),
    }


@router.get("/my-activity")
async def my_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    oid = current_user.org_id
    uid = current_user.id
    drafts = await db.execute(
        select(func.count()).select_from(ContentDraft).where(ContentDraft.created_by_user_id == uid)
    )
    published = await db.execute(
        select(func.count()).select_from(PublishedPost).where(PublishedPost.org_id == oid)
    )
    clusters = await db.execute(
        select(func.count()).select_from(TopicCluster).where(TopicCluster.org_id == oid)
    )
    return {
        "drafts": int(drafts.scalar_one()),
        "published": int(published.scalar_one()),
        "topics": int(clusters.scalar_one()),
    }


from app.modules.content.router_ext import ext_router  # noqa: E402  (registered last: shares this router's prefix)

router.include_router(ext_router)

"""Content endpoints added after the first cut (M4 TZ §6): related posts, tag shortcuts, source status,
cluster search, draft regenerate, graph focus, style-version history."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ResourceNotFoundException
from app.models.user import User
from app.modules.content.models import (
    ContentDraft,
    ContentLink,
    ContentSource,
    PublishedPost,
    RawPost,
    StylePreset,
    TopicCluster,
)
from app.modules.content.schemas import (
    GraphData,
    GraphEdge,
    GraphNode,
    GraphStats,
    PublishedPostRead,
    RawPostRead,
    TopicClusterRead,
)
from app.modules.content.services import style_versions
from app.modules.content.services.chart_render import InvalidChartData, render_chart_png
from app.modules.content.services.pdf_export import PdfFontMissing, build_pdf
from app.modules.content.services.pptx_export import build_pptx
from app.modules.content.tasks import generate_recommendations, run_draft_pipeline_task

ext_router = APIRouter()

REGENERATE_STEPS = {"synthesis", "styling", "formatting", "translation", "fact_check", "image"}


class TagsBody(BaseModel):
    tags: list[str] = Field(default_factory=list)


class ClusterSearchBody(BaseModel):
    query: str = ""
    tags: list[str] = Field(default_factory=list)


class RegenerateBody(BaseModel):
    steps: list[str] = Field(default_factory=list)
    languages: list[str] | None = None


class RestoreBody(BaseModel):
    version: int


def _clean_tags(tags: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for t in tags:
        t = t.strip().lower()
        if t:
            seen[t] = None
    return list(seen)


def rank_related(post: RawPost, candidates: list[RawPost], limit: int) -> list[RawPost]:
    """Fallback when a post has no embedding yet: rank by shared tags (ties: newest first)."""
    mine = {t.lower() for t in (post.tags or [])}
    scored = [(len(mine & {t.lower() for t in (c.tags or [])}), c) for c in candidates if c.id != post.id]
    scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: (x[0], x[1].post_date), reverse=True)
    return [c for _, c in scored[:limit]]


async def _get_raw(db: AsyncSession, post_id: uuid.UUID, org_id: uuid.UUID) -> RawPost:
    r = await db.execute(select(RawPost).where(RawPost.id == post_id, RawPost.org_id == org_id))
    post = r.scalar_one_or_none()
    if not post:
        raise ResourceNotFoundException("RawPost", str(post_id))
    return post


@ext_router.delete("/raw-posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_raw_post(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    await _get_raw(db, post_id, current_user.org_id)
    await db.execute(delete(RawPost).where(RawPost.id == post_id, RawPost.org_id == current_user.org_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@ext_router.get("/raw-posts/{post_id}/related", response_model=list[RawPostRead])
async def related_raw_posts(
    post_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
) -> list[RawPost]:
    post = await _get_raw(db, post_id, current_user.org_id)
    base = select(RawPost).where(RawPost.org_id == current_user.org_id, RawPost.id != post.id)
    if post.embedding is not None:  # pgvector cosine distance (TZ §5.1)
        q = base.where(RawPost.embedding.isnot(None)).order_by(RawPost.embedding.cosine_distance(post.embedding)).limit(limit)
        return list((await db.execute(q)).scalars().all())
    if not post.tags:
        return []
    q = base.where(RawPost.tags.overlap(post.tags)).order_by(RawPost.post_date.desc()).limit(200)
    return rank_related(post, list((await db.execute(q)).scalars().all()), limit)


@ext_router.patch("/raw-posts/{post_id}/tags", response_model=RawPostRead)
async def set_raw_post_tags(
    post_id: uuid.UUID,
    body: TagsBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> RawPost:
    post = await _get_raw(db, post_id, current_user.org_id)
    post.tags = _clean_tags(body.tags)
    await db.flush()
    await db.refresh(post)
    return post


@ext_router.patch("/published/{post_id}/tags", response_model=PublishedPostRead)
async def set_published_tags(
    post_id: uuid.UUID,
    body: TagsBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> PublishedPost:
    r = await db.execute(select(PublishedPost).where(PublishedPost.id == post_id, PublishedPost.org_id == current_user.org_id))
    post = r.scalar_one_or_none()
    if not post:
        raise ResourceNotFoundException("PublishedPost", str(post_id))
    post.tags = _clean_tags(body.tags)
    await db.flush()
    await db.refresh(post)
    return post


@ext_router.get("/sources/{source_id}/status")
async def source_status(
    source_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict:
    r = await db.execute(select(ContentSource).where(ContentSource.id == source_id, ContentSource.org_id == current_user.org_id))
    src = r.scalar_one_or_none()
    if not src:
        raise ResourceNotFoundException("ContentSource", str(source_id))
    return {
        "id": src.id,
        "is_active": src.is_active,
        "last_parsed_at": src.last_parsed_at,
        "last_post_date": src.last_post_date,
        "total_posts_parsed": src.total_posts_parsed,
        "error_count": src.error_count,
        "last_error": src.last_error,
    }


@ext_router.post("/clusters/search", response_model=list[TopicClusterRead])
async def search_clusters(
    body: ClusterSearchBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
) -> list[TopicCluster]:
    q = select(TopicCluster).where(TopicCluster.org_id == current_user.org_id, TopicCluster.status == "active")
    text = body.query.strip()
    if text:
        like = f"%{text}%"
        q = q.where(or_(TopicCluster.title.ilike(like), TopicCluster.description.ilike(like)))
    tags = _clean_tags(body.tags)
    if tags:
        q = q.where(TopicCluster.tags.overlap(tags))
    q = q.order_by(TopicCluster.post_count.desc()).limit(limit)
    return list((await db.execute(q)).scalars().all())


@ext_router.post("/drafts/{draft_id}/regenerate")
async def regenerate_draft(
    draft_id: uuid.UUID,
    body: RegenerateBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    unknown = set(body.steps) - REGENERATE_STEPS
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown steps: {sorted(unknown)}")
    r = await db.execute(select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id))
    draft = r.scalar_one_or_none()
    if not draft:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    if (draft.pipeline_status or "").lower() not in ("ready", "failed", "pending", ""):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pipeline is already running")
    if body.languages is not None:
        draft.translation_targets = body.languages
    # Only the chosen stages re-run (new text always re-runs everything downstream; see plan_steps).
    draft.pipeline_status = "pending"
    draft.pipeline_error = None
    draft.status = "draft"
    await db.flush()
    run_draft_pipeline_task.delay(str(draft.id), body.steps or None)
    return {"status": "queued"}


@ext_router.post("/recommendations/refresh")
async def refresh_recommendations(current_user: User = Depends(get_current_user)) -> dict[str, str]:
    generate_recommendations.delay()
    return {"status": "queued"}


@ext_router.get("/graph/{node_id}", response_model=GraphData)
async def graph_focus(
    node_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> GraphData:
    """The node plus everything directly linked to it."""
    oid = current_user.org_id
    links = list(
        (
            await db.execute(
                select(ContentLink).where(
                    ContentLink.org_id == oid, or_(ContentLink.from_id == node_id, ContentLink.to_id == node_id)
                )
            )
        ).scalars().all()
    )
    ids = {node_id} | {x for link in links for x in (link.from_id, link.to_id)}
    nodes: list[GraphNode] = []
    raws = (await db.execute(select(RawPost).where(RawPost.org_id == oid, RawPost.id.in_(ids)))).scalars().all()
    pubs = (await db.execute(select(PublishedPost).where(PublishedPost.org_id == oid, PublishedPost.id.in_(ids)))).scalars().all()
    for p in raws:
        nodes.append(GraphNode(id=p.id, type="raw", title=(p.summary or p.raw_text or "")[:80], date=p.post_date, tags=p.tags, summary=p.summary))
    for p in pubs:
        nodes.append(
            GraphNode(
                id=p.id, type="published", title=(p.published_text or "")[:80], source=p.platform, date=p.published_at,
                tags=p.tags, summary=p.published_text,
                metrics={"views": p.views, "reactions": p.likes, "shares": p.reposts, "comments": p.comments},
            )
        )
    if not any(n.id == node_id for n in nodes):
        raise ResourceNotFoundException("GraphNode", str(node_id))
    present = {n.id for n in nodes}
    edges = [
        GraphEdge(id=link.id, **{"from": link.from_id, "to": link.to_id}, link_type=link.link_type, confidence=link.confidence, is_auto=link.is_auto)
        for link in links
        if link.from_id in present and link.to_id in present
    ]
    return GraphData(
        nodes=nodes,
        edges=edges,
        stats=GraphStats(nodes=len(nodes), edges=len(edges), raw=len(raws), published=len(pubs)),
    )


async def _get_style(db: AsyncSession, preset_id: uuid.UUID, org_id: uuid.UUID) -> StylePreset:
    r = await db.execute(select(StylePreset).where(StylePreset.id == preset_id, StylePreset.org_id == org_id))
    sp = r.scalar_one_or_none()
    if not sp:
        raise ResourceNotFoundException("StylePreset", str(preset_id))
    return sp


@ext_router.get("/style-presets/{preset_id}/versions")
async def style_preset_versions(
    preset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return style_versions.list_versions(await _get_style(db, preset_id, current_user.org_id))


@ext_router.post("/style-presets/{preset_id}/restore")
async def restore_style_preset(
    preset_id: uuid.UUID,
    body: RestoreBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict:
    sp = await _get_style(db, preset_id, current_user.org_id)
    if not style_versions.restore_version(sp, body.version):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version {body.version} not found")
    await db.flush()
    return {"id": sp.id, "version": sp.version}


async def _export_source(db: AsyncSession, draft_id: uuid.UUID, org_id: uuid.UUID, lang: str | None) -> tuple[ContentDraft, str, list[str]]:
    r = await db.execute(select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == org_id))
    d = r.scalar_one_or_none()
    if not d:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    use_lang = lang or d.language
    if use_lang != d.language:
        body = str((d.translations or {}).get(use_lang) or "")
    else:
        body = d.styled_text or d.synthesized_text or ""
    if not body.strip():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Draft has no text for this language yet")
    meta = [use_lang.upper(), f"Status: {d.status}"]
    if d.fact_check_status:
        meta.append(f"Fact check: {d.fact_check_status}")
    return d, body, meta


@ext_router.get("/drafts/{draft_id}/pdf")
async def draft_pdf(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    lang: str | None = Query(None, description="Translation language; default is the draft language"),
) -> Response:
    d, body, meta = await _export_source(db, draft_id, current_user.org_id, lang)
    try:
        pdf = build_pdf(d.topic, body, meta)
    except PdfFontMissing as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="draft-{d.id}.pdf"'},
    )


def _chart_png(d: ContentDraft) -> bytes | None:
    if not d.chart_data:
        return None
    try:
        return render_chart_png(d.chart_data, d.chart_config)
    except InvalidChartData as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@ext_router.get("/drafts/{draft_id}/chart.png")
async def draft_chart(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Response:
    r = await db.execute(select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.org_id == current_user.org_id))
    d = r.scalar_one_or_none()
    if not d:
        raise ResourceNotFoundException("ContentDraft", str(draft_id))
    png = _chart_png(d)
    if png is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft has no chart data")
    return Response(content=png, media_type="image/png")


@ext_router.get("/drafts/{draft_id}/pptx")
async def draft_pptx(
    draft_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
    lang: str | None = Query(None, description="Translation language; default is the draft language"),
) -> Response:
    d, body, meta = await _export_source(db, draft_id, current_user.org_id, lang)
    deck = build_pptx(d.topic, body, meta, _chart_png(d))
    return Response(
        content=deck,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="draft-{d.id}.pptx"'},
    )

"""Auto-mode cycle (M4 TZ §1.12): cluster scoring, draft creation, scheduled publish."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import AutoModeConfig, AutoModeRun, ContentDraft, PublishedPost, TopicCluster


def _org_now(tz_name: str) -> datetime:
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


def score_cluster(cluster: TopicCluster, cfg: AutoModeConfig, now: datetime) -> float:
    """Weighted score per TZ: popularity (post volume), freshness, source diversity."""
    popularity = min((cluster.post_count or 0) / 10.0, 1.0)
    hours = cluster.freshness_hours if cluster.freshness_hours is not None else 999
    freshness = max(0.0, 1.0 - float(hours) / 72.0)
    diversity = min((cluster.source_diversity or 0) / 5.0, 1.0)
    return (
        popularity * (cfg.weight_popularity or 0)
        + freshness * (cfg.weight_freshness or 0)
        + diversity * (cfg.weight_diversity or 0)
    )


async def pick_cluster(session: AsyncSession, cfg: AutoModeConfig) -> TopicCluster | None:
    now = datetime.now(timezone.utc)
    repeat_cutoff = now - timedelta(hours=cfg.avoid_repeat_hours or 24)

    # clusters already used by recent auto drafts are excluded
    recent = await session.execute(
        select(ContentDraft.cluster_id).where(
            ContentDraft.org_id == cfg.org_id,
            ContentDraft.created_by == "auto",
            ContentDraft.created_at >= repeat_cutoff,
            ContentDraft.cluster_id.isnot(None),
        )
    )
    used_ids = {row[0] for row in recent.all()}

    r = await session.execute(
        select(TopicCluster).where(
            TopicCluster.org_id == cfg.org_id,
            TopicCluster.status == "active",
            TopicCluster.source_diversity >= (cfg.min_source_count or 0),
        )
    )
    candidates = [c for c in r.scalars().all() if c.id not in used_ids and (c.post_count or 0) > 0]
    # Topic filter: only clusters overlapping allowed_tags (empty filter = any topic)
    allowed = {t.lower() for t in (getattr(cfg, "allowed_tags", None) or [])}
    if allowed:
        candidates = [c for c in candidates if allowed & {t.lower() for t in (c.tags or [])}]
    if not candidates:
        return None
    return max(candidates, key=lambda c: score_cluster(c, cfg, now))


def _record(
    session: AsyncSession,
    cfg: AutoModeConfig,
    outcome: str,
    reason: str | None = None,
    draft: ContentDraft | None = None,
) -> None:
    session.add(
        AutoModeRun(
            org_id=cfg.org_id,
            outcome=outcome,
            reason=reason,
            mode=getattr(cfg, "mode", None) or "full_auto",
            draft_id=draft.id if draft is not None else None,
            topic=draft.topic if draft is not None else None,
            platforms=list(cfg.publish_to or []),
        )
    )


def build_activity(rows: list[tuple[AutoModeRun, str | None, str | None]]) -> dict:
    """Shape run history for the UI. rows: (run, draft.status, draft.pipeline_status), newest first."""
    created = [r for r in rows if r[0].outcome == "created"]
    published = sum(1 for _, status, _ in created if status == "published")
    failed = sum(1 for _, _, pipe in created if (pipe or "").lower() == "failed")
    finished = published + failed + sum(
        1 for _, status, pipe in created if status != "published" and (pipe or "").lower() == "ready"
    )
    return {
        "stats": {
            "generated": len(created),
            "published": published,
            "failed": failed,
            "skipped": sum(1 for r in rows if r[0].outcome == "skipped"),
            "success_rate": round(100 * (finished - failed) / finished) if finished else None,
        },
        "runs": [
            {
                "id": run.id,
                "ran_at": run.ran_at,
                "outcome": run.outcome,
                "reason": run.reason,
                "mode": run.mode,
                "topic": run.topic,
                "platforms": list(run.platforms or []),
                "draft_id": run.draft_id,
                "draft_status": status,
                "pipeline_status": pipe,
            }
            for run, status, pipe in rows
        ],
    }


async def run_auto_mode_cycle(session: AsyncSession) -> dict:
    """One hourly pass over all enabled org configs."""
    from app.modules.content.tasks import auto_publish_when_ready, run_draft_pipeline_task

    created = 0
    skipped: list[str] = []
    r = await session.execute(select(AutoModeConfig).where(AutoModeConfig.is_enabled.is_(True)))
    for cfg in r.scalars().all():
        org_now = _org_now(cfg.timezone)
        # weekday filter: empty list = every day
        days = [d.lower() for d in (getattr(cfg, "publish_days", None) or [])]
        if days and org_now.strftime("%a").lower()[:3] not in days:
            continue
        if org_now.strftime("%H:00") not in (cfg.publish_times or []):
            continue

        # daily cap
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        cnt = await session.execute(
            select(func.count())
            .select_from(PublishedPost)
            .where(PublishedPost.org_id == cfg.org_id, PublishedPost.published_at >= day_start)
        )
        if int(cnt.scalar_one()) >= (cfg.max_posts_per_day or 0):
            skipped.append(f"{cfg.org_id}: daily cap")
            _record(session, cfg, "skipped", f"Daily cap reached ({cfg.max_posts_per_day} posts)")
            continue

        cluster = await pick_cluster(session, cfg)
        if not cluster:
            skipped.append(f"{cfg.org_id}: no eligible cluster")
            _record(session, cfg, "skipped", "No eligible topic cluster")
            continue

        draft = ContentDraft(
            org_id=cfg.org_id,
            source_post_ids=cluster.post_ids,
            cluster_id=cluster.id,
            source_type="cluster",
            topic=cluster.title,
            tags=cluster.tags,
            style_preset_id=cfg.default_style_id,
            language="en",
            translation_targets=list(cfg.auto_translate_to or []),
            created_by="auto",
            status="draft",
            pipeline_status="pending",
        )
        session.add(draft)
        await session.flush()
        run_draft_pipeline_task.delay(str(draft.id))
        # draft_only mode: pipeline runs, but a human reviews and publishes manually
        if (getattr(cfg, "mode", "full_auto") or "full_auto") == "full_auto":
            langs = ["en", *list(cfg.auto_translate_to or [])]
            auto_publish_when_ready.apply_async(args=[str(draft.id), list(cfg.publish_to or []), langs], countdown=60)
        _record(session, cfg, "created", None, draft)
        created += 1

    return {"drafts_created": created, "skipped": skipped}

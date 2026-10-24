"""Auto-mode run history: cycle records decisions, activity endpoint shapes them."""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.modules.content import tasks as content_tasks
from app.modules.content.models import AutoModeConfig, AutoModeRun, TopicCluster
from app.modules.content.router import auto_mode_activity
from app.modules.content.services import auto_mode
from tests._fakes import FakeResult, FakeSession

ORG_ID = uuid.uuid4()
NOW = datetime(2026, 10, 26, 9, 0, tzinfo=timezone.utc)  # a Monday, 09:00


def _run(outcome="created", **kw) -> AutoModeRun:
    return AutoModeRun(
        id=uuid.uuid4(), org_id=ORG_ID, ran_at=NOW, outcome=outcome, mode="full_auto", platforms=["telegram"], **kw
    )


def test_build_activity_stats():
    rows = [
        (_run(topic="a"), "published", "ready"),
        (_run(topic="b"), "draft", "ready"),
        (_run(topic="c"), "draft", "failed"),
        (_run(topic="d"), "draft", "running"),
        (_run("skipped", reason="No eligible topic cluster"), None, None),
    ]
    out = auto_mode.build_activity(rows)
    assert out["stats"] == {"generated": 4, "published": 1, "failed": 1, "skipped": 1, "success_rate": 67}
    assert [r["outcome"] for r in out["runs"]] == ["created"] * 4 + ["skipped"]
    assert out["runs"][4]["reason"] == "No eligible topic cluster"


def test_build_activity_empty_has_no_success_rate():
    out = auto_mode.build_activity([])
    assert out["stats"]["success_rate"] is None and out["runs"] == []


@pytest.mark.asyncio
async def test_activity_endpoint_returns_shaped_rows():
    user = MagicMock()
    user.org_id = ORG_ID
    db = FakeSession([FakeResult(items=[(_run(topic="x"), "published", "ready")])])
    out = await auto_mode_activity(db, user, days=30, limit=50)
    assert out["stats"]["published"] == 1 and out["runs"][0]["topic"] == "x"


def _cfg(**kw) -> AutoModeConfig:
    c = AutoModeConfig(
        id=uuid.uuid4(), org_id=ORG_ID, is_enabled=True, publish_times=["09:00"], timezone="UTC", publish_days=[],
        allowed_tags=[], max_posts_per_day=2, min_source_count=0, avoid_repeat_hours=24, publish_to=["telegram"],
        auto_translate_to=[], mode="full_auto", weight_popularity=40, weight_freshness=40, weight_diversity=20,
    )
    for k, v in kw.items():
        setattr(c, k, v)
    return c


@pytest.fixture(autouse=True)
def _frozen_clock(monkeypatch):
    monkeypatch.setattr(auto_mode, "_org_now", lambda _tz: NOW)


@pytest.mark.asyncio
async def test_cycle_records_skip_when_daily_cap_reached():
    db = FakeSession([FakeResult(items=[_cfg(max_posts_per_day=1)]), FakeResult(scalar=1)])
    out = await auto_mode.run_auto_mode_cycle(db)
    assert out["drafts_created"] == 0
    (run,) = db.added
    assert run.outcome == "skipped" and "Daily cap" in run.reason


@pytest.mark.asyncio
async def test_cycle_records_skip_when_no_cluster():
    db = FakeSession([FakeResult(items=[_cfg()]), FakeResult(scalar=0), FakeResult(items=[]), FakeResult(items=[])])
    await auto_mode.run_auto_mode_cycle(db)
    (run,) = db.added
    assert run.outcome == "skipped" and run.reason == "No eligible topic cluster"


@pytest.mark.asyncio
async def test_cycle_records_created_draft(monkeypatch):
    monkeypatch.setattr(content_tasks.run_draft_pipeline_task, "delay", MagicMock())
    monkeypatch.setattr(content_tasks.auto_publish_when_ready, "apply_async", MagicMock())
    cluster = TopicCluster(
        id=uuid.uuid4(), org_id=ORG_ID, title="Fed cuts", post_count=5, freshness_hours=2, source_diversity=3,
        status="active", tags=[], post_ids=[],
    )
    db = FakeSession([FakeResult(items=[_cfg()]), FakeResult(scalar=0), FakeResult(items=[]), FakeResult(items=[cluster])])
    out = await auto_mode.run_auto_mode_cycle(db)
    assert out["drafts_created"] == 1
    drafts = [o for o in db.added if o.__class__.__name__ == "ContentDraft"]
    (run,) = [o for o in db.added if isinstance(o, AutoModeRun)]
    assert run.outcome == "created" and run.topic == "Fed cuts" and run.draft_id == drafts[0].id

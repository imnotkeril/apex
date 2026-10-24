"""Scheduled publishing: publish endpoint parks future posts, scheduler publishes due ones."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.modules.content import router as content_router
from app.modules.content.models import ContentCalendarEntry, ContentDraft
from app.modules.content.schemas import PublishBody
from app.modules.content.services.scheduler import entry_outcome, publish_due_entries
from tests._fakes import FakeResult, FakeSession

ORG_ID = uuid.uuid4()


def _draft() -> ContentDraft:
    return ContentDraft(id=uuid.uuid4(), org_id=ORG_ID, topic="t", language="en", status="draft")


def _user() -> MagicMock:
    u = MagicMock()
    u.org_id = ORG_ID
    return u


@pytest.mark.asyncio
async def test_publish_with_future_time_creates_calendar_entry(monkeypatch):
    delay = MagicMock()
    monkeypatch.setattr(content_router.publish_draft_task, "delay", delay)
    draft = _draft()
    db = FakeSession([FakeResult(items=[draft])])
    when = datetime.now(timezone.utc) + timedelta(hours=2)
    out = await content_router.publish_draft(
        draft.id, PublishBody(platforms=["telegram"], languages=["en"], scheduled_at=when), db, _user()
    )
    assert out["status"] == "scheduled"
    assert draft.status == "scheduled"
    (entry,) = db.added
    assert isinstance(entry, ContentCalendarEntry)
    assert entry.scheduled_at == when and entry.platforms == ["telegram"]
    delay.assert_not_called()


@pytest.mark.asyncio
async def test_publish_without_time_or_in_past_queues_now(monkeypatch):
    delay = MagicMock()
    monkeypatch.setattr(content_router.publish_draft_task, "delay", delay)
    draft = _draft()
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    for body in (PublishBody(platforms=["telegram"]), PublishBody(platforms=["telegram"], scheduled_at=past)):
        db = FakeSession([FakeResult(items=[draft])])
        out = await content_router.publish_draft(draft.id, body, db, _user())
        assert out == {"status": "queued"}
        assert db.added == []
    assert delay.call_count == 2


@pytest.mark.asyncio
async def test_naive_scheduled_time_is_treated_as_utc(monkeypatch):
    monkeypatch.setattr(content_router.publish_draft_task, "delay", MagicMock())
    draft = _draft()
    db = FakeSession([FakeResult(items=[draft])])
    naive = (datetime.now(timezone.utc) + timedelta(hours=1)).replace(tzinfo=None)
    out = await content_router.publish_draft(draft.id, PublishBody(platforms=["telegram"], scheduled_at=naive), db, _user())
    assert out["status"] == "scheduled"
    assert db.added[0].scheduled_at.tzinfo is not None


def _entry(**kw) -> ContentCalendarEntry:
    return ContentCalendarEntry(
        id=uuid.uuid4(),
        org_id=ORG_ID,
        draft_id=uuid.uuid4(),
        scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        platforms=kw.pop("platforms", ["telegram"]),
        languages=["en"],
        status="scheduled",
        **kw,
    )


def test_entry_outcome_mapping():
    assert entry_outcome({"ok": True, "external_published": 1, "errors": []}) == ("published", None)
    status, msg = entry_outcome({"ok": True, "external_published": 0, "errors": ["telegram/en: boom"]})
    assert status == "failed" and "boom" in msg
    status, msg = entry_outcome({"ok": True, "external_published": 1, "errors": ["twitter/en: boom"]})
    assert status == "published" and "boom" in msg  # partial success keeps the warning
    assert entry_outcome({"error": "draft_not_found"}) == ("failed", "draft_not_found")


@pytest.mark.asyncio
async def test_publish_due_entries_publishes_and_isolates_failures():
    good, bad = _entry(), _entry()
    calls: list[str] = []

    async def publisher(draft_id, platforms, languages):
        calls.append(draft_id)
        if draft_id == str(bad.draft_id):
            raise RuntimeError("network down")
        return {"ok": True, "external_published": 1, "errors": []}

    db = FakeSession([FakeResult(items=[good, bad])])
    counts = await publish_due_entries(db, publisher)
    assert counts == {"published": 1, "failed": 1}
    assert good.status == "published" and good.published_at is not None
    assert bad.status == "failed" and bad.error_message == "network down"
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_publish_due_entries_with_nothing_due():
    async def publisher(*_a):
        raise AssertionError("must not publish")

    assert await publish_due_entries(FakeSession([FakeResult(items=[])]), publisher) == {"published": 0, "failed": 0}

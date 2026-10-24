"""Unit tests for org notification toggles (Settings -> Notifications) and the
'test notification' endpoint. The real Telegram sender is always mocked."""

import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.orgs import send_test_notification
from app.models.organisation import Organisation
from app.modules.content.notifications import (
    maybe_send_budget_alert,
    notifications_enabled,
    send_notification,
)
from tests._fakes import FakeResult, FakeSession


def _org(**settings) -> Organisation:
    return Organisation(id=uuid.uuid4(), name="Org", slug="org", plan="free", settings=settings)


def test_notifications_enabled_defaults_true_when_unset():
    assert notifications_enabled({}, "draft_ready") is True
    assert notifications_enabled(None, "published") is True


def test_notifications_enabled_respects_explicit_toggle():
    settings = {"notifications": {"draft_ready": False, "published": True}}
    assert notifications_enabled(settings, "draft_ready") is False
    assert notifications_enabled(settings, "published") is True
    # untouched key in the same dict still defaults to True
    assert notifications_enabled(settings, "pipeline_failed") is True


@pytest.mark.asyncio
async def test_send_notification_skips_when_toggled_off(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr("app.modules.content.notifications.publish_to_telegram", sender)
    org = _org(notifications={"draft_ready": False})
    sent = await send_notification(org, "draft_ready", "hello")
    assert sent is False
    sender.assert_not_called()


@pytest.mark.asyncio
async def test_send_notification_sends_when_enabled(monkeypatch):
    sender = AsyncMock(return_value={"platform_post_id": "1", "post_url": None})
    monkeypatch.setattr("app.modules.content.notifications.publish_to_telegram", sender)
    org = _org()  # no toggles configured -> default True
    sent = await send_notification(org, "published", "it's live")
    assert sent is True
    sender.assert_awaited_once()
    args, kwargs = sender.call_args
    assert args[0] == "it's live"
    assert kwargs["org_id"] == org.id


@pytest.mark.asyncio
async def test_send_notification_swallows_sender_failure(monkeypatch):
    sender = AsyncMock(side_effect=RuntimeError("Telegram bot token and chat id must be set"))
    monkeypatch.setattr("app.modules.content.notifications.publish_to_telegram", sender)
    org = _org()
    sent = await send_notification(org, "pipeline_failed", "boom")
    assert sent is False  # never raises


@pytest.mark.asyncio
async def test_budget_alert_fires_only_at_80_percent(monkeypatch):
    sender = AsyncMock(return_value={})
    monkeypatch.setattr("app.modules.content.notifications.publish_to_telegram", sender)
    org = _org()
    sent = await maybe_send_budget_alert(org, spent_usd=5.0, limit_usd=20.0)  # 25%
    assert sent is False
    sender.assert_not_called()


@pytest.mark.asyncio
async def test_budget_alert_fires_once_and_not_twice_same_day(monkeypatch):
    sender = AsyncMock(return_value={})
    monkeypatch.setattr("app.modules.content.notifications.publish_to_telegram", sender)
    org = _org()
    first = await maybe_send_budget_alert(org, spent_usd=16.0, limit_usd=20.0)  # 80%
    assert first is True
    sender.assert_awaited_once()

    sender.reset_mock()
    second = await maybe_send_budget_alert(org, spent_usd=18.0, limit_usd=20.0)  # still today
    assert second is False
    sender.assert_not_called()


@pytest.mark.asyncio
async def test_budget_alert_fires_again_on_a_new_day(monkeypatch):
    sender = AsyncMock(return_value={})
    monkeypatch.setattr("app.modules.content.notifications.publish_to_telegram", sender)
    org = _org()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    org.settings = {"_budget_alert_last_date": yesterday}
    sent = await maybe_send_budget_alert(org, spent_usd=17.0, limit_usd=20.0)
    assert sent is True
    sender.assert_awaited_once()


@pytest.mark.asyncio
async def test_test_notification_endpoint_returns_ok(monkeypatch):
    sender = AsyncMock(return_value={"platform_post_id": "1", "post_url": None})
    monkeypatch.setattr("app.api.v1.orgs.publish_to_telegram", sender)
    org = _org()
    db = FakeSession([FakeResult(items=[org])])
    actor = type("U", (), {"org_id": org.id})()  # only org_id is read by _current_org
    out = await send_test_notification(db, actor)
    assert out == {"ok": True}
    sender.assert_awaited_once()
    args, _ = sender.call_args
    assert args[0] == "APEX test notification"


@pytest.mark.asyncio
async def test_test_notification_endpoint_400_when_not_configured(monkeypatch):
    sender = AsyncMock(side_effect=RuntimeError("Telegram bot token and chat id must be set (Settings → Integrations)"))
    monkeypatch.setattr("app.api.v1.orgs.publish_to_telegram", sender)
    org = _org()
    db = FakeSession([FakeResult(items=[org])])
    actor = type("U", (), {"org_id": org.id})()
    with pytest.raises(HTTPException) as exc_info:
        await send_test_notification(db, actor)
    assert exc_info.value.status_code == 400
    assert "bot token" in exc_info.value.detail

"""Org-level Telegram notifications for pipeline events (M-deferred §3).

Toggles live in organisations.settings["notifications"][event_type] (default True
when unset). Delivery reuses the Telegram publisher's credential resolution
(org integration key -> env fallback). Sending must NEVER break a caller —
`send_notification` swallows and logs every failure.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Literal

from sqlalchemy.orm.attributes import flag_modified

from app.models.organisation import Organisation
from app.modules.content.services.publish import publish_to_telegram

logger = logging.getLogger(__name__)

NotificationEvent = Literal["draft_ready", "published", "pipeline_failed", "budget_alert"]

_BUDGET_ALERT_DATE_KEY = "_budget_alert_last_date"


def notifications_enabled(org_settings: dict | None, event_type: str) -> bool:
    """Toggle default is True when unset (per contract)."""
    cfg = (org_settings or {}).get("notifications") or {}
    val = cfg.get(event_type)
    return True if val is None else bool(val)


async def send_notification(org: Organisation, event_type: NotificationEvent, text: str) -> bool:
    """Send a Telegram notification for `event_type` if its org toggle is on.

    Returns True if a message was actually sent. Never raises — a failed
    notification must not break the pipeline/task that triggered it.
    """
    try:
        if not notifications_enabled(org.settings, event_type):
            return False
        await publish_to_telegram(text, org_id=org.id)
        return True
    except Exception as e:  # noqa: BLE001 - notifications must never break the caller
        logger.warning("notification_send_failed org_id=%s event=%s error=%s", org.id, event_type, e)
        return False


async def maybe_send_budget_alert(org: Organisation, spent_usd: float, limit_usd: float) -> bool:
    """Fire the budget_alert notification once per calendar day, once spend crosses 80%.

    Mutates org.settings to remember the last alert date — caller is responsible for
    flushing/committing the session (this function does not commit).
    """
    if limit_usd <= 0 or spent_usd < 0.8 * limit_usd:
        return False
    today = date.today().isoformat()
    if (org.settings or {}).get(_BUDGET_ALERT_DATE_KEY) == today:
        return False  # already alerted today
    sent = await send_notification(
        org,
        "budget_alert",
        f"APEX: daily AI spend has reached ${spent_usd:.2f} of your ${limit_usd:.2f} budget (80%+).",
    )
    # Record the date regardless of delivery success — avoid retry storms on a
    # broken Telegram config; the toggle/test button remain the way to fix delivery.
    org.settings = {**(org.settings or {}), _BUDGET_ALERT_DATE_KEY: today}
    flag_modified(org, "settings")
    return sent

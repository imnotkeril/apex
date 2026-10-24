"""Scheduled publishing: turns due `content_calendar` rows into real publishes."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import ContentCalendarEntry

# (draft_id, platforms, languages) -> {"ok": bool, "external_published": int, "errors": [str]}
Publisher = Callable[[str, list[str], list[str]], Awaitable[dict]]


def entry_outcome(result: dict) -> tuple[str, str | None]:
    """Map a publish result onto a calendar status + error message."""
    errors = [str(e) for e in result.get("errors") or []]
    if result.get("error"):
        return "failed", str(result["error"])
    if errors and not result.get("external_published"):
        return "failed", "; ".join(errors)[:1000]
    return "published", ("; ".join(errors)[:1000] if errors else None)


async def publish_due_entries(
    session: AsyncSession, publish: Publisher, now: datetime | None = None, limit: int = 20
) -> dict[str, int]:
    """Publish every `scheduled` entry whose time has come. One bad entry never blocks the rest."""
    now = now or datetime.now(timezone.utc)
    r = await session.execute(
        select(ContentCalendarEntry)
        .where(ContentCalendarEntry.status == "scheduled", ContentCalendarEntry.scheduled_at <= now)
        .order_by(ContentCalendarEntry.scheduled_at.asc())
        .limit(limit)
    )
    entries = list(r.scalars().all())
    counts = {"published": 0, "failed": 0}
    for entry in entries:
        entry.status = "publishing"  # claim it so an overlapping beat tick skips it
    await session.commit()
    for entry in entries:
        try:
            result = await publish(str(entry.draft_id), list(entry.platforms), list(entry.languages))
        except Exception as e:  # noqa: BLE001
            result = {"error": str(e)}
        status, message = entry_outcome(result)
        entry.status = status
        entry.error_message = message
        if status == "published":
            entry.published_at = datetime.now(timezone.utc)
        counts[status] += 1
        await session.commit()
    return counts

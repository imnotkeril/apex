"""
Celery tasks for Foundation (usage logging, health checks).
"""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal
from uuid import UUID

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.ai_usage import AIUsage

logger = logging.getLogger(__name__)


@celery_app.task(name="app.core.tasks.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="app.core.tasks.log_ai_usage")
def log_ai_usage(
    org_id: str | None,
    user_id: str | None,
    model: str,
    task_type: str,
    module: str | None,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    success: bool,
    error_message: str | None,
    duration_ms: int | None,
) -> None:
    asyncio.run(
        _log_ai_usage_async(
            org_id=org_id,
            user_id=user_id,
            model=model,
            task_type=task_type,
            module=module,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            success=success,
            error_message=error_message,
            duration_ms=duration_ms,
        )
    )


async def _log_ai_usage_async(
    *,
    org_id: str | None,
    user_id: str | None,
    model: str,
    task_type: str,
    module: str | None,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    success: bool,
    error_message: str | None,
    duration_ms: int | None,
) -> None:
    if not org_id:
        logger.warning("log_ai_usage skipped: no org_id")
        return

    org_uuid = UUID(org_id)
    async with AsyncSessionLocal() as session:
        try:
            row = AIUsage(
                org_id=org_uuid,
                user_id=UUID(user_id) if user_id else None,
                model=model,
                task_type=task_type,
                module=module,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=Decimal(str(cost_usd)),
                success=success,
                error_message=error_message,
                duration_ms=duration_ms,
            )
            session.add(row)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("log_ai_usage failed")
            return

    # Budget alert (fires at most once/day, at >=80% of the org's daily AI budget).
    # Never let this break usage logging — swallow and log any failure.
    try:
        from app.core.ai_router import org_daily_budget_state
        from app.models.organisation import Organisation
        from app.modules.content.notifications import maybe_send_budget_alert

        spent, limit = await org_daily_budget_state(org_uuid)
        async with AsyncSessionLocal() as session:
            org = await session.get(Organisation, org_uuid)
            if org:
                await maybe_send_budget_alert(org, spent, limit)
                await session.commit()
    except Exception:
        logger.exception("budget_alert_check_failed")



import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any

import httpx
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.exceptions import AIQuotaExceededException, AIRouterException
from app.core.logging import get_logger
from app.core.org_secrets import load_org_integrations, resolve_key
from app.models.ai_usage import AIUsage
from app.models.organisation import Organisation

logger = get_logger(__name__)


class AIModel(str, Enum):
    CLAUDE_SONNET = "claude-sonnet-4-5"
    CLAUDE_HAIKU = "claude-haiku-4-5-20251001"
    GPT4O = "gpt-4o"
    GPT4O_MINI = "gpt-4o-mini"
    PERPLEXITY_SONAR = "sonar"
    PERPLEXITY_SONAR_PRO = "sonar-pro"
    GROK = "grok-3"


class TaskType(str, Enum):
    COMPANY_RESEARCH = "company_research"
    TRIGGER_ANALYSIS = "trigger_analysis"
    TEXT_GENERATION = "text_generation"
    CONTENT_SYNTHESIS = "content_synthesis"
    ICP_BUILDING = "icp_building"
    LEAD_SCORING = "lead_scoring"
    DEAL_SCORING = "deal_scoring"
    MEETING_NOTES = "meeting_notes"
    SOCIAL_MONITORING = "social_monitoring"
    SUMMARY = "summary"
    IMAGE_GENERATION = "image_generation"


ROUTING_TABLE: dict[TaskType, dict[str, AIModel]] = {
    TaskType.COMPANY_RESEARCH: {"primary": AIModel.PERPLEXITY_SONAR_PRO, "fallback": AIModel.GPT4O},
    TaskType.TRIGGER_ANALYSIS: {"primary": AIModel.PERPLEXITY_SONAR_PRO, "fallback": AIModel.GPT4O},
    TaskType.TEXT_GENERATION: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
    TaskType.CONTENT_SYNTHESIS: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
    TaskType.ICP_BUILDING: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
    TaskType.LEAD_SCORING: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
    TaskType.DEAL_SCORING: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
    TaskType.MEETING_NOTES: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
    TaskType.SOCIAL_MONITORING: {"primary": AIModel.GROK, "fallback": AIModel.PERPLEXITY_SONAR},
    TaskType.SUMMARY: {"primary": AIModel.CLAUDE_HAIKU, "fallback": AIModel.GPT4O_MINI},
    TaskType.IMAGE_GENERATION: {"primary": AIModel.CLAUDE_SONNET, "fallback": AIModel.GPT4O},
}

MODEL_COSTS: dict[str, dict[str, float]] = {
    "claude-sonnet-4-5": {"input": 0.003, "output": 0.015},
    "claude-haiku-4-5-20251001": {"input": 0.00025, "output": 0.00125},
    "gpt-4o": {"input": 0.0025, "output": 0.01},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "sonar": {"input": 0.001, "output": 0.001},
    "sonar-pro": {"input": 0.003, "output": 0.015},
    "grok-3": {"input": 0.003, "output": 0.015},
}


def get_org_daily_limit_usd(org_settings: dict[str, Any] | None) -> float:
    """Org-level ai_daily_limit_usd override (Settings -> Billing), else the env default."""
    val = (org_settings or {}).get("ai_daily_limit_usd")
    if isinstance(val, (int, float)) and not isinstance(val, bool) and val > 0:
        return float(val)
    return settings.MAX_AI_COST_PER_DAY_USD


async def org_daily_spend_usd(org_id: uuid.UUID) -> float:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    async with AsyncSessionLocal() as session:
        q = select(func.coalesce(func.sum(AIUsage.cost_usd), 0)).where(
            AIUsage.org_id == org_id,
            AIUsage.created_at >= start,
        )
        r = await session.execute(q)
        val = r.scalar_one()
        if isinstance(val, Decimal):
            return float(val)
        return float(val or 0)


async def org_daily_budget_state(org_id: uuid.UUID) -> tuple[float, float]:
    """(spent_today_usd, daily_limit_usd) for an org — limit respects org.settings override."""
    spent = await org_daily_spend_usd(org_id)
    async with AsyncSessionLocal() as session:
        r = await session.execute(select(Organisation.settings).where(Organisation.id == org_id))
        org_settings = r.scalar_one_or_none()
    return spent, get_org_daily_limit_usd(org_settings)


class AIRouter:
    async def _resolve_keys(self, org_id: str | None) -> dict[str, str]:
        """Provider keys for this call: org-level (Settings UI) first, env fallback second."""
        org_values: dict[str, str] = {}
        if org_id:
            try:
                org_values = await load_org_integrations(org_id)
            except Exception:  # noqa: BLE001 - org key lookup must never break an AI call
                logger.warning("org_integrations_load_failed", org_id=org_id)
        return {
            "anthropic": resolve_key(org_values, "anthropic"),
            "openai": resolve_key(org_values, "openai"),
            "perplexity": resolve_key(org_values, "perplexity"),
            "grok": resolve_key(org_values, "grok"),
            "google_ai": resolve_key(org_values, "google_ai"),
        }

    def _schedule_log(
        self,
        *,
        org_id: str | None,
        user_id: str | None,
        model: str,
        task_type: TaskType,
        module: str | None,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
        success: bool,
        error_message: str | None,
        duration_ms: int | None,
    ) -> None:
        try:
            from app.core.tasks import log_ai_usage

            log_ai_usage.delay(
                org_id,
                user_id,
                model,
                task_type.value,
                module,
                input_tokens,
                output_tokens,
                cost_usd,
                success,
                error_message,
                duration_ms,
            )
        except Exception:
            logger.exception("failed to enqueue log_ai_usage")

    async def complete(
        self,
        task_type: TaskType,
        user_prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
        org_id: str | None = None,
        user_id: str | None = None,
        force_model: AIModel | None = None,
        module: str | None = None,
    ) -> dict[str, Any]:
        model = force_model or ROUTING_TABLE[task_type]["primary"]
        fallback = ROUTING_TABLE[task_type].get("fallback")
        start_time = time.time()

        if org_id:
            oid = uuid.UUID(org_id)
            spent, limit = await org_daily_budget_state(oid)
            if spent >= limit:
                raise AIQuotaExceededException(spent, limit)

        keys = await self._resolve_keys(org_id)

        result: dict[str, Any] | None = None
        used_fallback = False
        err_primary: str | None = None
        err_all: str | None = None

        try:
            result = await self._call_model(model, system_prompt, user_prompt, max_tokens, keys)
        except Exception as e:
            err_primary = str(e)
            logger.warning("ai_primary_failed", model=str(model), error=err_primary)
            if fallback:
                try:
                    result = await self._call_model(fallback, system_prompt, user_prompt, max_tokens, keys)
                    used_fallback = True
                except Exception as e2:
                    err_all = str(e2)
                    duration_ms = int((time.time() - start_time) * 1000)
                    self._schedule_log(
                        org_id=org_id,
                        user_id=user_id,
                        model=str(model.value),
                        task_type=task_type,
                        module=module,
                        input_tokens=0,
                        output_tokens=0,
                        cost_usd=0.0,
                        success=False,
                        error_message=err_all,
                        duration_ms=duration_ms,
                    )
                    raise AIRouterException(task_type.value) from e2
            else:
                duration_ms = int((time.time() - start_time) * 1000)
                self._schedule_log(
                    org_id=org_id,
                    user_id=user_id,
                    model=str(model.value),
                    task_type=task_type,
                    module=module,
                    input_tokens=0,
                    output_tokens=0,
                    cost_usd=0.0,
                    success=False,
                    error_message=err_primary,
                    duration_ms=duration_ms,
                )
                raise AIRouterException(task_type.value) from e

        assert result is not None
        duration_ms = int((time.time() - start_time) * 1000)
        cost_usd = self._calculate_cost(
            result["model"],
            int(result["input_tokens"]),
            int(result["output_tokens"]),
        )
        result["duration_ms"] = duration_ms
        result["cost_usd"] = cost_usd
        result["used_fallback"] = used_fallback

        logger.info(
            "ai_request_completed",
            model=result["model"],
            task_type=task_type.value,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
        )

        self._schedule_log(
            org_id=org_id,
            user_id=user_id,
            model=result["model"],
            task_type=task_type,
            module=module,
            input_tokens=int(result["input_tokens"]),
            output_tokens=int(result["output_tokens"]),
            cost_usd=float(cost_usd),
            success=True,
            error_message=None,
            duration_ms=duration_ms,
        )

        return result

    async def _call_model(
        self,
        model: AIModel,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        keys: dict[str, str],
    ) -> dict[str, Any]:
        if model in (AIModel.CLAUDE_SONNET, AIModel.CLAUDE_HAIKU):
            return await self._call_claude(model, system_prompt, user_prompt, max_tokens, keys["anthropic"])
        if model in (AIModel.GPT4O, AIModel.GPT4O_MINI):
            return await self._call_openai(model, system_prompt, user_prompt, max_tokens, keys["openai"])
        if model in (AIModel.PERPLEXITY_SONAR, AIModel.PERPLEXITY_SONAR_PRO):
            return await self._call_perplexity(model, system_prompt, user_prompt, max_tokens, keys["perplexity"])
        if model == AIModel.GROK:
            return await self._call_grok(system_prompt, user_prompt, max_tokens, keys["grok"])
        raise ValueError(f"Unknown model: {model}")

    async def _call_claude(
        self,
        model: AIModel,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        api_key: str,
    ) -> dict[str, Any]:
        client = AsyncAnthropic(api_key=api_key or "dummy")
        response = await client.messages.create(
            model=model.value,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        block = response.content[0]
        text = block.text if hasattr(block, "text") else str(block)
        return {
            "content": text,
            "model": model.value,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }

    async def _call_openai(
        self,
        model: AIModel,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        api_key: str,
    ) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        client = AsyncOpenAI(api_key=api_key or "dummy")
        response = await client.chat.completions.create(
            model=model.value,
            max_tokens=max_tokens,
            messages=messages,
        )
        choice = response.choices[0].message
        content = choice.content or ""
        return {
            "content": content,
            "model": model.value,
            "input_tokens": response.usage.prompt_tokens if response.usage else 0,
            "output_tokens": response.usage.completion_tokens if response.usage else 0,
        }

    async def _call_perplexity(
        self,
        model: AIModel,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        api_key: str,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model.value,
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": system_prompt or "Be precise and concise."},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "content": data["choices"][0]["message"]["content"],
                "model": model.value,
                "input_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": data.get("usage", {}).get("completion_tokens", 0),
            }

    async def _call_grok(self, system_prompt: str, user_prompt: str, max_tokens: int, api_key: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.x.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "grok-3",
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": system_prompt or "Be precise."},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "content": data["choices"][0]["message"]["content"],
                "model": AIModel.GROK.value,
                "input_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": data.get("usage", {}).get("completion_tokens", 0),
            }

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        costs = MODEL_COSTS.get(model, {"input": 0.0, "output": 0.0})
        return (input_tokens / 1000 * costs["input"]) + (output_tokens / 1000 * costs["output"])


ai_router = AIRouter()

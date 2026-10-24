"""Unit tests for the org-level ai_daily_limit_usd override (Settings -> Billing)."""

from app.core.ai_router import get_org_daily_limit_usd
from app.core.config import settings


def test_falls_back_to_env_default_when_no_settings():
    assert get_org_daily_limit_usd(None) == settings.MAX_AI_COST_PER_DAY_USD
    assert get_org_daily_limit_usd({}) == settings.MAX_AI_COST_PER_DAY_USD


def test_uses_org_override_when_present():
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": 5.5}) == 5.5
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": 100}) == 100.0


def test_ignores_non_positive_override():
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": 0}) == settings.MAX_AI_COST_PER_DAY_USD
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": -5}) == settings.MAX_AI_COST_PER_DAY_USD


def test_ignores_non_numeric_override():
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": "20"}) == settings.MAX_AI_COST_PER_DAY_USD
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": None}) == settings.MAX_AI_COST_PER_DAY_USD


def test_ignores_boolean_override():
    # bool is a subclass of int in Python — must be explicitly excluded.
    assert get_org_daily_limit_usd({"ai_daily_limit_usd": True}) == settings.MAX_AI_COST_PER_DAY_USD

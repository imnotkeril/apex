import pytest
from pydantic import ValidationError

from app.core.config import Settings

BASE = dict(DATABASE_URL="postgresql://x", POSTGRES_PASSWORD="x", SUPABASE_JWT_SECRET="x")
GOOD_KEY = "k" * 40


def test_dev_auth_refused_in_production():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", DEV_AUTH=True, SECRET_KEY=GOOD_KEY, **BASE)


def test_weak_secret_refused_in_production():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", SECRET_KEY="change-me-to-a-long-random-string-at-least-32-chars", **BASE)


def test_production_ok_and_dev_unaffected():
    Settings(ENVIRONMENT="production", SECRET_KEY=GOOD_KEY, **BASE)
    Settings(ENVIRONMENT="development", DEV_AUTH=True, SECRET_KEY="short", **BASE)

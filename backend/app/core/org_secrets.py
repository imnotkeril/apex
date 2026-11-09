"""Org-level integration secrets (API keys) stored encrypted in organisations.settings.

Keys are pasted by the user in the Settings UI, encrypted with Fernet (key derived
from SECRET_KEY) and stored under organisations.settings["integrations"].
Resolution order everywhere: org-level key -> environment variable fallback.
"""

from __future__ import annotations

import base64
import hashlib
import uuid
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.organisation import Organisation

SETTINGS_KEY = "integrations"
_ENC_PREFIX = "enc:"


@dataclass(frozen=True)
class ProviderSpec:
    key: str          # storage key, e.g. "openai"
    label: str        # human label for UI
    group: str        # "ai" | "publishing" | "sources"
    env_attr: str     # Settings attribute used as fallback ("" = no fallback)
    secret: bool = True  # masked in UI; non-secret values (chat id, urn) shown as-is


PROVIDERS: list[ProviderSpec] = [
    # AI providers
    ProviderSpec("anthropic", "Anthropic (Claude)", "ai", "ANTHROPIC_API_KEY"),
    ProviderSpec("openai", "OpenAI (GPT / DALL-E / Whisper / Embeddings)", "ai", "OPENAI_API_KEY"),
    ProviderSpec("perplexity", "Perplexity (fact-check / research)", "ai", "PERPLEXITY_API_KEY"),
    ProviderSpec("grok", "Grok (xAI)", "ai", "GROK_API_KEY"),
    ProviderSpec("google_ai", "Google AI (Gemini / Imagen)", "ai", "GOOGLE_AI_API_KEY"),
    # Publishing
    ProviderSpec("telegram_bot_token", "Telegram Bot Token", "publishing", "TELEGRAM_BOT_TOKEN"),
    ProviderSpec("telegram_chat_id", "Telegram Chat/Channel ID", "publishing", "TELEGRAM_CHAT_ID", secret=False),
    ProviderSpec("twitter_api_key", "Twitter/X API Key", "publishing", ""),
    ProviderSpec("twitter_api_secret", "Twitter/X API Secret", "publishing", ""),
    ProviderSpec("twitter_access_token", "Twitter/X Access Token", "publishing", ""),
    ProviderSpec("twitter_access_secret", "Twitter/X Access Token Secret", "publishing", ""),
    ProviderSpec("linkedin_access_token", "LinkedIn Access Token", "publishing", ""),
    ProviderSpec("linkedin_author_urn", "LinkedIn Author URN", "publishing", "", secret=False),
    ProviderSpec("smtp_host", "Email: SMTP host", "publishing", "", secret=False),
    ProviderSpec("smtp_port", "Email: SMTP port (465 = SSL, else STARTTLS)", "publishing", "", secret=False),
    ProviderSpec("smtp_user", "Email: SMTP username", "publishing", "", secret=False),
    ProviderSpec("smtp_password", "Email: SMTP password", "publishing", ""),
    ProviderSpec("smtp_from", "Email: From address", "publishing", "", secret=False),
    ProviderSpec("email_recipients", "Email: recipients (comma-separated)", "publishing", "", secret=False),
    # Source parsing
    ProviderSpec("telegram_api_id", "Telegram API ID (Telethon)", "sources", "TELEGRAM_API_ID", secret=False),
    ProviderSpec("telegram_api_hash", "Telegram API Hash (Telethon)", "sources", "TELEGRAM_API_HASH"),
]

PROVIDER_MAP: dict[str, ProviderSpec] = {p.key: p for p in PROVIDERS}


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _ENC_PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str | None:
    if not token:
        return None
    if not token.startswith(_ENC_PREFIX):
        return token  # legacy plain value
    try:
        return _fernet().decrypt(token[len(_ENC_PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def mask_secret(value: str) -> str:
    if len(value) <= 4:
        return "••••"
    return f"••••{value[-4:]}"


def env_fallback(key: str) -> str:
    spec = PROVIDER_MAP.get(key)
    if not spec or not spec.env_attr:
        return ""
    return str(getattr(settings, spec.env_attr, "") or "")


def decrypt_org_integrations(org_settings: dict | None) -> dict[str, str]:
    """Decrypt all configured org integration values. Unknown/broken entries are skipped."""
    raw = (org_settings or {}).get(SETTINGS_KEY) or {}
    out: dict[str, str] = {}
    for k, token in raw.items():
        if not isinstance(token, str):
            continue
        v = decrypt_secret(token)
        if v:
            out[k] = v
    return out


def resolve_key(org_integrations: dict[str, str], key: str) -> str:
    """Org-level value if set, else env fallback."""
    return org_integrations.get(key) or env_fallback(key)


async def load_org_integrations(org_id: uuid.UUID | str) -> dict[str, str]:
    """Fetch and decrypt integrations for an org in a standalone session."""
    oid = uuid.UUID(str(org_id))
    async with AsyncSessionLocal() as session:
        r = await session.execute(select(Organisation.settings).where(Organisation.id == oid))
        row = r.scalar_one_or_none()
    return decrypt_org_integrations(row)


async def get_secret(org_id: uuid.UUID | str | None, key: str) -> str:
    """Single-key resolution: org value -> env fallback. Safe for tasks/services."""
    if org_id is not None:
        try:
            values = await load_org_integrations(org_id)
            if values.get(key):
                return values[key]
        except Exception:  # noqa: BLE001 - never let secret lookup break a pipeline
            pass
    return env_fallback(key)

"""Unit tests for org-level integration secrets (encryption, masking, resolution)."""

from app.core.org_secrets import (
    PROVIDER_MAP,
    decrypt_org_integrations,
    decrypt_secret,
    encrypt_secret,
    env_fallback,
    mask_secret,
    resolve_key,
)


def test_encrypt_decrypt_roundtrip():
    value = "sk-test-1234567890abcdef"
    token = encrypt_secret(value)
    assert token.startswith("enc:")
    assert token != value
    assert decrypt_secret(token) == value


def test_decrypt_plain_legacy_value_passthrough():
    assert decrypt_secret("plain-value") == "plain-value"


def test_decrypt_broken_token_returns_none():
    assert decrypt_secret("enc:not-a-valid-fernet-token") is None


def test_mask_secret():
    assert mask_secret("sk-abcdefgh") == "••••efgh"
    assert mask_secret("ab") == "••••"


def test_decrypt_org_integrations_skips_broken_entries():
    stored = {
        "openai": encrypt_secret("sk-good"),
        "anthropic": "enc:broken",
        "grok": 123,  # wrong type
    }
    out = decrypt_org_integrations({"integrations": stored})
    assert out == {"openai": "sk-good"}


def test_resolve_key_prefers_org_value_over_env():
    org_values = {"openai": "org-key"}
    assert resolve_key(org_values, "openai") == "org-key"
    # no org value -> env fallback (may be empty string in test env)
    assert resolve_key({}, "openai") == env_fallback("openai")


def test_provider_registry_has_expected_groups():
    groups = {p.group for p in PROVIDER_MAP.values()}
    assert groups == {"ai", "publishing", "sources"}
    assert "anthropic" in PROVIDER_MAP
    assert "twitter_api_key" in PROVIDER_MAP
    assert "linkedin_access_token" in PROVIDER_MAP

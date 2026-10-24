"""Image generation for drafts (M4 TZ Phase 3).

Two providers, selectable in Settings → AI & Generation (org.settings.image_provider):
  - "openai": DALL-E 3 (ChatGPT image generator)
  - "google": Gemini 2.5 Flash Image ("nano banana")
The non-selected provider acts as fallback when it has a key configured.

No file storage exists in Foundation yet, so images are stored as data URIs
inside content_drafts.generated_images (JSONB). Failure never breaks the pipeline (TZ §9).
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx

from app.core.org_secrets import get_secret

_GEMINI_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"


async def _generate_openai(api_key: str, prompt: str) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    r = await client.images.generate(
        model="dall-e-3",
        prompt=prompt[:3900],
        size="1024x1024",
        response_format="b64_json",
        n=1,
    )
    b64 = r.data[0].b64_json or ""
    if not b64:
        raise RuntimeError("OpenAI returned empty image")
    return f"data:image/png;base64,{b64}"


async def _generate_google(api_key: str, prompt: str) -> str:
    """Gemini 2.5 Flash Image ("nano banana") via generateContent."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            _GEMINI_IMAGE_URL,
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": prompt[:3900]}]}]},
        )
        r.raise_for_status()
        data = r.json()
    candidates = data.get("candidates") or []
    parts = ((candidates[0] or {}).get("content") or {}).get("parts") if candidates else None
    for part in parts or []:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
            return f"data:{mime};base64,{inline['data']}"
    raise RuntimeError("Gemini returned no image")


async def generate_image(
    org_id: uuid.UUID | str,
    prompt: str,
    provider_pref: str | None = None,
) -> dict[str, Any]:
    """Generate one image. Preferred provider first, other configured provider as fallback.

    Returns {"url": data_uri, "provider": name}. Raises if no provider works.
    """
    order = ["google", "openai"] if provider_pref == "google" else ["openai", "google"]
    errors: list[str] = []
    for provider in order:
        if provider == "openai":
            key = await get_secret(org_id, "openai")
            if not key:
                continue
            try:
                return {"url": await _generate_openai(key, prompt), "provider": "dall-e-3"}
            except Exception as e:  # noqa: BLE001
                errors.append(f"openai: {e}")
        else:
            key = await get_secret(org_id, "google_ai")
            if not key:
                continue
            try:
                return {"url": await _generate_google(key, prompt), "provider": "nano-banana"}
            except Exception as e:  # noqa: BLE001
                errors.append(f"google: {e}")
    raise RuntimeError("; ".join(errors) or "No image provider configured (OpenAI or Google AI key required)")

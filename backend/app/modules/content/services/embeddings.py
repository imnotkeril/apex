from __future__ import annotations

import uuid

from openai import AsyncOpenAI

from app.core.org_secrets import get_secret


async def embed_text(text: str, *, org_id: uuid.UUID | str | None = None, max_chars: int = 8000) -> list[float]:
    """OpenAI text-embedding-3-small (1536 dims) per M4 TZ §5.1. Key: org Settings → env."""
    api_key = await get_secret(org_id, "openai")
    if not api_key:
        raise RuntimeError("OpenAI API key is not configured (Settings → Integrations or OPENAI_API_KEY)")
    client = AsyncOpenAI(api_key=api_key)
    trimmed = text[:max_chars]
    response = await client.embeddings.create(model="text-embedding-3-small", input=trimmed)
    return list(response.data[0].embedding)

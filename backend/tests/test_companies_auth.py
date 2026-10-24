import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_companies_requires_auth():
    if settings.DEV_AUTH:
        pytest.skip("DEV_AUTH bypass enabled — 401 contract only applies with real auth")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/v1/companies/")
    assert r.status_code == 401

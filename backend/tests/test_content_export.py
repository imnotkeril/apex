"""Unit tests for GET /content/export (Settings -> Advanced org export)."""

import uuid
from datetime import datetime

import pytest

from app.models.organisation import Organisation
from app.modules.content.models import ContentSource, TagsConfig
from app.modules.content.router import build_org_export
from tests._fakes import FakeResult, FakeSession

ORG_ID = uuid.uuid4()


def _actor():
    return type("U", (), {"org_id": ORG_ID})()


@pytest.mark.asyncio
async def test_export_shape_with_empty_org():
    org = Organisation(id=ORG_ID, name="Acme", slug="acme", plan="free", settings={})
    db = FakeSession(
        [
            FakeResult(items=[org]),  # org lookup
            FakeResult(items=[]),  # sources
            FakeResult(items=[]),  # drafts
            FakeResult(items=[]),  # published
            FakeResult(items=[]),  # tags
        ]
    )
    out = await build_org_export(db, _actor())
    assert out["org"] == {"id": str(ORG_ID), "name": "Acme", "slug": "acme"}
    assert out["sources"] == []
    assert out["drafts"] == []
    assert out["published"] == []
    assert out["tags"] == []
    # exported_at is a real ISO timestamp
    datetime.fromisoformat(out["exported_at"])


@pytest.mark.asyncio
async def test_export_serializes_sources_and_tags():
    org = Organisation(id=ORG_ID, name="Acme", slug="acme", plan="free", settings={})
    source = ContentSource(
        id=uuid.uuid4(),
        org_id=ORG_ID,
        source_type="telegram",
        source_id="channel1",
        display_name="Channel One",
        is_active=True,
        auto_parse=True,
        parse_schedule="0 * * * *",
        default_language="en",
        last_parsed_at=None,
        total_posts_parsed=3,
        error_count=0,
        last_error=None,
    )
    tag = TagsConfig(
        id=uuid.uuid4(),
        org_id=ORG_ID,
        tag_name="ai",
        display_name="AI",
        category="topic",
        is_system=False,
    )
    db = FakeSession(
        [
            FakeResult(items=[org]),
            FakeResult(items=[source]),
            FakeResult(items=[]),
            FakeResult(items=[]),
            FakeResult(items=[tag]),
        ]
    )
    out = await build_org_export(db, _actor())
    assert len(out["sources"]) == 1
    assert out["sources"][0]["display_name"] == "Channel One"
    assert out["sources"][0]["id"] == str(source.id)  # UUID serialized to str
    assert len(out["tags"]) == 1
    assert out["tags"][0]["tag_name"] == "ai"

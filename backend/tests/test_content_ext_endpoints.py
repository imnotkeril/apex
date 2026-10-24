"""Extra content endpoints: related posts, tags, source status, cluster search, regenerate, graph focus, style versions."""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.core.exceptions import ResourceNotFoundException
from app.modules.content import router_ext
from app.modules.content.models import ContentDraft, ContentLink, ContentSource, PublishedPost, RawPost, StylePreset
from app.modules.content.services import style_versions
from tests._fakes import FakeResult, FakeSession

ORG = uuid.uuid4()
NOW = datetime(2026, 10, 24, tzinfo=timezone.utc)


def _user():
    u = MagicMock()
    u.org_id = ORG
    return u


def _raw(tags, **kw) -> RawPost:
    return RawPost(id=kw.pop("id", uuid.uuid4()), org_id=ORG, source_id=uuid.uuid4(), raw_text="t", post_date=kw.pop("post_date", NOW), tags=tags, **kw)


# ── related ──
def test_rank_related_orders_by_shared_tags_and_drops_zero_overlap():
    me = _raw(["fed", "rates", "macro"])
    two = _raw(["fed", "rates"])
    one = _raw(["macro"])
    none = _raw(["btc"])
    assert router_ext.rank_related(me, [one, none, two, me], 10) == [two, one]
    assert router_ext.rank_related(me, [one, two], 1) == [two]


@pytest.mark.asyncio
async def test_related_without_embedding_uses_tag_overlap():
    me = _raw(["fed"])
    other = _raw(["fed", "x"])
    db = FakeSession([FakeResult(items=[me]), FakeResult(items=[other])])
    out = await router_ext.related_raw_posts(me.id, db, _user(), limit=5)
    assert out == [other]


@pytest.mark.asyncio
async def test_related_without_embedding_or_tags_is_empty():
    me = _raw([])
    db = FakeSession([FakeResult(items=[me])])
    assert await router_ext.related_raw_posts(me.id, db, _user(), limit=5) == []


@pytest.mark.asyncio
async def test_related_with_embedding_issues_cosine_query():
    me = _raw(["fed"], embedding=[0.1] * 1536)
    captured = {}

    class Db(FakeSession):
        async def execute(self, stmt, *a, **k):
            captured["sql"] = str(stmt.compile(dialect=postgresql.dialect()))
            return await super().execute(stmt, *a, **k)

    db = Db([FakeResult(items=[me]), FakeResult(items=[])])
    await router_ext.related_raw_posts(me.id, db, _user(), limit=3)
    assert "<=>" in captured["sql"]  # pgvector cosine distance operator


@pytest.mark.asyncio
async def test_related_unknown_post_404():
    with pytest.raises(ResourceNotFoundException):
        await router_ext.related_raw_posts(uuid.uuid4(), FakeSession([FakeResult(items=[])]), _user(), limit=5)


# ── tags ──
@pytest.mark.asyncio
async def test_set_raw_post_tags_normalises():
    post = _raw(["old"])
    db = FakeSession([FakeResult(items=[post])])
    out = await router_ext.set_raw_post_tags(post.id, router_ext.TagsBody(tags=[" Fed ", "fed", "", "Rates"]), db, _user())
    assert out.tags == ["fed", "rates"]


@pytest.mark.asyncio
async def test_set_published_tags():
    p = PublishedPost(id=uuid.uuid4(), org_id=ORG, draft_id=uuid.uuid4(), platform="telegram", published_text="x", language="en")
    db = FakeSession([FakeResult(items=[p])])
    out = await router_ext.set_published_tags(p.id, router_ext.TagsBody(tags=["a"]), db, _user())
    assert out.tags == ["a"]


# ── source status / raw delete ──
@pytest.mark.asyncio
async def test_source_status_reports_parse_health():
    src = ContentSource(id=uuid.uuid4(), org_id=ORG, source_type="rss", source_id="u", display_name="d", is_active=True,
                        total_posts_parsed=7, error_count=2, last_error="boom")
    out = await router_ext.source_status(src.id, FakeSession([FakeResult(items=[src])]), _user())
    assert out["error_count"] == 2 and out["last_error"] == "boom" and out["total_posts_parsed"] == 7


@pytest.mark.asyncio
async def test_delete_raw_post_404_when_missing():
    with pytest.raises(ResourceNotFoundException):
        await router_ext.delete_raw_post(uuid.uuid4(), FakeSession([FakeResult(items=[])]), _user())


# ── regenerate ──
@pytest.mark.asyncio
async def test_regenerate_resets_and_queues(monkeypatch):
    delay = MagicMock()
    monkeypatch.setattr(router_ext.run_draft_pipeline_task, "delay", delay)
    d = ContentDraft(id=uuid.uuid4(), org_id=ORG, topic="t", language="en", pipeline_status="failed", pipeline_error="x", status="draft")
    db = FakeSession([FakeResult(items=[d])])
    out = await router_ext.regenerate_draft(d.id, router_ext.RegenerateBody(steps=["formatting"], languages=["ja"]), db, _user())
    assert out == {"status": "queued"}
    assert d.pipeline_status == "pending" and d.pipeline_error is None and d.translation_targets == ["ja"]
    delay.assert_called_once_with(str(d.id), ["formatting"])


@pytest.mark.asyncio
async def test_regenerate_rejects_unknown_step_and_running_pipeline(monkeypatch):
    monkeypatch.setattr(router_ext.run_draft_pipeline_task, "delay", MagicMock())
    with pytest.raises(HTTPException) as e:
        await router_ext.regenerate_draft(uuid.uuid4(), router_ext.RegenerateBody(steps=["bogus"]), FakeSession([]), _user())
    assert e.value.status_code == 400
    d = ContentDraft(id=uuid.uuid4(), org_id=ORG, topic="t", language="en", pipeline_status="translating")
    with pytest.raises(HTTPException) as e:
        await router_ext.regenerate_draft(d.id, router_ext.RegenerateBody(), FakeSession([FakeResult(items=[d])]), _user())
    assert e.value.status_code == 409


@pytest.mark.asyncio
async def test_refresh_recommendations_queues(monkeypatch):
    delay = MagicMock()
    monkeypatch.setattr(router_ext.generate_recommendations, "delay", delay)
    assert await router_ext.refresh_recommendations(_user()) == {"status": "queued"}
    delay.assert_called_once()


# ── graph focus ──
@pytest.mark.asyncio
async def test_graph_focus_returns_node_and_neighbours():
    a, b = _raw(["x"]), _raw(["x"])
    link = ContentLink(id=uuid.uuid4(), org_id=ORG, from_type="raw", from_id=a.id, to_type="raw", to_id=b.id,
                       link_type="related", confidence=0.9, is_auto=True)
    db = FakeSession([FakeResult(items=[link]), FakeResult(items=[a, b]), FakeResult(items=[])])
    out = await router_ext.graph_focus(a.id, db, _user())
    assert {n.id for n in out.nodes} == {a.id, b.id}
    assert len(out.edges) == 1 and out.stats.edges == 1


@pytest.mark.asyncio
async def test_graph_focus_unknown_node_404():
    db = FakeSession([FakeResult(items=[]), FakeResult(items=[]), FakeResult(items=[])])
    with pytest.raises(ResourceNotFoundException):
        await router_ext.graph_focus(uuid.uuid4(), db, _user())


# ── style versions ──
def _preset(**kw) -> StylePreset:
    return StylePreset(id=uuid.uuid4(), org_id=ORG, name="n", display_name="N", language="en", system_prompt="v1",
                       rewrite_instructions="r", temperature=0.7, version=1, previous_versions=[], **kw)


def test_apply_update_snapshots_only_on_real_change():
    sp = _preset()
    assert style_versions.apply_update(sp, {"is_default": True}) is False  # metadata only
    assert sp.version == 1 and sp.previous_versions == []
    assert style_versions.apply_update(sp, {"system_prompt": "v1"}) is False  # same value
    assert style_versions.apply_update(sp, {"system_prompt": "v2"}) is True
    assert sp.version == 2 and sp.system_prompt == "v2"
    assert sp.previous_versions[0]["system_prompt"] == "v1" and sp.previous_versions[0]["version"] == 1


def test_restore_version_rolls_back_and_archives_current():
    sp = _preset()
    style_versions.apply_update(sp, {"system_prompt": "v2"})
    style_versions.apply_update(sp, {"system_prompt": "v3"})
    assert sp.version == 3
    assert style_versions.restore_version(sp, 1) is True
    assert sp.system_prompt == "v1" and sp.version == 4
    assert sp.previous_versions[-1]["system_prompt"] == "v3"  # nothing lost
    assert style_versions.restore_version(sp, 99) is False


def test_history_is_capped():
    sp = _preset()
    for i in range(30):
        style_versions.apply_update(sp, {"system_prompt": f"p{i}"})
    assert len(sp.previous_versions) == style_versions.MAX_VERSIONS


@pytest.mark.asyncio
async def test_versions_endpoints():
    sp = _preset()
    style_versions.apply_update(sp, {"system_prompt": "v2"})
    versions = await router_ext.style_preset_versions(sp.id, FakeSession([FakeResult(items=[sp])]), _user())
    assert [v["version"] for v in versions] == [2, 1]
    out = await router_ext.restore_style_preset(sp.id, router_ext.RestoreBody(version=1), FakeSession([FakeResult(items=[sp])]), _user())
    assert out["version"] == 3 and sp.system_prompt == "v1"
    with pytest.raises(HTTPException) as e:
        await router_ext.restore_style_preset(sp.id, router_ext.RestoreBody(version=42), FakeSession([FakeResult(items=[sp])]), _user())
    assert e.value.status_code == 404

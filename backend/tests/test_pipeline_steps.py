"""Draft pipeline stage selection (partial regenerate) and related-content population. AI is mocked."""

import json
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.models.organisation import Organisation
from app.modules.content.models import ContentDraft, PublishedPost, RawPost, StylePreset
from app.modules.content.services import pipeline, related
from tests._fakes import FakeResult, FakeSession

ORG = uuid.uuid4()
NOW = datetime(2026, 10, 24, tzinfo=timezone.utc)


def test_plan_steps():
    allv = {"text": True, "formatting": True, "translation": True, "fact_check": True, "image": True}
    assert pipeline.plan_steps(None, True) == allv
    assert pipeline.plan_steps({"formatting"}, False) == allv  # no text yet: must generate it
    assert pipeline.plan_steps({"styling"}, True) == allv  # new text invalidates downstream
    only_fmt = pipeline.plan_steps({"formatting"}, True)
    assert only_fmt == {"text": False, "formatting": True, "translation": False, "fact_check": False, "image": False}
    assert pipeline.plan_steps({"fact_check", "image"}, True)["text"] is False


class Env:
    """Wires run_draft_pipeline to fakes and counts AI calls by task."""

    def __init__(self, monkeypatch, draft, org, post, style):
        self.calls: list[str] = []
        self.draft, self.org, self.post, self.style = draft, org, post, style

        async def complete(task, **_kw):
            self.calls.append(task.name)
            if task.name == "COMPANY_RESEARCH":
                return {"content": json.dumps({"overall_verdict": "passed", "claims": [], "summary": "ok"})}
            return {"content": "generated text"}

        async def no_research(*_a, **_k):
            return ""

        async def no_notify(*_a, **_k):
            return None

        async def no_related(*_a, **_k):
            return None

        async def load_style(*_a, **_k):
            return style

        monkeypatch.setattr(pipeline.ai_router, "complete", complete)
        monkeypatch.setattr(pipeline, "_web_research", no_research)
        monkeypatch.setattr(pipeline, "_load_style", load_style)
        monkeypatch.setattr("app.modules.content.notifications.send_notification", no_notify)
        monkeypatch.setattr(related, "populate_related", no_related)

    def session(self):
        s = FakeSession([])

        async def get(model, key):
            if model is ContentDraft:
                return self.draft
            if model is Organisation:
                return self.org
            if model is RawPost:
                return self.post
            return None

        s.get = get
        return s


def _make(monkeypatch, styled=None):
    post = RawPost(id=uuid.uuid4(), org_id=ORG, source_id=uuid.uuid4(), raw_text="src", post_date=NOW)
    draft = ContentDraft(id=uuid.uuid4(), org_id=ORG, topic="t", language="en", source_post_ids=[post.id],
                         translation_targets=["ru"], styled_text=styled, translations={}, requested_formats=[])
    org = Organisation(id=ORG, name="o", slug="o", settings={"enrich_research": False})
    style = StylePreset(id=uuid.uuid4(), org_id=ORG, name="s", display_name="S", language="en", system_prompt="sys",
                        rewrite_instructions="r", max_length_telegram=4096, forbidden_phrases=[])
    return Env(monkeypatch, draft, org, post, style), draft


@pytest.mark.asyncio
async def test_full_run_calls_every_stage(monkeypatch):
    env, draft = _make(monkeypatch)
    await pipeline.run_draft_pipeline(env.session(), draft.id)
    assert draft.pipeline_status == "ready", draft.pipeline_error
    # 1 synthesis + 3 formats + 1 translation + 1 fact check
    assert len(env.calls) == 6


@pytest.mark.asyncio
async def test_formatting_only_skips_text_translation_and_fact_check(monkeypatch):
    env, draft = _make(monkeypatch, styled="existing text")
    await pipeline.run_draft_pipeline(env.session(), draft.id, {"formatting"})
    assert draft.pipeline_status == "ready", draft.pipeline_error
    assert len(env.calls) == 3 and draft.styled_text == "existing text"
    assert draft.telegram_version == "generated text"


@pytest.mark.asyncio
async def test_fact_check_only(monkeypatch):
    env, draft = _make(monkeypatch, styled="existing text")
    await pipeline.run_draft_pipeline(env.session(), draft.id, {"fact_check"})
    assert draft.pipeline_status == "ready", draft.pipeline_error
    assert env.calls == ["COMPANY_RESEARCH"] and draft.fact_check_status == "passed"


@pytest.mark.asyncio
async def test_partial_run_survives_deleted_source_posts(monkeypatch):
    env, draft = _make(monkeypatch, styled="existing text")
    env.post = None
    await pipeline.run_draft_pipeline(env.session(), draft.id, {"translation"})
    assert draft.pipeline_status == "ready", draft.pipeline_error
    assert draft.translations == {"ru": "generated text"}


# ── related ──
def _raw(tags, day):
    return RawPost(id=uuid.uuid4(), org_id=ORG, source_id=uuid.uuid4(), raw_text="x", post_date=datetime(2026, 10, day, tzinfo=timezone.utc), tags=tags)


def test_rank_orders_by_overlap_then_recency():
    a, b, c = _raw(["fed", "rates"], 1), _raw(["fed"], 5), _raw(["btc"], 9)
    assert related.rank({"fed", "rates"}, [b, c, a]) == [a, b]


@pytest.mark.asyncio
async def test_populate_related_uses_draft_tags():
    raw, pub = _raw(["fed"], 3), PublishedPost(id=uuid.uuid4(), org_id=ORG, draft_id=uuid.uuid4(), platform="telegram",
                                               published_text="x", language="en", tags=["fed"], published_at=NOW)
    d = ContentDraft(id=uuid.uuid4(), org_id=ORG, topic="t", language="en", tags=["Fed"], source_post_ids=[])
    await related.populate_related(FakeSession([FakeResult(items=[raw]), FakeResult(items=[pub])]), d)
    assert d.related_raw_ids == [raw.id] and d.related_published_ids == [pub.id]


@pytest.mark.asyncio
async def test_populate_related_without_any_tags_clears():
    d = ContentDraft(id=uuid.uuid4(), org_id=ORG, topic="t", language="en", tags=[], source_post_ids=[])
    await related.populate_related(FakeSession([]), d)
    assert d.related_raw_ids == [] and d.related_published_ids == []

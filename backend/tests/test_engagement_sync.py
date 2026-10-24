"""Engagement sync: Twitter metrics mapped, unsupported platforms reported, failures isolated (no real API calls)."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.content import router as content_router
from app.modules.content.models import PublishedPost
from app.modules.content.services import engagement
from tests._fakes import FakeResult, FakeSession

ORG = uuid.uuid4()


def _post(platform="twitter", pid="123") -> PublishedPost:
    return PublishedPost(id=uuid.uuid4(), org_id=ORG, draft_id=uuid.uuid4(), platform=platform, platform_post_id=pid,
                         published_text="x", language="en", likes=0, reposts=0, comments=0, views=0)


def test_parse_twitter_metrics_folds_quotes_into_reposts():
    out = engagement.parse_twitter_metrics(
        {"like_count": 5, "retweet_count": 2, "quote_count": 1, "reply_count": 3, "impression_count": 900}
    )
    assert out == {"likes": 5, "reposts": 3, "comments": 3, "views": 900}
    assert engagement.parse_twitter_metrics(None) == {"likes": 0, "reposts": 0, "comments": 0, "views": 0}


@pytest.mark.asyncio
async def test_sync_post_applies_metrics_and_stamps_time():
    post = _post()

    async def fetch(_post, _org):
        return {"likes": 7, "reposts": 1, "comments": 2, "views": 50}

    await engagement.sync_post(post, fetch)
    assert (post.likes, post.reposts, post.comments, post.views) == (7, 1, 2, 50)
    assert post.last_synced_at is not None


@pytest.mark.asyncio
@pytest.mark.parametrize("platform", ["telegram", "linkedin", "email", "local"])
async def test_fetch_engagement_unsupported_platforms(platform):
    with pytest.raises(engagement.SyncUnsupported):
        await engagement.fetch_engagement(_post(platform), ORG)


@pytest.mark.asyncio
async def test_fetch_engagement_requires_credentials(monkeypatch):
    async def no_secret(*_a):
        return ""

    monkeypatch.setattr(engagement, "get_secret", no_secret)
    with pytest.raises(RuntimeError, match="credentials"):
        await engagement.fetch_engagement(_post(), ORG)


@pytest.mark.asyncio
async def test_fetch_engagement_twitter_calls_client(monkeypatch):
    async def secret(_o, key):
        return "k-" + key

    monkeypatch.setattr(engagement, "get_secret", secret)
    seen = {}

    class FakeClient:
        def get_tweet(self, tweet_id, **kw):
            seen["id"], seen["kw"] = tweet_id, kw
            return SimpleNamespace(data=SimpleNamespace(public_metrics={"like_count": 4}))

    from app.modules.content.services import publish

    monkeypatch.setattr(publish, "_twitter_client", lambda creds: FakeClient())
    out = await engagement.fetch_engagement(_post(pid="999"), ORG)
    assert out["likes"] == 4 and seen["id"] == "999" and seen["kw"]["user_auth"] is True


@pytest.mark.asyncio
async def test_sync_many_counts_each_outcome():
    ok, unsupported, bad = _post(), _post("telegram"), _post(pid="boom")

    async def fetch(post, _org):
        if post.platform != "twitter":
            raise engagement.SyncUnsupported("nope")
        if post.platform_post_id == "boom":
            raise RuntimeError("api down")
        return {"likes": 1, "reposts": 0, "comments": 0, "views": 0}

    assert await engagement.sync_many([ok, unsupported, bad], fetch) == {"synced": 1, "unsupported": 1, "failed": 1}


@pytest.mark.asyncio
async def test_sync_endpoint_maps_errors_to_http(monkeypatch):
    user = SimpleNamespace(org_id=ORG)

    async def unsupported(_p, *a, **k):
        raise engagement.SyncUnsupported("not for telegram")

    monkeypatch.setattr(engagement, "sync_post", unsupported)
    p = _post("telegram")
    with pytest.raises(HTTPException) as e:
        await content_router.sync_published(p.id, FakeSession([FakeResult(items=[p])]), user)
    assert e.value.status_code == 400

    async def broken(_p, *a, **k):
        raise RuntimeError("rate limited")

    monkeypatch.setattr(engagement, "sync_post", broken)
    with pytest.raises(HTTPException) as e:
        await content_router.sync_published(p.id, FakeSession([FakeResult(items=[p])]), user)
    assert e.value.status_code == 502 and "rate limited" in e.value.detail

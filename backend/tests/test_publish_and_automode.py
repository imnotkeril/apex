"""Unit tests for platform text selection and auto-mode cluster scoring."""

import uuid
from datetime import UTC, datetime

from app.modules.content.models import AutoModeConfig, ContentDraft, TopicCluster
from app.modules.content.services.auto_mode import score_cluster
from app.modules.content.tasks import _platform_text


def _draft(**kw) -> ContentDraft:
    d = ContentDraft(
        org_id=uuid.uuid4(),
        topic="t",
        language="en",
        styled_text="styled",
        telegram_version="tg",
        twitter_version="tw",
        linkedin_post_version="li",
        translations={"ru": "перевод"},
    )
    for k, v in kw.items():
        setattr(d, k, v)
    return d


def test_platform_text_uses_platform_version_for_source_language():
    d = _draft()
    assert _platform_text(d, "telegram", "en") == "tg"
    assert _platform_text(d, "twitter", "en") == "tw"
    assert _platform_text(d, "linkedin", "en") == "li"


def test_platform_text_uses_translation_for_other_language():
    d = _draft()
    assert _platform_text(d, "telegram", "ru") == "перевод"
    assert _platform_text(d, "telegram", "ja") == ""  # missing translation -> skip


def test_platform_text_falls_back_to_styled_text():
    d = _draft(telegram_version=None)
    assert _platform_text(d, "telegram", "en") == "styled"


def _cfg(**kw) -> AutoModeConfig:
    c = AutoModeConfig(org_id=uuid.uuid4(), weight_popularity=40, weight_freshness=40, weight_diversity=20)
    for k, v in kw.items():
        setattr(c, k, v)
    return c


def _cluster(posts: int, hours: float, diversity: int) -> TopicCluster:
    return TopicCluster(
        org_id=uuid.uuid4(),
        title="c",
        post_count=posts,
        freshness_hours=hours,
        source_diversity=diversity,
    )


def test_score_cluster_prefers_fresh_popular_diverse():
    cfg = _cfg()
    now = datetime.now(UTC)
    hot = _cluster(posts=10, hours=2, diversity=5)
    stale = _cluster(posts=10, hours=100, diversity=5)
    thin = _cluster(posts=1, hours=2, diversity=1)
    assert score_cluster(hot, cfg, now) > score_cluster(stale, cfg, now)
    assert score_cluster(hot, cfg, now) > score_cluster(thin, cfg, now)


def test_score_cluster_respects_weights():
    now = datetime.now(UTC)
    fresh_only = _cfg(weight_popularity=0, weight_freshness=100, weight_diversity=0)
    fresh = _cluster(posts=1, hours=1, diversity=1)
    popular = _cluster(posts=10, hours=71, diversity=5)
    assert score_cluster(fresh, fresh_only, now) > score_cluster(popular, fresh_only, now)

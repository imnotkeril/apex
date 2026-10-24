"""Seed demo data for local dev verification (DEV_AUTH mode).

Run inside the backend container:
    docker compose exec backend python -m scripts.seed_dev

Idempotent-ish: clears content rows for the dev org, then re-inserts a demo set.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.organisation import Organisation
from app.models.user import User
from app.modules.content.models import (
    AutoModeConfig,
    ContentCalendarEntry,
    ContentDraft,
    ContentSource,
    ImageStylePreset,
    PublishedPost,
    RawPost,
    StylePreset,
    TagsConfig,
    TopicCluster,
)

DEV_AUTH_UUID = uuid.UUID("00000000-0000-0000-0000-0000000000de")
NOW = datetime.now(timezone.utc)


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # org + dev user
        org = (await db.execute(select(Organisation).where(Organisation.slug == "default"))).scalar_one_or_none()
        if not org:
            org = Organisation(name="APEX Default", slug="default", plan="pro", settings={})
            db.add(org)
            await db.flush()
        user = (await db.execute(select(User).where(User.auth_id == DEV_AUTH_UUID))).scalar_one_or_none()
        if not user:
            user = User(auth_id=DEV_AUTH_UUID, org_id=org.id, email="dev@apex.local", full_name="Dev User", role="owner")
            db.add(user)
            await db.flush()
        oid = org.id

        # wipe existing content for a clean demo
        for model in (
            ContentCalendarEntry,
            PublishedPost,
            ContentDraft,
            RawPost,
            TopicCluster,
            ContentSource,
            TagsConfig,
            StylePreset,
            ImageStylePreset,
        ):
            await db.execute(delete(model).where(model.org_id == oid))
        await db.execute(delete(AutoModeConfig).where(AutoModeConfig.org_id == oid))

        # sources — match Sources Health panel in the reference
        sources = [
            ContentSource(org_id=oid, source_type="telegram", source_id="@macro_alerts", display_name="macro_alerts",
                          is_active=True, total_posts_parsed=2431, error_count=0, last_parsed_at=NOW - timedelta(minutes=3)),
            ContentSource(org_id=oid, source_type="telegram", source_id="@coinmetrics", display_name="coinmetrics",
                          is_active=True, total_posts_parsed=1180, error_count=0, last_parsed_at=NOW - timedelta(minutes=12)),
            ContentSource(org_id=oid, source_type="telegram", source_id="@fed_watch", display_name="fed_watch",
                          is_active=True, total_posts_parsed=860, error_count=2, last_error="Rate limit hit",
                          last_parsed_at=NOW - timedelta(minutes=32)),
            ContentSource(org_id=oid, source_type="rss", source_id="https://bloom.bg/economics", display_name="bloomberg_macro",
                          is_active=True, total_posts_parsed=540, error_count=0, last_parsed_at=NOW - timedelta(minutes=5)),
            ContentSource(org_id=oid, source_type="youtube", source_id="https://youtube.com/bankless", display_name="bankless",
                          is_active=False, total_posts_parsed=120, error_count=5, last_error="Transcription failed",
                          last_parsed_at=NOW - timedelta(hours=1)),
        ]
        db.add_all(sources)
        await db.flush()

        # tags
        db.add_all([
            TagsConfig(org_id=oid, tag_name="macro", display_name="Macro", category="topic", is_system=True),
            TagsConfig(org_id=oid, tag_name="crypto", display_name="Crypto", category="topic", is_system=False),
            TagsConfig(org_id=oid, tag_name="rates", display_name="Rates", category="topic", is_system=False),
            TagsConfig(org_id=oid, tag_name="telegram", display_name="Telegram", category="platform", is_system=True),
        ])

        # styles
        db.add_all([
            StylePreset(org_id=oid, name="macro_analyst", display_name="Macro Analyst", language="en",
                        system_prompt="You are a macro analyst.", rewrite_instructions="Be concise and data-driven.",
                        is_default=True),
            StylePreset(org_id=oid, name="crypto_brief", display_name="Crypto Brief", language="en",
                        system_prompt="You are a crypto analyst.", rewrite_instructions="Punchy, factual."),
        ])
        db.add_all([
            ImageStylePreset(org_id=oid, name="clean_charts", display_name="Clean Charts", style_type="chart",
                             style_prompt="minimal financial chart, muted palette", color_palette=["#ede9fe", "#c4b5fd", "#7c3aed"],
                             mood="minimal", is_default=True),
            ImageStylePreset(org_id=oid, name="editorial", display_name="Editorial", style_type="photo",
                             style_prompt="editorial photo, soft light", color_palette=["#f1f5f9", "#94a3b8", "#0f172a"]),
        ])

        # raw posts — populate "New Posts (24h)" with a realistic volume + a few older for the delta
        raw_seeds = [
            ("The Fed held rates at 5.25-5.50%...", "Fed holds rates steady, cites progress on inflation.", ["macro", "rates"], "analyzed"),
            ("BTC reclaims 60k as ETF inflows resume...", "Bitcoin rebounds to $60K on ETF inflows.", ["crypto", "bitcoin"], "analyzed"),
            ("Japan wage growth hits 33-year high...", "Japan wage growth at 33-year high boosts inflation outlook.", ["japan", "economy"], "analyzed"),
            ("ECB signals patience on cuts...", "ECB keeps options open, watching services inflation.", ["macro", "ecb"], "analyzed"),
            ("US jobless claims tick lower...", "Labor market stays resilient, claims below estimates.", ["macro", "jobs"], "new"),
            ("Ethereum roadmap update video...", "Vitalik outlines upcoming scalability upgrades.", ["crypto", "ethereum"], "new"),
            ("Gold pushes to fresh highs...", "Safe-haven demand lifts gold past prior records.", ["macro", "gold"], "analyzed"),
            ("China stimulus measures announced...", "Beijing unveils fiscal support for domestic demand.", ["china", "economy"], "analyzed"),
            ("Oil slips on demand concerns...", "Crude eases as growth worries weigh on sentiment.", ["commodities", "oil"], "new"),
            ("Treasury yields drift after auction...", "10y holds range after solid demand at auction.", ["macro", "rates"], "analyzed"),
            ("Solana network outage resolved...", "Downtime lasted 4 hours; root cause identified.", ["crypto", "solana"], "new"),
            ("Bank earnings beat estimates...", "Major banks post resilient net interest income.", ["earnings", "banks"], "analyzed"),
            ("CPI cools to 3.4% YoY...", "Inflation eases on energy and goods prices.", ["macro", "inflation"], "analyzed"),
            ("Powell: disinflation continues...", "Chair reiterates data-dependent stance.", ["macro", "fed"], "analyzed"),
        ]
        raw = []
        for i, (text, summary, tags, status) in enumerate(raw_seeds):
            raw.append(RawPost(org_id=oid, source_id=sources[i % len(sources)].id, raw_text=text,
                               summary=summary, tags=tags, status=status,
                               post_date=NOW - timedelta(hours=(i % 22)), language="en"))
        # a few older posts (prior 24h) so the +% delta is meaningful
        for i in range(9):
            raw.append(RawPost(org_id=oid, source_id=sources[i % len(sources)].id, raw_text="archived post",
                               summary="Older parsed item.", tags=["macro"], status="used",
                               post_date=NOW - timedelta(hours=30 + i), language="en"))
        db.add_all(raw)
        await db.flush()

        # clusters — match AI Recommendations in the reference (high / medium / low)
        clusters = [
            TopicCluster(org_id=oid, title="US FRB Maintains 5.25–5.50% Rate Range",
                         description="FRB confirms pause in inflation fight, signals data-dependent approach ahead.",
                         tags=["macro", "fed", "rates", "news"], post_count=18, source_diversity=4, freshness_hours=2.0,
                         priority="high", status="active"),
            TopicCluster(org_id=oid, title="Japan Wage Growth Hits 33-Year High",
                         description="Spring negotiations show 5.28% average increase, boosting consumption outlook.",
                         tags=["japan", "economy", "wages", "news"], post_count=11, source_diversity=3, freshness_hours=5.0,
                         priority="medium", status="active"),
            TopicCluster(org_id=oid, title="Bitcoin Rebounds to $60K",
                         description="ETF inflows resume as risk sentiment improves across markets.",
                         tags=["crypto", "bitcoin", "market", "analysis"], post_count=9, source_diversity=2, freshness_hours=9.0,
                         priority="low", status="active"),
        ]
        db.add_all(clusters)
        await db.flush()

        # drafts — 3 in active pipeline (Content Pipeline panel) + several ready
        drafts = [
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="Japan Wage Growth Hits 33-Year High",
                         status="in_progress", pipeline_status="formatting", language="en", fact_check_status="pending",
                         tags=["japan", "economy"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="US FRB Rate Decision",
                         status="in_progress", pipeline_status="translation", language="en", fact_check_status="pending",
                         tags=["macro", "fed"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="Bitcoin to $60K",
                         status="in_progress", pipeline_status="fact_check", language="en", fact_check_status="pending",
                         tags=["crypto"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="Fed Holds Rates: What It Means",
                         status="ready", pipeline_status="ready", language="en", fact_check_status="passed",
                         telegram_version="Fed holds rates...", linkedin_post_version="The Federal Reserve...",
                         styled_text="The Fed kept rates steady at 5.25-5.50%.", tags=["macro"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="Gold Pushes to Fresh Highs",
                         status="ready", pipeline_status="ready", language="en", fact_check_status="passed", tags=["macro"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="CPI Cools to 3.4% YoY",
                         status="ready", pipeline_status="ready", language="en", fact_check_status="passed", tags=["inflation"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="China Stimulus Measures Announced",
                         status="ready", pipeline_status="ready", language="en", fact_check_status="passed", tags=["china"]),
            ContentDraft(org_id=oid, created_by_user_id=user.id, topic="Ethereum Roadmap Update",
                         status="draft", pipeline_status="synthesis", language="en", fact_check_status="pending", tags=["crypto"]),
        ]
        db.add_all(drafts)
        await db.flush()

        # published — populate "Published (Week)" + "Total Views (Week)" (~48K total)
        pub_seeds = [
            ("US FRB Maintains 5.25–5.50% Rate Range", "telegram", 1200, 156, 128, 12400, 2),
            ("Japan Wage Growth Hits 33-Year High", "linkedin", 186, 23, 42, 8300, 9),
            ("Bitcoin Rebounds to $60K", "twitter", 892, 156, 210, 6700, 26),
            ("Ethereum Roadmap Update", "linkedin", 247, 31, 67, 4200, 30),
            ("Global Growth Outlook Downgraded", "telegram", 543, 121, 98, 9100, 33),
            ("Weekly Market Recap: May 5–11", "telegram", 311, 78, 55, 7500, 50),
        ]
        published = [
            PublishedPost(org_id=oid, draft_id=drafts[3].id, platform=plat, published_text=title, language="en",
                          likes=likes, reposts=reposts, comments=comments, views=views, tags=["macro"],
                          published_at=NOW - timedelta(hours=hrs))
            for (title, plat, likes, reposts, comments, views, hrs) in pub_seeds
        ]
        db.add_all(published)

        # calendar
        db.add_all([
            ContentCalendarEntry(org_id=oid, draft_id=drafts[0].id, scheduled_at=NOW + timedelta(days=1, hours=2),
                                 platforms=["telegram", "linkedin"], languages=["en"], status="scheduled"),
            ContentCalendarEntry(org_id=oid, draft_id=drafts[1].id, scheduled_at=NOW + timedelta(days=2),
                                 platforms=["twitter"], languages=["en"], status="scheduled"),
        ])

        # auto mode
        db.add(AutoModeConfig(org_id=oid, is_enabled=True, publish_times=["09:00", "18:00"],
                              max_posts_per_day=2, publish_to=["telegram", "linkedin"]))

        await db.commit()
        print(f"Seeded demo data for org {oid} (dev user {user.email}).")


if __name__ == "__main__":
    asyncio.run(seed())

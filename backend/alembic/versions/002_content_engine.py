"""content_engine_m4

Revision ID: 002_content
Revises: 001_initial
Create Date: 2026-04-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision: str = "002_content"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "content_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column("source_id", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("connection_config", JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("auto_parse", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("parse_schedule", sa.Text(), server_default="0 * * * *", nullable=False),
        sa.Column("default_language", sa.Text(), server_default="en", nullable=False),
        sa.Column("filter_keywords", ARRAY(sa.Text()), nullable=True),
        sa.Column("exclude_keywords", ARRAY(sa.Text()), nullable=True),
        sa.Column("min_post_length", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_parsed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_post_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_posts_parsed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("org_id", "source_type", "source_id", name="uq_content_sources_org_type_id"),
    )
    op.create_index("idx_sources_org", "content_sources", ["org_id"])
    op.create_index("idx_sources_active", "content_sources", ["org_id", "is_active"])

    op.create_table(
        "tags_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("parent_tag", sa.Text(), nullable=True),
        sa.Column("color", sa.Text(), server_default="#808080", nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("keywords", ARRAY(sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("org_id", "tag_name", name="uq_tags_config_org_name"),
    )
    op.create_index("idx_tags_org", "tags_config", ["org_id"])

    op.create_table(
        "style_presets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("synthesis_instructions", sa.Text(), nullable=True),
        sa.Column("rewrite_instructions", sa.Text(), nullable=False),
        sa.Column("telegram_instructions", sa.Text(), nullable=True),
        sa.Column("linkedin_instructions", sa.Text(), nullable=True),
        sa.Column("twitter_instructions", sa.Text(), nullable=True),
        sa.Column("temperature", sa.Float(), server_default="0.7", nullable=False),
        sa.Column("max_length_telegram", sa.Integer(), server_default="4096", nullable=False),
        sa.Column("max_length_linkedin", sa.Integer(), server_default="3000", nullable=False),
        sa.Column("max_length_twitter", sa.Integer(), server_default="280", nullable=False),
        sa.Column("examples", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("forbidden_phrases", ARRAY(sa.Text()), nullable=True),
        sa.Column("required_elements", ARRAY(sa.Text()), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("previous_versions", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("org_id", "name", name="uq_style_presets_org_name"),
    )

    op.create_table(
        "image_style_presets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("style_type", sa.Text(), server_default="professional", nullable=False),
        sa.Column("color_palette", ARRAY(sa.Text()), nullable=True),
        sa.Column("mood", sa.Text(), nullable=True),
        sa.Column("composition", sa.Text(), nullable=True),
        sa.Column("style_prompt", sa.Text(), nullable=False),
        sa.Column("negative_prompt", sa.Text(), server_default="no text, no logos, no watermarks, no people, no faces", nullable=False),
        sa.Column("chart_style", sa.Text(), server_default="minimal", nullable=False),
        sa.Column("chart_colors", ARRAY(sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("org_id", "name", name="uq_image_style_presets_org_name"),
    )

    op.create_table(
        "topic_clusters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tags", ARRAY(sa.Text()), nullable=True),
        sa.Column("post_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("post_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_diversity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("freshness_hours", sa.Float(), nullable=True),
        sa.Column("priority", sa.Text(), server_default="medium", nullable=False),
        sa.Column("priority_reason", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_in_draft_id", UUID(as_uuid=True), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_clusters_org", "topic_clusters", ["org_id"])
    op.create_index("idx_clusters_status", "topic_clusters", ["org_id", "status"])
    op.create_index("idx_clusters_priority", "topic_clusters", ["org_id", "priority", "freshness_hours"])

    op.create_table(
        "raw_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_id", UUID(as_uuid=True), sa.ForeignKey("content_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("author", sa.Text(), nullable=True),
        sa.Column("post_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("media_urls", ARRAY(sa.Text()), nullable=True),
        sa.Column("links", ARRAY(sa.Text()), nullable=True),
        sa.Column("language", sa.Text(), server_default="en", nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("tags", ARRAY(sa.Text()), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("status", sa.Text(), server_default="new", nullable=False),
        sa.Column("cluster_id", UUID(as_uuid=True), sa.ForeignKey("topic_clusters.id", ondelete="SET NULL"), nullable=True),
        sa.Column("used_in_draft_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("parsed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("content_hash", sa.Text(), nullable=True),
        sa.UniqueConstraint("org_id", "content_hash", name="uq_raw_posts_org_content_hash"),
    )
    op.create_index("idx_raw_posts_org", "raw_posts", ["org_id"])
    op.create_index("idx_raw_posts_status", "raw_posts", ["org_id", "status"])
    op.create_index("idx_raw_posts_date", "raw_posts", ["org_id", "post_date"])
    op.create_index("idx_raw_posts_tags", "raw_posts", ["tags"], postgresql_using="gin")
    op.create_index("idx_raw_posts_cluster", "raw_posts", ["cluster_id"])

    op.create_table(
        "content_drafts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_post_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("cluster_id", UUID(as_uuid=True), sa.ForeignKey("topic_clusters.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_type", sa.Text(), server_default="manual", nullable=False),
        sa.Column("custom_inputs", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("topic", sa.Text(), nullable=False),
        sa.Column("tags", ARRAY(sa.Text()), nullable=True),
        sa.Column("style_preset_id", UUID(as_uuid=True), sa.ForeignKey("style_presets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("language", sa.Text(), server_default="en", nullable=False),
        sa.Column("pipeline_status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("pipeline_error", sa.Text(), nullable=True),
        sa.Column("synthesized_text", sa.Text(), nullable=True),
        sa.Column("styled_text", sa.Text(), nullable=True),
        sa.Column("telegram_version", sa.Text(), nullable=True),
        sa.Column("linkedin_post_version", sa.Text(), nullable=True),
        sa.Column("linkedin_article_version", sa.Text(), nullable=True),
        sa.Column("twitter_version", sa.Text(), nullable=True),
        sa.Column("twitter_is_thread", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("twitter_thread_tweets", JSONB(), nullable=True),
        sa.Column("email_html_version", sa.Text(), nullable=True),
        sa.Column("email_subject", sa.Text(), nullable=True),
        sa.Column("translations", JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("image_analysis", JSONB(), nullable=True),
        sa.Column("image_prompt", sa.Text(), nullable=True),
        sa.Column("generated_images", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("selected_image_url", sa.Text(), nullable=True),
        sa.Column("chart_data", JSONB(), nullable=True),
        sa.Column("chart_config", JSONB(), nullable=True),
        sa.Column("chart_url", sa.Text(), nullable=True),
        sa.Column("pdf_url", sa.Text(), nullable=True),
        sa.Column("pptx_url", sa.Text(), nullable=True),
        sa.Column("video_idea", JSONB(), nullable=True),
        sa.Column("video_script", sa.Text(), nullable=True),
        sa.Column("video_format", sa.Text(), nullable=True),
        sa.Column("video_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("video_style", sa.Text(), nullable=True),
        sa.Column("fact_check_status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("fact_check_results", JSONB(), nullable=True),
        sa.Column("fact_check_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("related_published_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("related_raw_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("created_by", sa.Text(), server_default="manual", nullable=False),
        sa.Column("recommendation_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_drafts_org", "content_drafts", ["org_id"])
    op.create_index("idx_drafts_status", "content_drafts", ["org_id", "status"])
    op.create_index("idx_drafts_created", "content_drafts", ["org_id", "created_at"])

    op.create_table(
        "published_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("draft_id", UUID(as_uuid=True), sa.ForeignKey("content_drafts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.Text(), nullable=False),
        sa.Column("platform_post_id", sa.Text(), nullable=True),
        sa.Column("post_url", sa.Text(), nullable=True),
        sa.Column("published_text", sa.Text(), nullable=False),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("likes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reposts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("comments", sa.Integer(), server_default="0", nullable=False),
        sa.Column("views", sa.Integer(), server_default="0", nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("tags", ARRAY(sa.Text()), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_published_org", "published_posts", ["org_id"])
    op.create_index("idx_published_platform", "published_posts", ["org_id", "platform"])
    op.create_index("idx_published_date", "published_posts", ["org_id", "published_at"])

    op.create_table(
        "content_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_type", sa.Text(), nullable=False),
        sa.Column("from_id", UUID(as_uuid=True), nullable=False),
        sa.Column("to_type", sa.Text(), nullable=False),
        sa.Column("to_id", UUID(as_uuid=True), nullable=False),
        sa.Column("link_type", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("is_auto", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("org_id", "from_type", "from_id", "to_type", "to_id", name="uq_content_links_edge"),
    )
    op.create_index("idx_links_from", "content_links", ["from_type", "from_id"])
    op.create_index("idx_links_to", "content_links", ["to_type", "to_id"])

    op.create_table(
        "fact_check_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("draft_id", UUID(as_uuid=True), sa.ForeignKey("content_drafts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("claim", sa.Text(), nullable=False),
        sa.Column("verdict", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("source_title", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "content_calendar",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("draft_id", UUID(as_uuid=True), sa.ForeignKey("content_drafts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("platforms", ARRAY(sa.Text()), nullable=False),
        sa.Column("languages", ARRAY(sa.Text()), nullable=False),
        sa.Column("status", sa.Text(), server_default="scheduled", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_calendar_org", "content_calendar", ["org_id", "scheduled_at"])
    op.create_index("idx_calendar_status", "content_calendar", ["status", "scheduled_at"])

    op.create_table(
        "auto_mode_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("is_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("publish_times", ARRAY(sa.Text()), server_default=sa.text("ARRAY['09:00','18:00']::text[]"), nullable=False),
        sa.Column("timezone", sa.Text(), server_default="UTC", nullable=False),
        sa.Column("max_posts_per_day", sa.Integer(), server_default="2", nullable=False),
        sa.Column("weight_popularity", sa.Integer(), server_default="40", nullable=False),
        sa.Column("weight_freshness", sa.Integer(), server_default="40", nullable=False),
        sa.Column("weight_diversity", sa.Integer(), server_default="20", nullable=False),
        sa.Column("min_source_count", sa.Integer(), server_default="2", nullable=False),
        sa.Column("avoid_repeat_hours", sa.Integer(), server_default="24", nullable=False),
        sa.Column("publish_to", ARRAY(sa.Text()), server_default=sa.text("ARRAY['telegram']::text[]"), nullable=False),
        sa.Column("default_style_id", UUID(as_uuid=True), sa.ForeignKey("style_presets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("default_image_style_id", UUID(as_uuid=True), sa.ForeignKey("image_style_presets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("auto_translate_to", ARRAY(sa.Text()), server_default=sa.text("ARRAY[]::text[]"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_foreign_key(
        "fk_topic_clusters_used_in_draft",
        "topic_clusters",
        "content_drafts",
        ["used_in_draft_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_topic_clusters_used_in_draft", "topic_clusters", type_="foreignkey")
    op.drop_table("auto_mode_config")
    op.drop_table("content_calendar")
    op.drop_table("fact_check_results")
    op.drop_table("content_links")
    op.drop_table("published_posts")
    op.drop_table("content_drafts")
    op.drop_index("idx_raw_posts_cluster", table_name="raw_posts")
    op.drop_index("idx_raw_posts_tags", table_name="raw_posts")
    op.drop_index("idx_raw_posts_date", table_name="raw_posts")
    op.drop_index("idx_raw_posts_status", table_name="raw_posts")
    op.drop_index("idx_raw_posts_org", table_name="raw_posts")
    op.drop_table("raw_posts")
    op.drop_index("idx_clusters_priority", table_name="topic_clusters")
    op.drop_index("idx_clusters_status", table_name="topic_clusters")
    op.drop_index("idx_clusters_org", table_name="topic_clusters")
    op.drop_table("topic_clusters")
    op.drop_table("image_style_presets")
    op.drop_table("style_presets")
    op.drop_index("idx_tags_org", table_name="tags_config")
    op.drop_table("tags_config")
    op.drop_index("idx_sources_active", table_name="content_sources")
    op.drop_index("idx_sources_org", table_name="content_sources")
    op.drop_table("content_sources")
    op.execute("DROP EXTENSION IF EXISTS vector")

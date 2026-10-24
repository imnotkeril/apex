from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ContentSource(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "content_sources"
    __table_args__ = (UniqueConstraint("org_id", "source_type", "source_id", name="uq_content_sources_org_type_id"),)

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    connection_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    auto_parse: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    parse_schedule: Mapped[str] = mapped_column(Text, default="0 * * * *", server_default="0 * * * *")
    default_language: Mapped[str] = mapped_column(Text, default="en", server_default="en")
    filter_keywords: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    exclude_keywords: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    min_post_length: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_parsed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_post_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_posts_parsed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    error_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    raw_posts: Mapped[list["RawPost"]] = relationship("RawPost", back_populates="source")


class TagsConfig(Base, UUIDMixin):
    __tablename__ = "tags_config"
    __table_args__ = (UniqueConstraint("org_id", "tag_name", name="uq_tags_config_org_name"),)

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    tag_name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    parent_tag: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(Text, default="#808080", server_default="#808080")
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    priority: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StylePreset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "style_presets"
    __table_args__ = (UniqueConstraint("org_id", "name", name="uq_style_presets_org_name"),)

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    synthesis_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    rewrite_instructions: Mapped[str] = mapped_column(Text, nullable=False)
    telegram_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature: Mapped[float] = mapped_column(Float, default=0.7, server_default="0.7")
    max_length_telegram: Mapped[int] = mapped_column(Integer, default=4096, server_default="4096")
    max_length_linkedin: Mapped[int] = mapped_column(Integer, default=3000, server_default="3000")
    max_length_twitter: Mapped[int] = mapped_column(Integer, default=280, server_default="280")
    examples: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    forbidden_phrases: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    required_elements: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    previous_versions: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class ImageStylePreset(Base, UUIDMixin):
    __tablename__ = "image_style_presets"
    __table_args__ = (UniqueConstraint("org_id", "name", name="uq_image_style_presets_org_name"),)

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    style_type: Mapped[str] = mapped_column(Text, default="professional", server_default="professional")
    color_palette: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    mood: Mapped[str | None] = mapped_column(Text, nullable=True)
    composition: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    negative_prompt: Mapped[str] = mapped_column(
        Text,
        default="no text, no logos, no watermarks, no people, no faces",
        server_default="no text, no logos, no watermarks, no people, no faces",
    )
    chart_style: Mapped[str] = mapped_column(Text, default="minimal", server_default="minimal")
    chart_colors: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TopicCluster(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "topic_clusters"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    post_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    post_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    source_diversity: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    freshness_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    priority: Mapped[str] = mapped_column(Text, default="medium", server_default="medium")
    priority_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="active", server_default="active")
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_in_draft_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_drafts.id", ondelete="SET NULL"), nullable=True
    )
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    raw_posts: Mapped[list["RawPost"]] = relationship("RawPost", back_populates="cluster")


class RawPost(Base, UUIDMixin):
    __tablename__ = "raw_posts"
    __table_args__ = (UniqueConstraint("org_id", "content_hash", name="uq_raw_posts_org_content_hash"),)

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("content_sources.id", ondelete="CASCADE"))
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    links: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    language: Mapped[str] = mapped_column(Text, default="en", server_default="en")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
    status: Mapped[str] = mapped_column(Text, default="new", server_default="new")
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic_clusters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    used_in_draft_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    parsed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped["ContentSource"] = relationship("ContentSource", back_populates="raw_posts")
    cluster: Mapped["TopicCluster | None"] = relationship("TopicCluster", back_populates="raw_posts")


class ContentDraft(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "content_drafts"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    source_post_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic_clusters.id", ondelete="SET NULL"), nullable=True
    )
    source_type: Mapped[str] = mapped_column(Text, default="manual", server_default="manual")
    custom_inputs: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    style_preset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("style_presets.id", ondelete="SET NULL"), nullable=True
    )
    language: Mapped[str] = mapped_column(Text, default="en", server_default="en")
    pipeline_status: Mapped[str] = mapped_column(Text, default="pending", server_default="pending")
    pipeline_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    synthesized_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    styled_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    telegram_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_post_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_article_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_is_thread: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    twitter_thread_tweets: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    email_html_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    translations: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    image_analysis: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    image_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_images: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    selected_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    chart_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    chart_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    chart_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    pptx_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_idea: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    video_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_format: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    fact_check_status: Mapped[str] = mapped_column(Text, default="pending", server_default="pending")
    fact_check_results: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    fact_check_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    related_published_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    related_raw_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    status: Mapped[str] = mapped_column(Text, default="draft", server_default="draft")
    created_by: Mapped[str] = mapped_column(Text, default="manual", server_default="manual")
    recommendation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_formats: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    translation_targets: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)


class PublishedPost(Base, UUIDMixin):
    __tablename__ = "published_posts"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    draft_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("content_drafts.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(Text, nullable=False)
    platform_post_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    reposts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    comments: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    views: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ContentLink(Base, UUIDMixin):
    __tablename__ = "content_links"
    __table_args__ = (UniqueConstraint("org_id", "from_type", "from_id", "to_type", "to_id", name="uq_content_links_edge"),)

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"))
    from_type: Mapped[str] = mapped_column(Text, nullable=False)
    from_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    to_type: Mapped[str] = mapped_column(Text, nullable=False)
    to_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    link_type: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0")
    is_auto: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FactCheckResult(Base, UUIDMixin):
    __tablename__ = "fact_check_results"

    draft_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("content_drafts.id", ondelete="CASCADE"))
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContentCalendarEntry(Base, UUIDMixin):
    __tablename__ = "content_calendar"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"))
    draft_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("content_drafts.id", ondelete="CASCADE"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    platforms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    languages: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    status: Mapped[str] = mapped_column(Text, default="scheduled", server_default="scheduled")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AutoModeConfig(Base, UUIDMixin):
    __tablename__ = "auto_mode_config"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    publish_times: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=sa.text("ARRAY['09:00','18:00']::text[]")
    )
    timezone: Mapped[str] = mapped_column(Text, default="UTC", server_default="UTC")
    max_posts_per_day: Mapped[int] = mapped_column(Integer, default=2, server_default="2")
    weight_popularity: Mapped[int] = mapped_column(Integer, default=40, server_default="40")
    weight_freshness: Mapped[int] = mapped_column(Integer, default=40, server_default="40")
    weight_diversity: Mapped[int] = mapped_column(Integer, default=20, server_default="20")
    min_source_count: Mapped[int] = mapped_column(Integer, default=2, server_default="2")
    avoid_repeat_hours: Mapped[int] = mapped_column(Integer, default=24, server_default="24")
    publish_to: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=sa.text("ARRAY['telegram']::text[]")
    )
    default_style_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("style_presets.id", ondelete="SET NULL"), nullable=True
    )
    default_image_style_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("image_style_presets.id", ondelete="SET NULL"), nullable=True
    )
    auto_translate_to: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=sa.text("ARRAY[]::text[]")
    )
    # Scheduling flexibility: which weekdays auto-mode runs (empty = every day)
    publish_days: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=sa.text("ARRAY[]::text[]")
    )
    # Topic filter: only clusters overlapping these tags (empty = any topic)
    allowed_tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=sa.text("ARRAY[]::text[]")
    )
    # "full_auto" publishes after a clean pipeline; "draft_only" stops at a ready draft for review
    mode: Mapped[str] = mapped_column(Text, default="full_auto", server_default="full_auto")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AutoModeRun(Base, UUIDMixin):
    """One decision of the auto-mode cycle: a draft was started, or the slot was skipped (and why)."""

    __tablename__ = "auto_mode_runs"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)  # "created" | "skipped"
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    mode: Mapped[str] = mapped_column(Text, default="full_auto", server_default="full_auto")
    draft_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_drafts.id", ondelete="SET NULL"), nullable=True
    )
    topic: Mapped[str | None] = mapped_column(Text, nullable=True)
    platforms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default=sa.text("ARRAY[]::text[]"))

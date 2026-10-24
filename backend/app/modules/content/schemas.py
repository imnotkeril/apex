from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ContentSourceCreate(BaseModel):
    source_type: str
    source_id: str
    display_name: str
    connection_config: dict[str, Any] | None = None
    is_active: bool = True
    auto_parse: bool = True
    parse_schedule: str = "0 * * * *"
    default_language: str = "en"
    filter_keywords: list[str] | None = None
    exclude_keywords: list[str] | None = None
    min_post_length: int = 0


class ContentSourceUpdate(BaseModel):
    display_name: str | None = None
    connection_config: dict[str, Any] | None = None
    is_active: bool | None = None
    auto_parse: bool | None = None
    parse_schedule: str | None = None
    default_language: str | None = None
    filter_keywords: list[str] | None = None
    exclude_keywords: list[str] | None = None
    min_post_length: int | None = None


class ContentSourceRead(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    source_type: str
    source_id: str
    display_name: str
    is_active: bool
    auto_parse: bool
    parse_schedule: str
    default_language: str
    last_parsed_at: datetime | None
    total_posts_parsed: int
    error_count: int
    last_error: str | None

    model_config = {"from_attributes": True}


class RawPostRead(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    raw_text: str
    summary: str | None
    tags: list[str] | None
    status: str
    post_date: datetime
    source_url: str | None
    cluster_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class RawPostPatch(BaseModel):
    tags: list[str] | None = None
    summary: str | None = None
    status: str | None = None


class TopicClusterRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    tags: list[str] | None
    post_count: int
    source_diversity: int
    freshness_hours: float | None
    priority: str
    status: str

    model_config = {"from_attributes": True}


class DraftCreate(BaseModel):
    topic: str
    source_post_ids: list[uuid.UUID] = Field(default_factory=list)
    cluster_id: uuid.UUID | None = None
    style_preset_id: uuid.UUID | None = None
    language: str = "en"
    tags: list[str] | None = None
    output_formats: list[str] | None = None
    translation_targets: list[str] | None = None


class CustomInputCreate(BaseModel):
    input_type: str  # url | youtube | text
    value: str
    language: str = "en"
    tags: list[str] | None = None


class DraftRead(BaseModel):
    id: uuid.UUID
    topic: str
    pipeline_status: str
    pipeline_error: str | None
    status: str
    language: str
    telegram_version: str | None
    linkedin_post_version: str | None
    twitter_version: str | None
    fact_check_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DraftDetailRead(DraftRead):
    synthesized_text: str | None = None
    styled_text: str | None = None
    fact_check_results: dict[str, Any] | None = None


class PublishBody(BaseModel):
    platforms: list[str]
    languages: list[str] = Field(default_factory=lambda: ["en"])
    scheduled_at: datetime | None = None


class TagsConfigCreate(BaseModel):
    tag_name: str
    display_name: str
    category: str
    parent_tag: str | None = None
    color: str = "#808080"
    description: str | None = None
    keywords: list[str] | None = None


class TagsConfigRead(BaseModel):
    id: uuid.UUID
    tag_name: str
    display_name: str
    category: str
    is_system: bool

    model_config = {"from_attributes": True}


class StylePresetCreate(BaseModel):
    name: str
    display_name: str
    language: str
    system_prompt: str
    rewrite_instructions: str
    synthesis_instructions: str | None = None
    temperature: float = 0.7


class StylePresetRead(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    language: str
    is_default: bool

    model_config = {"from_attributes": True}


class AutoModeRead(BaseModel):
    is_enabled: bool
    publish_times: list[str]
    timezone: str
    max_posts_per_day: int
    weight_popularity: int
    weight_freshness: int
    weight_diversity: int
    min_source_count: int
    avoid_repeat_hours: int
    publish_to: list[str]
    publish_days: list[str] = []
    allowed_tags: list[str] = []
    mode: str = "full_auto"

    model_config = {"from_attributes": True}


class AutoModeUpdate(BaseModel):
    is_enabled: bool | None = None
    publish_times: list[str] | None = None
    timezone: str | None = None
    max_posts_per_day: int | None = None
    weight_popularity: int | None = None
    weight_freshness: int | None = None
    weight_diversity: int | None = None
    min_source_count: int | None = None
    avoid_repeat_hours: int | None = None
    publish_to: list[str] | None = None
    publish_days: list[str] | None = None
    allowed_tags: list[str] | None = None
    mode: str | None = None
    default_style_id: uuid.UUID | None = None


# ── Drafts (extended) ──
class DraftPatch(BaseModel):
    topic: str | None = None
    tags: list[str] | None = None
    status: str | None = None
    synthesized_text: str | None = None
    styled_text: str | None = None
    telegram_version: str | None = None
    linkedin_post_version: str | None = None
    twitter_version: str | None = None
    chart_data: dict[str, Any] | None = None
    chart_config: dict[str, Any] | None = None


class RelatedContent(BaseModel):
    raw: list[RawPostRead] = Field(default_factory=list)
    published: list["PublishedPostRead"] = Field(default_factory=list)


# ── Published posts ──
class PublishedPostRead(BaseModel):
    id: uuid.UUID
    draft_id: uuid.UUID
    platform: str
    platform_post_id: str | None
    post_url: str | None
    published_text: str
    language: str
    likes: int
    reposts: int
    comments: int
    views: int
    tags: list[str] | None
    published_at: datetime
    last_synced_at: datetime | None

    model_config = {"from_attributes": True}


# ── Calendar ──
class CalendarEntryRead(BaseModel):
    id: uuid.UUID
    draft_id: uuid.UUID
    scheduled_at: datetime
    platforms: list[str]
    languages: list[str]
    status: str
    published_at: datetime | None
    error_message: str | None

    model_config = {"from_attributes": True}


class CalendarReschedule(BaseModel):
    scheduled_at: datetime


# ── Style presets (extended) ──
class StylePresetUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    language: str | None = None
    system_prompt: str | None = None
    synthesis_instructions: str | None = None
    rewrite_instructions: str | None = None
    temperature: float | None = None
    is_default: bool | None = None
    is_active: bool | None = None


# ── Image style presets ──
class ImageStylePresetCreate(BaseModel):
    name: str
    display_name: str
    style_type: str = "professional"
    color_palette: list[str] | None = None
    mood: str | None = None
    style_prompt: str
    chart_style: str = "minimal"


class ImageStylePresetUpdate(BaseModel):
    display_name: str | None = None
    style_type: str | None = None
    color_palette: list[str] | None = None
    mood: str | None = None
    style_prompt: str | None = None
    chart_style: str | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class ImageStylePresetRead(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    style_type: str
    color_palette: list[str] | None
    mood: str | None
    chart_style: str
    is_default: bool
    is_active: bool

    model_config = {"from_attributes": True}


# ── Tags (extended) ──
class TagsConfigUpdate(BaseModel):
    display_name: str | None = None
    category: str | None = None
    color: str | None = None
    description: str | None = None
    is_active: bool | None = None


# ── Knowledge graph ──
class GraphNode(BaseModel):
    id: uuid.UUID
    type: str  # raw | published
    title: str
    source: str | None = None
    date: datetime | None = None
    tags: list[str] | None = None
    size: int = 1
    summary: str | None = None
    metrics: dict[str, int] | None = None


class GraphEdge(BaseModel):
    id: uuid.UUID
    from_id: uuid.UUID = Field(alias="from")
    to_id: uuid.UUID = Field(alias="to")
    link_type: str
    confidence: float
    is_auto: bool

    model_config = {"populate_by_name": True}


class GraphStats(BaseModel):
    nodes: int
    edges: int
    raw: int
    published: int


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    stats: GraphStats


class ManualLinkCreate(BaseModel):
    from_type: str
    from_id: uuid.UUID
    to_type: str
    to_id: uuid.UUID
    link_type: str = "same_topic"


# Resolve forward reference RelatedContent.published -> PublishedPostRead.
RelatedContent.model_rebuild()


# ── Auto Mode activity ──
class AutoModeRunRead(BaseModel):
    id: uuid.UUID
    ran_at: datetime
    outcome: str
    reason: str | None
    mode: str
    topic: str | None
    platforms: list[str]
    draft_id: uuid.UUID | None
    draft_status: str | None
    pipeline_status: str | None


class AutoModeStats(BaseModel):
    generated: int
    published: int
    failed: int
    skipped: int
    success_rate: int | None


class AutoModeActivity(BaseModel):
    stats: AutoModeStats
    runs: list[AutoModeRunRead]

// Interim API types — grounded in backend/app/modules/content/schemas.py.
// TODO: replace with generated types from OpenAPI once backend runs:
//   npx openapi-typescript http://localhost:8000/openapi.json -o lib/api/types.ts

export type UUID = string
export type ISODate = string

export type Priority = "high" | "medium" | "low"
export type Platform = "telegram" | "linkedin" | "twitter" | "email" | "pdf" | "internal"

export interface ContentSource {
  id: UUID
  org_id: UUID
  source_type: string
  source_id: string
  display_name: string
  is_active: boolean
  auto_parse: boolean
  parse_schedule: string
  default_language: string
  last_parsed_at: ISODate | null
  total_posts_parsed: number
  error_count: number
  last_error: string | null
}

export interface RawPost {
  id: UUID
  source_id: UUID
  raw_text: string
  summary: string | null
  tags: string[] | null
  status: string
  post_date: ISODate
  source_url: string | null
  cluster_id: UUID | null
}

export interface TopicCluster {
  id: UUID
  title: string
  description: string | null
  tags: string[] | null
  post_count: number
  source_diversity: number
  freshness_hours: number | null
  priority: string
  status: string
}

export interface Draft {
  id: UUID
  topic: string
  pipeline_status: string
  pipeline_error: string | null
  status: string
  language: string
  telegram_version: string | null
  linkedin_post_version: string | null
  twitter_version: string | null
  fact_check_status: string
  created_at: ISODate
}

export interface DraftDetail extends Draft {
  synthesized_text: string | null
  styled_text: string | null
  fact_check_results: Record<string, unknown> | null
}

export interface TagConfig {
  id: UUID
  tag_name: string
  display_name: string
  category: string
  is_system: boolean
}

export interface StylePreset {
  id: UUID
  name: string
  display_name: string
  language: string
  is_default: boolean
}

export interface AutoModeConfig {
  is_enabled: boolean
  publish_times: string[]
  timezone: string
  max_posts_per_day: number
  weight_popularity: number
  weight_freshness: number
  weight_diversity: number
  min_source_count: number
  avoid_repeat_hours: number
  publish_to: string[]
  publish_days: string[]
  allowed_tags: string[]
  mode: "full_auto" | "draft_only"
}

export interface AutoModeRun {
  id: string
  ran_at: ISODate
  outcome: "created" | "skipped"
  reason: string | null
  mode: "full_auto" | "draft_only"
  topic: string | null
  platforms: string[]
  draft_id: string | null
  draft_status: string | null
  pipeline_status: string | null
}

export interface AutoModeActivity {
  stats: { generated: number; published: number; failed: number; skipped: number; success_rate: number | null }
  runs: AutoModeRun[]
}

export interface AiUsageSummary {
  today_usd: number
  month_usd: number
  daily_limit_usd: number
  daily_remaining_usd: number
  by_model: { key: string; cost_usd: number; calls: number; tokens: number }[]
  by_task: { key: string; cost_usd: number; calls: number; tokens: number }[]
}

export interface DashboardStats {
  new_posts_24h?: number
  active_clusters?: number
  drafts_ready?: number
  published_this_week?: number
  total_views_week?: number
  [k: string]: unknown
}

export interface DraftDetailFull extends DraftDetail {
  // extra fields surfaced by GET /drafts/{id}
  [k: string]: unknown
}

export interface PublishedPost {
  id: UUID
  draft_id: UUID
  platform: string
  platform_post_id: string | null
  post_url: string | null
  published_text: string
  language: string
  likes: number
  reposts: number
  comments: number
  views: number
  tags: string[] | null
  published_at: ISODate
  last_synced_at: ISODate | null
}

export interface CalendarEntry {
  id: UUID
  draft_id: UUID
  scheduled_at: ISODate
  platforms: string[]
  languages: string[]
  status: string
  published_at: ISODate | null
  error_message: string | null
}

export interface ImageStylePreset {
  id: UUID
  name: string
  display_name: string
  style_type: string
  color_palette: string[] | null
  mood: string | null
  chart_style: string
  is_default: boolean
  is_active: boolean
}

export interface GraphNode {
  id: UUID
  type: "raw" | "published"
  title: string
  source?: string | null
  date?: ISODate | null
  tags?: string[] | null
  size?: number
  summary?: string | null
  metrics?: Record<string, number> | null
}

export interface GraphEdge {
  id: UUID
  from: UUID
  to: UUID
  link_type: string
  confidence: number
  is_auto: boolean
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: { nodes: number; edges: number; raw: number; published: number }
}

export interface IntegrationStatus {
  key: string
  label: string
  group: "ai" | "publishing" | "sources"
  secret: boolean
  configured: boolean
  masked?: string | null
  env_fallback: boolean
}

export interface Organisation {
  id: UUID
  name: string
  slug: string
  plan: string
  settings: Record<string, unknown>
  created_at: ISODate
  updated_at: ISODate
}

export interface UserProfile {
  id: UUID
  auth_id: UUID
  org_id: UUID
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  is_active: boolean
  preferences: Record<string, unknown>
  created_at: ISODate
  updated_at: ISODate
}

export interface MyActivity {
  drafts: number
  published: number
  topics: number
}

/** A member of the current org, as returned by GET /orgs/current/users (same shape as UserProfile). */
export type OrgUser = UserProfile

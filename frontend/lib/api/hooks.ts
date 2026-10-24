"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { contentFetch, apiV1Fetch } from "@/lib/api/content"
import type {
  AutoModeActivity,
  AutoModeConfig,
  CalendarEntry,
  ContentSource,
  DashboardStats,
  Draft,
  DraftDetail,
  GraphData,
  ImageStylePreset,
  IntegrationStatus,
  MyActivity,
  Organisation,
  OrgUser,
  PublishedPost,
  RawPost,
  StylePreset,
  TagConfig,
  TopicCluster,
  UserProfile,
} from "@/lib/api/types"

// Query keys
export const qk = {
  dashboardStats: ["dashboard-stats"] as const,
  sources: ["sources"] as const,
  rawPosts: (params?: Record<string, string>) => ["raw-posts", params ?? {}] as const,
  clusters: ["clusters"] as const,
  drafts: (params?: Record<string, string>) => ["drafts", params ?? {}] as const,
  draft: (id: string) => ["draft", id] as const,
  tags: ["tags"] as const,
  styles: ["style-presets"] as const,
  imageStyles: ["image-style-presets"] as const,
  autoMode: ["auto-mode"] as const,
  published: (params?: Record<string, string>) => ["published", params ?? {}] as const,
  calendar: (params?: Record<string, string>) => ["calendar", params ?? {}] as const,
  graph: (params?: Record<string, string>) => ["graph", params ?? {}] as const,
}

function qs(params?: Record<string, string | undefined>) {
  if (!params) return ""
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ""
}

// ── Dashboard ──
export function useDashboardStats() {
  return useQuery({ queryKey: qk.dashboardStats, queryFn: () => contentFetch<DashboardStats>("/dashboard-stats") })
}

// ── Sources ──
export function useSources() {
  return useQuery({ queryKey: qk.sources, queryFn: () => contentFetch<ContentSource[]>("/sources") })
}
export function useCreateSource() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch<ContentSource>("/sources", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.sources }),
  })
}
export function useUpdateSource() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      contentFetch<ContentSource>(`/sources/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.sources }),
  })
}
export function useDeleteSource() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/sources/${id}`, { method: "DELETE" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.sources }),
  })
}
export function useCustomInput() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: { input_type: string; value: string; language?: string; tags?: string[] }) =>
      contentFetch<RawPost>("/custom-input", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["raw-posts"] }),
  })
}
export function useParseSource() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/sources/${id}/parse`, { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.sources }),
  })
}
export function useParseAll() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: () => contentFetch("/sources/parse-all", { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.sources }),
  })
}

// ── Raw posts ──
export function useRawPosts(params?: Record<string, string>) {
  return useQuery({
    queryKey: qk.rawPosts(params),
    queryFn: () => contentFetch<RawPost[]>(`/raw-posts${qs(params)}`),
  })
}

export function useUpdateRawPost() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      contentFetch<RawPost>(`/raw-posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["raw-posts"] }),
  })
}

// ── Clusters ──
export function useClusters() {
  return useQuery({ queryKey: qk.clusters, queryFn: () => contentFetch<TopicCluster[]>("/clusters") })
}
export function useRefreshClusters() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: () => contentFetch("/clusters/refresh", { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.clusters }),
  })
}
export function useDismissCluster() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/clusters/${id}/dismiss`, { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.clusters }),
  })
}

// ── Drafts ──
export function useDrafts(params?: Record<string, string>) {
  return useQuery({
    queryKey: qk.drafts(params),
    queryFn: () => contentFetch<Draft[]>(`/drafts${qs(params)}`),
  })
}
export function useDraft(id: string | null) {
  return useQuery({
    queryKey: qk.draft(id ?? ""),
    queryFn: () => contentFetch<DraftDetail>(`/drafts/${id}`),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = (q.state.data as DraftDetail | undefined)?.pipeline_status?.toLowerCase()
      return s && !["ready", "failed", "done"].includes(s) ? 3000 : false
    },
  })
}
export function useDeleteDraft() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/drafts/${id}`, { method: "DELETE" }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["drafts"] }),
  })
}
export function useCreateDraft() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch<Draft>("/drafts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["drafts"] }),
  })
}
export function usePublishDraft() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      contentFetch(`/drafts/${id}/publish`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      c.invalidateQueries({ queryKey: ["drafts"] })
      c.invalidateQueries({ queryKey: ["calendar"] })
    },
  })
}

// ── Published ──
export function usePublished(params?: Record<string, string>) {
  return useQuery({
    queryKey: qk.published(params),
    queryFn: () => contentFetch<PublishedPost[]>(`/published${qs(params)}`),
  })
}
export function useSyncPublished() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/published/${id}/sync`, { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["published"] }),
  })
}

// ── Calendar ──
export function useCalendar(params?: Record<string, string>) {
  return useQuery({
    queryKey: qk.calendar(params),
    queryFn: () => contentFetch<CalendarEntry[]>(`/calendar${qs(params)}`),
  })
}
export function useRescheduleCalendar() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scheduled_at }: { id: string; scheduled_at: string }) =>
      contentFetch(`/calendar/${id}/reschedule`, { method: "PUT", body: JSON.stringify({ scheduled_at }) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["calendar"] }),
  })
}
export function useCancelCalendar() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/calendar/${id}`, { method: "DELETE" }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["calendar"] }),
  })
}

// ── Knowledge graph ──
export function useGraph(params?: Record<string, string>) {
  return useQuery({
    queryKey: qk.graph(params),
    queryFn: () => contentFetch<GraphData>(`/graph${qs(params)}`),
  })
}

// ── Image styles ──
export function useImageStyles() {
  return useQuery({
    queryKey: qk.imageStyles,
    queryFn: () => contentFetch<ImageStylePreset[]>("/image-style-presets"),
  })
}
export function useCreateImageStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch<ImageStylePreset>("/image-style-presets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.imageStyles }),
  })
}
export function useUpdateImageStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      contentFetch<ImageStylePreset>(`/image-style-presets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.imageStyles }),
  })
}
export function useDeleteImageStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/image-style-presets/${id}`, { method: "DELETE" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.imageStyles }),
  })
}

// ── Tags create/update ──
export function useCreateTag() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch<TagConfig>("/tags", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.tags }),
  })
}
export function useUpdateTag() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      contentFetch<TagConfig>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.tags }),
  })
}

// ── Styles create/update ──
export function useCreateStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch<StylePreset>("/style-presets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.styles }),
  })
}
export function useUpdateStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      contentFetch<StylePreset>(`/style-presets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.styles }),
  })
}

// ── Auto mode update ──
export function useUpdateAutoMode() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch<AutoModeConfig>("/auto-mode", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.autoMode }),
  })
}

// ── Graph link create ──
export function useCreateLink() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      contentFetch("/graph/links", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["graph"] }),
  })
}

// ── Published bulk sync ──
export function useSyncAllPublished() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: () => contentFetch("/published/sync-all", { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["published"] }),
  })
}

// ── Org / Profile (core /api/v1) ──
export function useOrg() {
  return useQuery({ queryKey: ["org"], queryFn: () => apiV1Fetch<Organisation>("/orgs/current") })
}
export function useUpdateOrg() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiV1Fetch<Organisation>("/orgs/current", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["org"] }),
  })
}
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiV1Fetch<UserProfile>("/auth/me") })
}
export function useUpdateMe() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiV1Fetch<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["me"] }),
  })
}
export function useMyActivity() {
  return useQuery({ queryKey: ["my-activity"], queryFn: () => contentFetch<MyActivity>("/my-activity") })
}

// ── AI usage / cost transparency ──
export function useAiUsage() {
  return useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => contentFetch<import("@/lib/api/types").AiUsageSummary>("/ai-usage"),
  })
}

// ── Integrations (org-level API keys) ──
export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiV1Fetch<IntegrationStatus[]>("/orgs/current/integrations"),
  })
}
export function useUpdateIntegrations() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (values: Record<string, string | null>) =>
      apiV1Fetch<IntegrationStatus[]>("/orgs/current/integrations", {
        method: "PUT",
        body: JSON.stringify({ values }),
      }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["integrations"] }),
  })
}

// ── Org users (Team & Access) ──
export function useOrgUsers() {
  return useQuery({ queryKey: ["org-users"], queryFn: () => apiV1Fetch<OrgUser[]>("/orgs/current/users") })
}
export function useUpdateOrgUser() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: string; is_active?: boolean } }) =>
      apiV1Fetch<OrgUser>(`/orgs/current/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => c.invalidateQueries({ queryKey: ["org-users"] }),
  })
}

// ── Notifications ──
export function useTestNotification() {
  return useMutation({
    mutationFn: () => apiV1Fetch<{ ok: boolean }>("/orgs/current/notifications/test", { method: "POST" }),
  })
}

// ── Tags / Styles / Auto mode ──
export function useTags() {
  return useQuery({ queryKey: qk.tags, queryFn: () => contentFetch<TagConfig[]>("/tags") })
}
export function useDeleteTag() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.tags }),
  })
}
export function useStylePresets() {
  return useQuery({ queryKey: qk.styles, queryFn: () => contentFetch<StylePreset[]>("/style-presets") })
}
export function useDuplicateStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/style-presets/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.styles }),
  })
}
export function useDeleteStyle() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contentFetch(`/style-presets/${id}`, { method: "DELETE" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.styles }),
  })
}
export function useAutoMode() {
  return useQuery({ queryKey: qk.autoMode, queryFn: () => contentFetch<AutoModeConfig>("/auto-mode") })
}
export function useAutoModeActivity() {
  return useQuery({
    queryKey: [...qk.autoMode, "activity"],
    queryFn: () => contentFetch<AutoModeActivity>("/auto-mode/activity"),
  })
}
export function useToggleAutoMode() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (enable: boolean) =>
      contentFetch(`/auto-mode/${enable ? "enable" : "disable"}`, { method: "POST" }),
    onSuccess: () => c.invalidateQueries({ queryKey: qk.autoMode }),
  })
}

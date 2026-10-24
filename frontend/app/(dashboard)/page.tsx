"use client"

import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  Eye,
  FileText,
  Info,
  ListChecks,
  Network,
  Pencil,
  PlayCircle,
  Plus,
  Rss,
  Send,
  Share2,
  Upload,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Badge, statusTone } from "@/components/ui/badge"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { PlatformIcon } from "@/components/ui/platform-icon"
import {
  DRAFT_PIPELINE,
  ProgressDots,
  type PipelineStep,
  type StepState,
} from "@/components/ui/progress-steps"
import {
  useAutoMode,
  useClusters,
  useDashboardStats,
  useDismissCluster,
  useDrafts,
  useParseAll,
  usePublished,
  useRefreshClusters,
  useSources,
} from "@/lib/api/hooks"
import { toast } from "sonner"
import type { ContentSource, Draft, PublishedPost, TopicCluster } from "@/lib/api/types"
import { cn, hoursAgo, timeAgo } from "@/lib/utils"

const PIPELINE_ORDER = DRAFT_PIPELINE.map((s) => s.key)
const IN_PROGRESS = new Set([
  "queued",
  "processing",
  "synthesis",
  "styling",
  "formatting",
  "translation",
  "fact_check",
  "image",
])

type ActivityRow = {
  id: string
  at: string
  text: string
  meta?: string
  ok: boolean
}

function pipelineSteps(status: string): PipelineStep[] {
  const s = (status ?? "").toLowerCase()
  if (s === "ready" || s === "done") return DRAFT_PIPELINE.map((d) => ({ ...d, state: "done" as StepState }))
  if (s === "failed") return DRAFT_PIPELINE.map((d) => ({ ...d, state: "failed" as StepState }))
  const idx = PIPELINE_ORDER.indexOf(s)
  return DRAFT_PIPELINE.map((d, i) => ({
    ...d,
    state: idx < 0 ? "pending" : i < idx ? "done" : i === idx ? "active" : "pending",
  }))
}

function buildActivity(drafts: Draft[], published: PublishedPost[], clusters: TopicCluster[]): ActivityRow[] {
  const items: ActivityRow[] = []
  for (const d of drafts) {
    items.push({
      id: `d-${d.id}`,
      at: d.created_at,
      text: d.pipeline_status?.toLowerCase() === "failed" ? "Draft generation failed" : "Draft generated",
      meta: d.topic,
      ok: d.pipeline_status?.toLowerCase() !== "failed",
    })
  }
  for (const p of published) {
    items.push({
      id: `p-${p.id}`,
      at: p.published_at,
      text: `Published to ${p.platform}`,
      meta: p.published_text?.slice(0, 60),
      ok: true,
    })
  }
  for (const c of clusters.slice(0, 3)) {
    items.push({ id: `c-${c.id}`, at: "", text: "Topic cluster active", meta: c.title, ok: true })
  }
  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6)
}

function clusterScore(c: TopicCluster): number {
  const posts = Math.min(12, c.post_count ?? 0)
  const div = c.source_diversity ?? 0
  const fresh = c.freshness_hours == null ? 0 : Math.max(0, 14 - Math.min(14, c.freshness_hours))
  return Math.min(98, Math.round(40 + div * 7 + fresh * 1.5 + posts))
}

function compactNum(v: string | number): string {
  if (typeof v !== "number") return v
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`
  return String(v)
}

function sourceHealth(src: ContentSource): { tone: "success" | "warning" | "danger"; label: string } {
  if (src.error_count > 0 && src.last_error) return { tone: "danger", label: "Error" }
  if (src.error_count > 0) return { tone: "warning", label: "Warning" }
  return { tone: "success", label: "OK" }
}

export default function DashboardPage() {
  const router = useRouter()
  const stats = useDashboardStats()
  const clusters = useClusters()
  const drafts = useDrafts()
  const autoMode = useAutoMode()
  const sources = useSources()
  const published = usePublished()
  const dismiss = useDismissCluster()

  const onDismiss = (id: string) =>
    dismiss.mutate(id, {
      onSuccess: () => toast.success("Cluster dismissed"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to dismiss"),
    })

  const s = stats.data ?? {}
  const value = (key: string, fallback: number = 0): string | number =>
    typeof s[key] === "number" ? (s[key] as number) : stats.isLoading ? "—" : fallback
  const liveClusters = (clusters.data ?? []).filter((c) => c.status?.toLowerCase() === "active" || !c.status)
  const recommendations = [...liveClusters]
    .sort((a, b) => clusterScore(b) - clusterScore(a))
    .slice(0, 3)
  const pipeline = (drafts.data ?? []).filter((d) => IN_PROGRESS.has(d.pipeline_status?.toLowerCase())).slice(0, 3)
  const sourceRows = (sources.data ?? []).slice(0, 5)
  const activityRows = buildActivity(drafts.data ?? [], published.data ?? [], clusters.data ?? [])
  const platforms = autoMode.data?.publish_to ?? []

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-[#111111]">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your content engine"
        aiCost={typeof s.ai_cost_today === "number" ? (s.ai_cost_today as number) : undefined}
      />

      <section className="grid grid-cols-2 overflow-hidden rounded-[3px] border border-[#d7d2ca] bg-white sm:grid-cols-3 xl:grid-cols-5">
        <Metric icon={FileText} label="New Posts (24h)" value={value("new_posts_24h")} caption="last 24 hours" />
        <Metric icon={Network} label="Active Clusters" value={clusters.data ? liveClusters.length : value("active_clusters")} caption="currently active" />
        <Metric icon={Pencil} label="Drafts Ready" value={value("drafts_ready")} caption="awaiting review" />
        <Metric icon={BarChart3} label="Published This Week" value={value("published_this_week")} caption="this week" />
        <Metric icon={Eye} label="Total Views (Week)" value={compactNum(value("total_views_week"))} caption="this week" last />
      </section>

      <div className="mt-[18px] grid grid-cols-1 gap-[16px] xl:grid-cols-[minmax(0,1fr)_theme(width.rpanel)]">
        {/* LEFT column: recommendations + bottom trio */}
        <div className="flex flex-col gap-[16px]">
          <section className="rounded-[3px] border border-[#d7d2ca] bg-white px-5 pb-5 pt-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold uppercase tracking-[0.08em]">AI Recommendations</h2>
                <Info className="h-4 w-4 text-zinc-400" />
              </div>
              <button onClick={() => router.push("/content/clusters")} className="flex items-center gap-2 text-[13px] font-semibold">
                View all clusters <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {clusters.isLoading ? (
              <TableSkeleton rows={3} />
            ) : clusters.isError && !clusters.data ? (
              <ErrorState error={clusters.error} />
            ) : recommendations.length === 0 ? (
              <EmptyState title="No recommendations yet" hint="Parse your sources, then refresh clusters to get topic suggestions." />
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((cluster) => (
                <RecommendationCard
                  key={cluster.id}
                  cluster={cluster}
                  onCreate={() => router.push(`/content/drafts/new?cluster=${cluster.id}`)}
                  onSources={() => router.push("/content/sources")}
                  onDismiss={() => onDismiss(cluster.id)}
                />
              ))}
            </div>
            )}
          </section>

          <div className="grid flex-1 grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-[1fr_minmax(0,1.08fr)_1fr]">
            <SourcesHealth rows={sourceRows} loading={sources.isLoading} error={sources.isError && !sources.data ? sources.error : undefined} />
            <PipelinePanel rows={pipeline} loading={drafts.isLoading} error={drafts.isError && !drafts.data ? drafts.error : undefined} />
            <RecentActivity rows={activityRows} loading={drafts.isLoading || published.isLoading} />
          </div>
        </div>

        {/* RIGHT column: auto mode + quick actions */}
        <div className="flex flex-col gap-[16px]">
          <AutoModePanel
            recommendations={recommendations.slice(0, 2)}
            platforms={platforms}
            enabled={autoMode.data?.is_enabled ?? false}
            publishTimes={autoMode.data?.publish_times}
          />
          <div className="flex-1">
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, caption, last }: {
  icon: LucideIcon
  label: string
  value: string | number
  caption: string
  last?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-4 px-5 py-5", !last && "border-r border-[#d7d2ca]")}>
      <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-[5px] bg-[#d7c1ff] text-black">
        <Icon className="h-[22px] w-[22px] stroke-[1.8]" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.07em]">{label}</div>
        <div className="mt-1.5 text-[28px] font-semibold leading-none tracking-[0.01em]">{value}</div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
          <span className="text-black/70">{caption}</span>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ cluster, onCreate, onSources, onDismiss }: {
  cluster: TopicCluster
  onCreate: () => void
  onSources: () => void
  onDismiss: () => void
}) {
  const priority = (cluster.priority ?? "low").toLowerCase()
  return (
    <article className="flex min-h-[318px] flex-col rounded-[3px] border border-[#d7d2ca] bg-white p-4">
      <div className="flex items-center justify-between">
        <Badge tone={statusTone(priority)}>{priority} priority</Badge>
        <span className="text-[12px] font-medium text-black/55">{hoursAgo(cluster.freshness_hours)}</span>
      </div>
      <h3 className="mt-3.5 text-[18px] font-semibold leading-[1.2]">{cluster.title}</h3>
      <p className="mt-2 text-[13px] font-medium leading-[1.45] text-black/70">{cluster.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(cluster.tags ?? []).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-[2px] bg-[#d7c1ff] px-2 py-0.5 text-[12px] font-semibold">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-auto" />
      <div className="mt-4 grid grid-cols-2 border-t border-[#eeeae4] pt-3 text-[11px] font-bold uppercase tracking-wide text-black/55">
        <div><span className="block text-[19px] leading-none text-black">{cluster.source_diversity}</span> Sources</div>
        <div className="text-right"><span className="block text-[19px] leading-none text-black">{Math.round(cluster.freshness_hours ?? 0)}</span> Hours Ago</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onCreate} className="h-[34px] flex-1 basis-[96px] whitespace-nowrap rounded-[3px] bg-[#d7c1ff] px-3 text-[12px] font-bold transition hover:brightness-95">Create Draft</button>
        <button onClick={onSources} className="h-[34px] flex-1 basis-[96px] whitespace-nowrap rounded-[3px] border border-[#d7d2ca] px-3 text-[12px] font-bold transition hover:bg-canvas">View Sources</button>
        <button onClick={onDismiss} className="h-[34px] flex-1 basis-[72px] whitespace-nowrap rounded-[3px] bg-[#ffd7dc] px-3 text-[12px] font-bold transition hover:brightness-95">Dismiss</button>
      </div>
    </article>
  )
}

function Panel({ title, action, footer, onFooter, children, className }: {
  title: string
  action?: React.ReactNode
  footer?: React.ReactNode
  onFooter?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex h-full flex-col overflow-hidden rounded-[3px] border border-[#d7d2ca] bg-white", className)}>
      <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#d7d2ca] px-[18px]">
        <h2 className="text-[17px] font-semibold uppercase tracking-[0.06em]">{title}</h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
      {footer ? (
        <button
          onClick={onFooter}
          className="flex h-[44px] shrink-0 cursor-pointer items-center justify-between border-t border-[#d7d2ca] px-[18px] text-[14px] font-medium transition-colors hover:bg-[#f8f7f5]"
        >
          {footer} <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </section>
  )
}

function nextPublishSlots(times: string[] | undefined): { label: string; time: string }[] {
  const list = (times ?? []).filter((t) => /^\d{1,2}:\d{2}$/.test(t.trim()))
  if (!list.length) return []
  const now = new Date()
  const slots: { at: Date; time: string }[] = []
  for (let day = 0; day < 3 && slots.length < 4; day++) {
    for (const t of list) {
      const [hh, mm] = t.trim().split(":").map(Number)
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day, hh, mm))
      if (d > now) slots.push({ at: d, time: t.trim() })
    }
  }
  return slots
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 2)
    .map((s) => ({
      label: s.at.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }).replace(",", ""),
      time: s.time,
    }))
}

function AutoModePanel({ recommendations, platforms, enabled, publishTimes }: {
  recommendations: TopicCluster[]
  platforms: string[]
  enabled: boolean
  publishTimes?: string[]
}) {
  const router = useRouter()
  const slots = nextPublishSlots(publishTimes)
  return (
    <Panel
      title="Auto Mode"
      footer="View Auto Mode Settings"
      onFooter={() => router.push("/content/auto-mode")}
      action={
        <span className={cn("rounded-[2px] px-4 py-2 text-[11px] font-semibold uppercase", enabled ? "bg-[#ccead2]" : "bg-[#e9e6e0] text-black/60")}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
      }
    >
      <div className="px-[18px] py-3.5">
        <div className="border-b border-[#d7d2ca] pb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55">Next Publish Times (UTC)</div>
          <div className="mt-2 flex items-baseline gap-4 text-[14px] font-medium whitespace-nowrap">
            {slots.length ? (
              slots.map((s) => (
                <span key={`${s.label}-${s.time}`}>{s.label} <span className="font-semibold">{s.time}</span></span>
              ))
            ) : (
              <span className="text-black/55">No publish times configured</span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55">Top Recommendations for Auto Mode</div>
          <div className="space-y-2">
            {recommendations.length === 0 && <PanelNote>No recommended topics yet.</PanelNote>}
            {recommendations.map((cluster, index) => (
              <div key={cluster.id} className="grid grid-cols-[40px_minmax(0,1fr)_48px] overflow-hidden rounded-[2px] border border-[#e4dfd8]">
                <div className={cn("grid place-items-center text-[22px] font-semibold", index === 0 ? "bg-[#d7c1ff]" : "bg-[#e9e6e0]")}>{index + 1}</div>
                <div className="min-w-0 px-3 py-2">
                  <div className="truncate text-[13px] font-semibold">{cluster.title}</div>
                  <div className="mt-0.5 text-[12px] text-black/65">{cluster.source_diversity} sources · {hoursAgo(cluster.freshness_hours)}</div>
                  <div className="mt-1.5 flex gap-1">
                    {(cluster.tags ?? []).slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-[2px] bg-[#d7c1ff] px-1.5 py-0.5 text-[11px] font-semibold">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[20px] font-semibold leading-none">{clusterScore(cluster)}</div>
                  <div className="mt-0.5 text-[10px] uppercase text-black/50">score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55">Target Platforms</div>
          <div className="flex items-center gap-3">
            {platforms.length === 0 && <span className="text-[13px] text-black/55">None configured</span>}
            {platforms.map((platform) => (
              <span key={platform} className="grid h-9 w-9 place-items-center rounded-full bg-white">
                <PlatformIcon type={platform} className="h-7 w-7" />
              </span>
            ))}
            <button
              onClick={() => router.push("/content/auto-mode")}
              title="Add platform"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-[3px] border border-dashed border-zinc-400 text-xl text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-600"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function QuickActions() {
  const router = useRouter()
  const parseAll = useParseAll()
  const refreshClusters = useRefreshClusters()

  const runParseAll = () =>
    parseAll.mutate(undefined, {
      onSuccess: () => {
        toast.success("Parsing all sources")
        router.push("/content/sources")
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to start parsing"),
    })
  const runRefreshClusters = () =>
    refreshClusters.mutate(undefined, {
      onSuccess: () => {
        toast.success("Clustering queued")
        router.push("/content/clusters")
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to refresh clusters"),
    })

  const actions = [
    { icon: Plus, label: "Create New Draft", onClick: () => router.push("/content/drafts/new"), bg: "bg-[#d7c1ff]" },
    { icon: Upload, label: "Parse All Sources", onClick: runParseAll, bg: "bg-[#ff9faf]" },
    { icon: Boxes, label: "Refresh Clusters", onClick: runRefreshClusters, bg: "bg-[#d7c1ff]" },
    { icon: Share2, label: "Open Knowledge Graph", onClick: () => router.push("/content/graph"), bg: "bg-[#d7c1ff]" },
    { icon: CalendarDays, label: "Open Calendar", onClick: () => router.push("/content/calendar"), bg: "bg-[#ff9faf]" },
  ]
  return (
    <Panel title="Quick Actions">
      <div className="flex h-full flex-col justify-between gap-2 px-[14px] py-[14px]">
        {actions.map(({ icon: Icon, label, onClick, bg }) => (
          <button key={label} onClick={onClick} className="grid h-[45px] w-full shrink-0 grid-cols-[62px_1fr_28px] items-center overflow-hidden rounded-[2px] border border-[#d7d2ca] text-left transition-colors hover:bg-[#f8f7f5]">
            <span className={cn("grid h-full place-items-center", bg)}><Icon className="h-5 w-5" /></span>
            <span className="px-4 text-[14px] font-medium">{label}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ))}
      </div>
    </Panel>
  )
}

function PanelNote({ children }: { children: React.ReactNode }) {
  return <div className="px-[18px] py-6 text-center text-[13px] text-black/55">{children}</div>
}

function SourcesHealth({ rows, loading, error }: { rows: ContentSource[]; loading?: boolean; error?: unknown }) {
  const router = useRouter()
  return (
    <Panel title="Sources Health" footer="Manage Sources" onFooter={() => router.push("/content/sources")}>
      {loading ? <div className="p-[18px]"><TableSkeleton rows={4} /></div> : error ? <PanelNote>{error instanceof Error ? error.message : "Failed to load sources"}</PanelNote> : rows.length === 0 ? <PanelNote>No sources yet — add one to start collecting posts.</PanelNote> : null}
      <div className="divide-y divide-[#eeeae4] px-[18px]">
        {rows.map((source) => {
          const health = sourceHealth(source)
          return (
            <div key={source.id} className="grid h-[58px] grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-x-3">
              <PlatformBadge type={source.source_type} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{source.display_name}</div>
                <div className="truncate text-[11px] font-medium capitalize text-black/55">{source.source_type} Channel</div>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-[12px]">
                <span className={cn("h-2.5 w-2.5 rounded-full", health.tone === "success" && "bg-emerald-500", health.tone === "warning" && "bg-orange-400", health.tone === "danger" && "bg-red-500")} />
                {health.label}
              </div>
              <div className="whitespace-nowrap text-right text-[11px] text-black/55">{timeAgo(source.last_parsed_at)}</div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function PipelinePanel({ rows, loading, error }: { rows: Draft[]; loading?: boolean; error?: unknown }) {
  const router = useRouter()
  return (
    <Panel title="Content Pipeline" footer="View All Drafts" onFooter={() => router.push("/content/drafts")} action={<Badge tone="info" className="rounded-[2px] px-3 py-1 text-[11px] font-semibold uppercase">In&nbsp;Progress:&nbsp;{rows.length}</Badge>}>
      {loading ? <div className="p-[18px]"><TableSkeleton rows={3} /></div> : error ? <PanelNote>{error instanceof Error ? error.message : "Failed to load drafts"}</PanelNote> : rows.length === 0 ? <PanelNote>No drafts in progress.</PanelNote> : null}
      {rows.length > 0 && (
      <div className="overflow-x-auto px-[18px] py-[14px]">
        <div className="min-w-[300px]">
          <div className="grid grid-cols-[minmax(0,1fr)_126px_68px_44px] items-center gap-x-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.05em] text-black/55">
            <span>Draft</span><span className="text-center">Progress</span><span>Current Step</span><span className="text-right">Updated</span>
          </div>
          <div className="divide-y divide-[#eeeae4]">
            {rows.map((draft) => (
              <div key={draft.id} className="grid min-h-[62px] grid-cols-[minmax(0,1fr)_126px_68px_44px] items-center gap-x-2 py-2">
                <div className="min-w-0 pr-1">
                  <div className="truncate text-[13px] font-semibold">{draft.topic}</div>
                  <div className="mt-0.5 truncate text-[11px] text-black/45">ID: {draft.id?.slice(0, 8)}</div>
                </div>
                <div className="flex justify-center"><ProgressDots steps={pipelineSteps(draft.pipeline_status)} /></div>
                <div className="truncate text-[12px] font-medium">{currentStepLabel(draft.pipeline_status)}</div>
                <div className="text-right text-[11px] text-black/55">{timeAgo(draft.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </Panel>
  )
}

function RecentActivity({ rows, loading }: { rows: ActivityRow[]; loading?: boolean }) {
  const router = useRouter()
  return (
    <Panel title="Recent Activity" footer="View All Activity" onFooter={() => router.push("/content/drafts")}>
      {loading ? <div className="p-[18px]"><TableSkeleton rows={4} /></div> : rows.length === 0 ? <PanelNote>No recent activity.</PanelNote> : null}
      <div className="divide-y divide-[#eeeae4] px-[18px]">
        {rows.slice(0, 6).map((row) => {
          const Icon = ListChecks
          const at = new Date(row.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
          return (
            <div key={row.id} className="grid min-h-[54px] grid-cols-[40px_28px_minmax(0,1fr)_10px] items-center gap-2 py-2">
              <span className="text-[12px] tabular-nums text-black/55">{at}</span>
              <span className={cn("grid h-7 w-7 place-items-center rounded-[2px]", activityTone("violet"))}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{row.text}</div>
                <div className="truncate text-[10px] text-black/50">{row.meta}</div>
              </div>
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", row.ok ? "bg-emerald-500" : "bg-red-500")} />
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function PlatformBadge({ type }: { type: string }) {
  if (type?.toLowerCase() === "rss") return <Rss className="h-7 w-7 text-orange-500" />
  if (type?.toLowerCase() === "youtube") return <PlayCircle className="h-7 w-7 text-red-500" />
  return <span className="grid h-7 w-7 place-items-center rounded-full bg-sky-500 text-white"><Send className="h-4 w-4" /></span>
}

function currentStepLabel(status: string): string {
  const s = status?.toLowerCase()
  if (s === "ready" || s === "done") return "Ready"
  return DRAFT_PIPELINE.find((step) => step.key === s)?.label ?? "Queued"
}

function activityTone(tone: string) {
  switch (tone) {
    case "pink": return "bg-[#ff9faf]"
    case "red": return "bg-[#ff6b6b]"
    case "sky": return "bg-[#bfe9ff]"
    default: return "bg-[#d7c1ff]"
  }
}

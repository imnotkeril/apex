"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Eye,
  FileText,
  Globe,
  Heart,
  Maximize2,
  MessageCircle,
  Minus,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Share2,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Select, SearchInput } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { PlatformIcon } from "@/components/ui/platform-icon"
import { cn } from "@/lib/utils"
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { useClusters, useGraph } from "@/lib/api/hooks"
import type { GraphData } from "@/lib/api/types"

const VIEW_TABS = [
  { key: "all", label: "All" },
  { key: "raw", label: "Raw Posts" },
  { key: "published", label: "Published Posts" },
]

type GType = "raw" | "published"
type GNode = {
  id: string
  type: GType
  title: string
  source: string
  date: string
  x: number // 0..100
  y: number // 0..100
  central?: boolean
  tags?: string[]
  summary?: string
  metrics?: Record<string, number>
  ts?: number
}
type GEdge = { from: string; to: string; link: LinkType; conf?: number }
type LinkType = "same_topic" | "continuation" | "contradicts" | "supplements" | "source_of" | "auto_semantic"

const linkStyle: Record<LinkType, { stroke: string; dash?: string; label: string }> = {
  same_topic: { stroke: "#8d68ff", label: "Same Topic" },
  continuation: { stroke: "#4b3fb0", label: "Continuation" },
  contradicts: { stroke: "#ef4444", dash: "4 3", label: "Contradicts" },
  supplements: { stroke: "#10b981", dash: "4 3", label: "Supplements" },
  source_of: { stroke: "#f59e0b", label: "Source Of" },
  auto_semantic: { stroke: "#9ca3af", dash: "2 3", label: "Auto Semantic" },
}

type Conn = { title: string; source: string; type: GType; rel: LinkType; conf: number }
const relTone: Record<LinkType, BadgeTone> = {
  same_topic: "medium",
  continuation: "info",
  supplements: "success",
  source_of: "warning",
  contradicts: "danger",
  auto_semantic: "neutral",
}

const LINK_TYPES: LinkType[] = ["same_topic", "continuation", "contradicts", "supplements", "source_of", "auto_semantic"]

function fmtDate(d?: string | null) {
  if (!d) return ""
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ""
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}

function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(v)
}

// Map API graph payload → positioned nodes. Highest-degree node sits at the
// centre; the rest are laid out on deterministic rings around it.
function mapGraph(data?: GraphData | null): { nodes: GNode[]; edges: GEdge[] } {
  if (!data?.nodes?.length) return { nodes: [], edges: [] }
  const degree = new Map<string, number>()
  for (const e of data.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  const sorted = [...data.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
  const central = sorted[0]
  const others = sorted.slice(1)
  const toG = (n: GraphData["nodes"][number], x: number, y: number, isCentral = false): GNode => ({
    id: n.id,
    type: n.type,
    title: n.title,
    source: n.source ?? (n.type === "published" ? "Published Post" : "Raw Post"),
    date: fmtDate(n.date),
    x,
    y,
    central: isCentral,
    tags: n.tags ?? undefined,
    summary: n.summary ?? undefined,
    metrics: n.metrics ?? undefined,
    ts: n.date ? new Date(n.date).getTime() : undefined,
  })
  const nodes: GNode[] = [toG(central, 47, 52, others.length > 0)]
  others.forEach((n, i) => {
    const angle = (i / Math.max(others.length, 1)) * 2 * Math.PI - Math.PI / 2
    const r = 24 + (i % 3) * 9
    const x = Math.min(90, Math.max(10, 47 + r * 1.35 * Math.cos(angle)))
    const y = Math.min(86, Math.max(12, 52 + r * Math.sin(angle)))
    nodes.push(toG(n, x, y))
  })
  const ids = new Set(nodes.map((n) => n.id))
  const edges: GEdge[] = data.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({
      from: e.from,
      to: e.to,
      link: (LINK_TYPES as string[]).includes(e.link_type) ? (e.link_type as LinkType) : "auto_semantic",
      conf: e.confidence,
    }))
  return { nodes, edges }
}

export default function GraphPage() {
  const router = useRouter()
  const [view, setView] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [query, setQuery] = useState("")
  const [tagFilter, setTagFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { data, refetch, dataUpdatedAt, isLoading, isError, error } = useGraph()
  const clustersQ = useClusters()
  const live = useMemo(() => mapGraph(data), [data])
  const allNodes = live.nodes
  const allEdges = live.edges

  const tagOptions = useMemo(
    () => Array.from(new Set(allNodes.flatMap((n) => n.tags ?? []))).sort(),
    [allNodes]
  )
  const sourceOptions = useMemo(
    () => Array.from(new Set(allNodes.map((n) => n.source).filter(Boolean))).sort(),
    [allNodes]
  )

  const nodes = allNodes.filter((n) => {
    if (view !== "all" && n.type !== view) return false
    if (query && !n.title.toLowerCase().includes(query.toLowerCase())) return false
    if (tagFilter !== "all" && !(n.tags ?? []).includes(tagFilter)) return false
    if (sourceFilter !== "all" && n.source !== sourceFilter) return false
    if (dateFrom && n.ts != null && n.ts < new Date(dateFrom).getTime()) return false
    if (dateTo && n.ts != null && n.ts > new Date(`${dateTo}T23:59:59Z`).getTime()) return false
    return true
  })
  const selected = allNodes.find((n) => n.id === selectedId) ?? null
  const nodeById = (id: string) => allNodes.find((n) => n.id === id)

  // Connections for the selected node: computed from live edges.
  const selectedConns: Conn[] = useMemo(() => {
    if (!selected) return []
    return allEdges
      .filter((e) => e.from === selected.id || e.to === selected.id)
      .map((e) => {
        const other = nodeById(e.from === selected.id ? e.to : e.from)
        if (!other) return null
        return { title: other.title, source: other.source, type: other.type, rel: e.link, conf: e.conf ?? 0 }
      })
      .filter((c): c is Conn => c !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, allEdges, allNodes])

  const stats = data?.stats
  const autoEdges = data?.edges?.filter((e) => e.is_auto).length ?? 0
  const density =
    stats && stats.nodes > 1 ? (stats.edges / ((stats.nodes * (stats.nodes - 1)) / 2)).toFixed(3) : null
  const clusterCount = clustersQ.data?.length
  const updatedAgo = (() => {
    if (!dataUpdatedAt) return "—"
    const mins = Math.round((Date.now() - dataUpdatedAt) / 60000)
    return mins < 1 ? "just now" : `${mins} minute${mins === 1 ? "" : "s"} ago`
  })()

  const openNode = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDrawerOpen(false)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }
  const zoomBy = (d: number) => setZoom((z) => Math.min(1.6, Math.max(0.6, +(z + d).toFixed(2))))

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Knowledge Graph" subtitle="Explore connections between raw content and published posts" />

      {/* Toolbar */}
      <Card className="mb-[16px] flex flex-wrap items-end gap-x-5 gap-y-3 p-3">
        <ToolField label="View">
          <Tabs items={VIEW_TABS} active={view} onChange={setView} />
        </ToolField>
        <ToolField label="Filter by Tags">
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-[150px]">
            <option value="all">All Tags</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </ToolField>
        <ToolField label="Date Range">
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] px-2.5" aria-label="From" />
            <span className="text-ink/40">→</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] px-2.5" aria-label="To" />
          </div>
        </ToolField>
        <ToolField label="Sources">
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-[150px]">
            <option value="all">All Sources</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </ToolField>
        <div className="ml-auto flex items-end gap-2">
          <div className="w-[170px]">
            <SearchInput placeholder="Search nodes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className={cn("grid grid-cols-1 items-start gap-[16px]", selected && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        {/* GRAPH CARD — outer card holds legend, nested graph card, and stat cards */}
        <Card className="flex min-w-0 flex-col gap-[16px] p-4">
          {/* legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink/60">
            <span className="font-semibold text-ink/70">Legend:</span>
            <LegendDot className="bg-sky-500" label="Raw Post" />
            <LegendDot className="bg-lavender-text" label="Published Post" />
            {(["same_topic", "continuation", "contradicts", "supplements", "source_of", "auto_semantic"] as LinkType[]).map((k) => (
              <LegendLine key={k} type={k} />
            ))}
          </div>

          {/* graph canvas — nested card */}
          <Card className="relative h-[560px] overflow-hidden bg-canvas/40 p-0 xl:h-[640px]">
            {/* zoom controls */}
            <div className="absolute left-3 top-3 z-20 flex flex-col overflow-hidden rounded-card border border-line bg-white">
              <ZoomBtn label="Zoom in" onClick={() => zoomBy(0.2)}><Plus className="h-4 w-4" /></ZoomBtn>
              <ZoomBtn label="Zoom out" onClick={() => zoomBy(-0.2)}><Minus className="h-4 w-4" /></ZoomBtn>
              <span className="h-px bg-line" />
              <ZoomBtn label="Fit to screen" onClick={() => setZoom(1)}><Maximize2 className="h-4 w-4" /></ZoomBtn>
            </div>

            {(isLoading || (isError && !data) || allNodes.length === 0) && (
              <div className="absolute inset-0 z-10 grid place-items-center p-6">
                <div className="w-full max-w-md">
                  {isLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : isError && !data ? (
                    <ErrorState error={error} />
                  ) : (
                    <EmptyState title="No graph data yet" hint="Parse sources and publish posts to see connections between them." />
                  )}
                </div>
              </div>
            )}

            {/* graph layer (zoomable) */}
            <div className="absolute inset-0 origin-center transition-transform duration-150" style={{ transform: `scale(${zoom})` }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {allEdges.map((e, i) => {
                  const a = nodeById(e.from)
                  const b = nodeById(e.to)
                  if (!a || !b) return null
                  if (view !== "all" && (a.type !== view || b.type !== view)) return null
                  const s = linkStyle[e.link]
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={s.stroke}
                      strokeWidth={1.4}
                      strokeDasharray={s.dash}
                      vectorEffect="non-scaling-stroke"
                      opacity={0.8}
                    />
                  )
                })}
              </svg>

              {nodes.map((n) => (
                <NodeCard key={n.id} node={n} selected={n.id === selectedId} onClick={() => openNode(n.id)} />
              ))}
            </div>
          </Card>

          {/* stats */}
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Nodes"
              value={stats ? String(stats.nodes) : "0"}
              sub={stats ? `raw ${stats.raw} · published ${stats.published}` : "no data"}
            />
            <StatCard
              label="Edges"
              value={stats ? String(stats.edges) : "0"}
              sub={stats ? `manual ${stats.edges - autoEdges} · auto ${autoEdges}` : "no data"}
            />
            <StatCard
              label="Density"
              value={density ?? "—"}
              sub={density ? (Number(density) < 0.02 ? "low" : Number(density) < 0.08 ? "medium" : "high") : "no data"}
            />
            <StatCard label="Clusters" value={String(clusterCount ?? 0)} sub="topics detected" />
            <Card className="flex items-center justify-between gap-2 p-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">Last Updated</div>
                <div className="mt-1 text-[13px] font-medium">{updatedAgo}</div>
              </div>
              <button
                onClick={() => refetch()}
                aria-label="Refresh graph"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-card text-ink/55 hover:bg-line-soft hover:text-ink"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </Card>
          </div>
        </Card>

        {/* NODE DETAILS — inline xl+ (only when a node is selected) */}
        {selected && (
          <aside className="hidden xl:block">
            <NodeDetails node={selected} conns={selectedConns} onClose={() => setSelectedId(null)} router={router} />
          </aside>
        )}
      </div>

      {/* NODE DETAILS — drawer below xl */}
      {drawerOpen && selected && (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <NodeDetails node={selected} conns={selectedConns} onClose={() => setDrawerOpen(false)} router={router} />
          </div>
        </div>
      )}
    </div>
  )
}

function ToolField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/60">{label}</div>
      {children}
    </div>
  )
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 cursor-pointer place-items-center text-ink/65 transition-colors hover:bg-line-soft hover:text-ink"
    >
      {children}
    </button>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} /> {label}
    </span>
  )
}

function LegendLine({ type }: { type: LinkType }) {
  const s = linkStyle[type]
  return (
    <span className="flex items-center gap-1.5">
      <svg width="22" height="6" className="shrink-0">
        <line x1="0" y1="3" x2="22" y2="3" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} />
      </svg>
      {s.label}
    </span>
  )
}

function NodeCard({ node: n, selected, onClick }: { node: GNode; selected: boolean; onClick: () => void }) {
  const Icon = n.type === "published" ? Globe : FileText
  return (
    <button
      onClick={onClick}
      style={{ left: `${n.x}%`, top: `${n.y}%` }}
      className="absolute z-10 flex max-w-[220px] -translate-x-1/2 -translate-y-1/2 items-start gap-2 text-left"
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full transition-shadow",
          n.central ? "h-12 w-12 bg-lavender ring-4 ring-lavender/40" : "h-8 w-8",
          !n.central && (n.type === "published" ? "bg-lavender" : "bg-sky-100"),
          selected && !n.central && "ring-2 ring-lavender-text"
        )}
      >
        <Icon className={cn(n.central ? "h-6 w-6" : "h-4 w-4", n.type === "published" ? "text-ink" : "text-sky-600")} />
      </span>
      <span
        className={cn(
          "rounded-card border bg-white px-2.5 py-1.5",
          selected ? "border-lavender-text ring-1 ring-lavender-text" : "border-line"
        )}
      >
        <span className="block text-[11px] font-semibold leading-tight">{n.title}</span>
        <span className="mt-0.5 block text-[10px] text-ink/55">{n.source}</span>
        <span className="block text-[10px] text-ink/45">{n.date}</span>
      </span>
    </button>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] text-ink/55">{sub}</div>
    </Card>
  )
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div>
      <span className="flex items-center gap-1.5 text-ink/55">
        <Icon className="h-4 w-4" />
      </span>
      <div className="mt-1.5 text-[16px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.04em] text-ink/50">{label}</div>
    </div>
  )
}

function NodeDetails({
  node: n,
  conns,
  onClose,
  router,
}: {
  node: GNode
  conns: Conn[]
  onClose: () => void
  router: ReturnType<typeof useRouter>
}) {
  const isPub = n.type === "published"
  const liveTags = n.tags?.length ? n.tags : null
  const platform = isPub && n.source && !n.source.includes(" ") ? n.source : "telegram"
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1)
  return (
    <Panel
      title="Node Details"
      action={
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-card text-ink/55 transition-colors hover:bg-line-soft hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      }
      bodyClassName="space-y-4 py-4"
    >
      <Badge tone={isPub ? "medium" : "new"}>{isPub ? "Published Post" : "Raw Post"}</Badge>
      <h3 className="text-[17px] font-semibold leading-snug">{n.title}</h3>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <PlatformIcon type={platform} className="h-4 w-4" /> {platformLabel} Post
        </span>
        <span className="text-[12px] text-ink/55">Published {n.date}</span>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Tags</div>
        <div className="flex flex-wrap gap-1.5">
          {(liveTags ? liveTags.slice(0, 5) : ["macro", "fed", "rates", "inflation", "monetary-policy"]).map((t) => (
            <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">{t}</span>
          ))}
          {(liveTags ? liveTags.length > 5 : true) && (
            <span className="rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink/60">
              +{liveTags ? liveTags.length - 5 : 2}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Summary</div>
        <p className="text-[13px] leading-normal text-ink/70">
          {n.summary ?? "No summary available."}
        </p>
      </div>

      {isPub && (
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Metrics</div>
          <div className="grid grid-cols-4 gap-2">
            <Metric icon={Send} label="Views" value={n.metrics ? fmtNum(n.metrics.views ?? 0) : "—"} />
            <Metric icon={Heart} label="Reactions" value={n.metrics ? fmtNum(n.metrics.reactions ?? 0) : "—"} />
            <Metric icon={Share2} label="Shares" value={n.metrics ? fmtNum(n.metrics.shares ?? 0) : "—"} />
            <Metric icon={MessageCircle} label="Comments" value={n.metrics ? fmtNum(n.metrics.comments ?? 0) : "—"} />
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Connected To ({conns.length})</div>
        <div className="space-y-2.5">
          {conns.length === 0 && <p className="text-[12px] text-ink/50">No connections yet.</p>}
          {conns.map((c) => (
            <div key={c.title} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-2">
              <span className={cn("mt-1.5 h-2 w-2 rounded-full", c.type === "published" ? "bg-lavender-text" : "bg-sky-500")} />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{c.title}</div>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] text-ink/50">({c.source})</span>
                  <Badge tone={relTone[c.rel]} className="px-1.5 py-0 text-[10px]">{linkStyle[c.rel].label}</Badge>
                </div>
              </div>
              <span className="text-[12px] font-semibold tabular-nums text-ink/70">{c.conf.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">View Actions</div>
        <div className="space-y-2">
          <Button
            className="w-full justify-start"
            onClick={() => router.push(isPub ? "/content/drafts/new" : `/content/drafts/new?posts=${n.id}`)}
          >
            <PenLine className="h-4 w-4" /> Create Draft from This
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => router.push(isPub ? "/content/published" : "/content/raw-posts")}
          >
            <Eye className="h-4 w-4" /> View Full Content
          </Button>
        </div>
      </div>
    </Panel>
  )
}

"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  BarChart3,
  Boxes,
  Clock,
  Download,
  Eye,
  FileText,
  Flag,
  PenLine,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, statusTone } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/pagination"
import { Field, Select, SearchInput, Checkbox } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { useClusters, useRefreshClusters, useDismissCluster } from "@/lib/api/hooks"
import type { TopicCluster } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUSES: { key: string; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "used", label: "Used" },
  { key: "dismissed", label: "Dismissed" },
  { key: "archived", label: "Archived" },
]
const PRIORITIES: { key: string; label: string }[] = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
]

type Src = { name: string; initials: string; posts: number; ago: string }
type ClusterRow = TopicCluster & {
  score?: number
  used_in?: string | null
  created_ago?: string
  top_sources?: Src[]
}


function toRow(c: TopicCluster): ClusterRow {
  const r = c as ClusterRow
  return {
    ...r,
    score: r.score ?? clusterScore(c),
    used_in: r.used_in ?? null,
    created_ago: r.created_ago ?? (c.freshness_hours != null ? `${Math.round(c.freshness_hours)}h ago` : "—"),
    top_sources: r.top_sources ?? [],
  }
}

function clusterScore(c: TopicCluster): number {
  const posts = Math.min(12, c.post_count ?? 0)
  const div = c.source_diversity ?? 0
  const fresh = c.freshness_hours == null ? 0 : Math.max(0, 14 - Math.min(14, c.freshness_hours))
  return Math.min(98, Math.round(40 + div * 7 + fresh * 1.5 + posts))
}

const priorityTint: Record<string, string> = {
  high: "bg-blush",
  medium: "bg-lavender",
  low: "bg-line",
}

export default function ClustersPage() {
  const { data, isLoading, isError, error } = useClusters()
  const refresh = useRefreshClusters()
  const dismiss = useDismissCluster()
  const router = useRouter()

  const clusters: ClusterRow[] = (data ?? []).map(toRow)

  const [search, setSearch] = useState("")
  const [descSearch, setDescSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(["active"]))
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set(["high", "medium"]))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [view, setView] = useState("grid")
  const [sort, setSort] = useState("priority")
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let rows = clusters
    if (statusFilter.size) rows = rows.filter((c) => statusFilter.has((c.status ?? "active").toLowerCase()))
    if (priorityFilter.size) rows = rows.filter((c) => priorityFilter.has(c.priority?.toLowerCase()))
    if (search) rows = rows.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()))
    if (descSearch) rows = rows.filter((c) => (c.description ?? "").toLowerCase().includes(descSearch.toLowerCase()))
    const sorted = [...rows]
    if (sort === "priority") sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    else if (sort === "freshness") sorted.sort((a, b) => (a.freshness_hours ?? 0) - (b.freshness_hours ?? 0))
    else if (sort === "posts") sorted.sort((a, b) => (b.post_count ?? 0) - (a.post_count ?? 0))
    return sorted
  }, [clusters, statusFilter, priorityFilter, search, descSearch, sort])

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const cl of clusters) {
      const k = (cl.status ?? "active").toLowerCase()
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [clusters])
  const priorityCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const cl of clusters) {
      const k = (cl.priority ?? "low").toLowerCase()
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [clusters])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const allPicked = pageRows.length > 0 && pageRows.every((c) => picked.has(c.id))
  const selected = clusters.find((c) => c.id === selectedId) ?? null

  const toggleSet = (setter: typeof setStatusFilter, v: string) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const togglePickAll = () =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (allPicked) pageRows.forEach((c) => next.delete(c.id))
      else pageRows.forEach((c) => next.add(c.id))
      return next
    })

  const clearAll = () => {
    setSearch("")
    setDescSearch("")
    setStatusFilter(new Set())
    setPriorityFilter(new Set())
  }
  const openCluster = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDrawerOpen(false)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }
  const createDraft = (id: string) => router.push(`/content/drafts/new?cluster=${id}`)
  const viewPosts = (id: string) => router.push(`/content/raw-posts?cluster=${id}`)
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const header = ["title", "description", "priority", "status", "posts", "sources", "freshness_hours", "tags"]
    const lines = filtered.map((c) =>
      [c.title, c.description, c.priority, c.status, c.post_count, c.source_diversity, c.freshness_hours, (c.tags ?? []).join("|")].map(esc).join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "clusters.csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} clusters`)
  }
  const dismissSelected = () => {
    const ids = Array.from(picked)
    if (!ids.length) return
    Promise.all(ids.map((id) => new Promise((res, rej) => dismiss.mutate(id, { onSuccess: res, onError: rej }))))
      .then(() => {
        toast.success(`Dismissed ${ids.length} clusters`)
        setPicked(new Set())
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
  }
  const onRefresh = () =>
    refresh.mutate(undefined, {
      onSuccess: () => toast.success("Clustering queued"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  const onDismiss = (id: string) =>
    dismiss.mutate(id, {
      onSuccess: () => {
        toast.success("Cluster dismissed")
        if (selectedId === id) setSelectedId(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Topic Clusters" subtitle="AI-discovered topics grouped by similar content" />

      {/* Toolbar */}
      <Card className="mb-[16px] flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onRefresh} disabled={refresh.isPending}>
            <RefreshCw className="h-4 w-4" /> Refresh Clusters
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-[13px] text-ink/65">
            Sort by:
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[180px]">
              <option value="priority">Priority &amp; Freshness</option>
              <option value="freshness">Freshness</option>
              <option value="posts">Post Count</option>
            </Select>
          </span>
          <Tabs
            items={[
              { key: "grid", label: "Grid" },
              { key: "list", label: "List" },
            ]}
            active={view}
            onChange={setView}
          />
        </div>
      </Card>

      <div className={cn("grid grid-cols-1 items-stretch gap-[16px] xl:grid-cols-[260px_minmax(0,1fr)]", selected && "2xl:grid-cols-[260px_minmax(0,1fr)_360px]")}>
        {/* FILTERS */}
        <aside className="h-full">
          <Panel
            className="h-full"
            title="Filters"
            action={
              <button onClick={clearAll} className="cursor-pointer text-[12px] font-semibold text-lavender-text hover:underline">
                Clear all
              </button>
            }
            bodyClassName="flex h-full flex-col gap-4 py-4"
          >
            <Field label="Search">
              <SearchInput placeholder="Search topics…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>

            <FilterGroup label="Status">
              {STATUSES.map((s) => (
                <CheckRow
                  key={s.key}
                  label={s.label}
                  count={statusCounts[s.key] ?? 0}
                  checked={statusFilter.has(s.key)}
                  onChange={() => toggleSet(setStatusFilter, s.key)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Priority">
              {PRIORITIES.map((p) => (
                <CheckRow
                  key={p.key}
                  label={p.label}
                  count={priorityCounts[p.key] ?? 0}
                  checked={priorityFilter.has(p.key)}
                  onChange={() => toggleSet(setPriorityFilter, p.key)}
                />
              ))}
            </FilterGroup>

            <Field label="Tags">
              <Select defaultValue="">
                <option value="">Select tags…</option>
              </Select>
            </Field>

            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Date Range (Most Recent Post)</span>
              <div className="space-y-2">
                <Input type="date" defaultValue="2025-05-01" className="px-2.5" aria-label="From date" />
                <Input type="date" defaultValue="2025-05-08" className="px-2.5" aria-label="To date" />
              </div>
            </div>

            <Field label="Min Source Count">
              <Input type="number" defaultValue={2} min={1} aria-label="Minimum source count" />
            </Field>

            <Field label="Search in Description">
              <SearchInput placeholder="Search description…" value={descSearch} onChange={(e) => setDescSearch(e.target.value)} />
            </Field>

            <div className="mt-auto rounded-card border border-line bg-canvas p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Last Clustering</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div className="mt-1.5 text-[12px] text-ink/65">May 8, 2025 09:12 UTC</div>
              <div className="text-[11px] text-ink/50">Based on 186 analyzed posts</div>
            </div>
          </Panel>
        </aside>

        {/* CLUSTERS LIST — bulk bar header + cards + pagination footer in one card */}
        <Card className="flex h-full min-w-0 flex-col overflow-hidden p-0">
          {/* bulk bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="text-[13px]">
              <span className="font-semibold">{filtered.length}</span> <span className="text-ink/55">clusters found</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink/70">
                <Checkbox checked={allPicked} onChange={togglePickAll} /> Select all
              </label>
              <Button variant="danger" size="sm" disabled={!picked.size || dismiss.isPending} onClick={dismissSelected}>
                Dismiss Selected
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-4">
              <CardSkeleton count={4} />
            </div>
          ) : isError && !data ? (
            <div className="p-4">
              <ErrorState error={error} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No clusters" hint="Parse sources, then Refresh Clusters." />
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-3 p-4">
                {pageRows.map((c) => (
                  <ClusterCard
                    key={c.id}
                    cluster={c}
                    compact={view === "list"}
                    selected={c.id === selectedId}
                    picked={picked.has(c.id)}
                    onSelect={() => openCluster(c.id)}
                    onPick={() => togglePick(c.id)}
                    onCreate={() => createDraft(c.id)}
                    onDismiss={() => onDismiss(c.id)}
                    onViewPosts={() => viewPosts(c.id)}
                  />
                ))}
              </div>

              <div className="border-t border-line px-4 py-3">
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPage={setPage}
                  perPage={perPage}
                  onPerPage={(n) => {
                    setPerPage(n)
                    setPage(1)
                  }}
                />
              </div>
            </>
          )}
        </Card>

        {/* CLUSTER DETAILS — inline column on wide screens (only when selected) */}
        {selected && (
          <aside className="hidden h-full 2xl:block">
            <DetailsPanel cluster={selected} onClose={() => setSelectedId(null)} onCreate={createDraft} onDismiss={onDismiss} onViewPosts={viewPosts} />
          </aside>
        )}
      </div>

      {/* CLUSTER DETAILS — slide-over drawer below 2xl */}
      {drawerOpen && (
        <div className="2xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <DetailsPanel cluster={selected} onClose={() => setDrawerOpen(false)} onCreate={createDraft} onDismiss={onDismiss} onViewPosts={viewPosts} />
          </div>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">{label}</span>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function CheckRow({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-[13px] font-medium">
      <span className="flex items-center gap-2">
        <Checkbox checked={checked} onChange={onChange} /> {label}
      </span>
      <span className="text-[12px] text-ink/45">{count}</span>
    </label>
  )
}

function SourceAvatars({ sources }: { sources?: Src[] }) {
  const list = sources ?? []
  const shown = list.slice(0, 3)
  const extra = list.length - shown.length
  return (
    <div className="flex items-center gap-1.5">
      {shown.map((s) => (
        <span
          key={s.name}
          title={s.name}
          className="grid h-7 w-7 place-items-center rounded-full border border-line bg-canvas text-[10px] font-bold text-ink/70"
        >
          {s.initials}
        </span>
      ))}
      {extra > 0 && (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-line-soft text-[10px] font-bold text-ink/60">+{extra}</span>
      )}
    </div>
  )
}

function CardStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.04em] text-ink/50">{label}</div>
    </div>
  )
}

function ClusterCard({
  cluster: c,
  compact,
  selected,
  picked,
  onSelect,
  onPick,
  onCreate,
  onDismiss,
  onViewPosts,
}: {
  cluster: ClusterRow
  compact: boolean
  selected: boolean
  picked: boolean
  onSelect: () => void
  onPick: () => void
  onCreate: () => void
  onDismiss: () => void
  onViewPosts: () => void
}) {
  const priority = (c.priority ?? "low").toLowerCase()
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer gap-0 overflow-hidden p-0 transition-colors",
        selected ? "border-lavender-text ring-1 ring-lavender-text" : "hover:border-ink/20"
      )}
    >
      <span className={cn("w-1.5 shrink-0", priorityTint[priority])} />
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4 p-4">
        <span onClick={stop}>
          <Checkbox checked={picked} onChange={onPick} aria-label={`Select ${c.title}`} className="mt-1" />
        </span>
        <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-chip", priorityTint[priority])}>
          <ArrowUp className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <Badge tone={statusTone(priority)}>{priority} priority</Badge>
          <h3 className="mt-2 text-[16px] font-semibold leading-snug">{c.title}</h3>
          {!compact && c.description && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink/65">{c.description}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(c.tags ?? []).slice(0, 5).map((t) => (
              <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="flex gap-6">
            <CardStat value={c.source_diversity} label="Sources" />
            <CardStat value={c.post_count} label="Posts" />
            <CardStat value={c.freshness_hours != null ? `${c.freshness_hours.toFixed(1)}h` : "—"} label="Freshness" />
          </div>
          <SourceAvatars sources={c.top_sources} />
        </div>

        <div className="flex w-[150px] shrink-0 flex-col gap-2" onClick={stop}>
          <Button size="sm" onClick={onCreate}>
            Create Draft
          </Button>
          <Button size="sm" variant="secondary" onClick={onViewPosts}>
            View Posts
          </Button>
          <Button size="sm" variant="danger" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  )
}

function DetailStat({ icon: Icon, value, label, tone }: { icon: typeof Boxes; value: string | number; label: string; tone?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-line-soft text-ink/70">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className={cn("text-[16px] font-semibold leading-none", tone)}>{value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.04em] text-ink/50">{label}</div>
      </div>
    </div>
  )
}

function DetailsPanel({
  cluster: c,
  onClose,
  onCreate,
  onDismiss,
  onViewPosts,
}: {
  cluster: ClusterRow | null
  onClose: () => void
  onCreate: (id: string) => void
  onDismiss: (id: string) => void
  onViewPosts: (id: string) => void
}) {
  if (!c) {
    return (
      <Panel className="h-full" title="Cluster Details" bodyClassName="py-6">
        <p className="text-[13px] text-ink/55">Select a cluster to see details.</p>
      </Panel>
    )
  }
  const priority = (c.priority ?? "low").toLowerCase()
  return (
    <Panel
      className="h-full"
      title="Cluster Details"
      action={
        <RowAction label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </RowAction>
      }
      bodyClassName="space-y-4 py-4"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={statusTone(priority)}>{priority} priority</Badge>
        <span className="text-[12px] text-ink/55">Created {c.created_ago}</span>
      </div>

      <h3 className="text-[18px] font-semibold leading-snug">{c.title}</h3>
      {c.description && <p className="text-[13px] leading-normal text-ink/70">{c.description}</p>}

      <div className="flex flex-wrap gap-1.5">
        {(c.tags ?? []).map((t) => (
          <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">
            {t}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-2 gap-y-4 border-y border-line py-4">
        <DetailStat icon={Boxes} value={c.source_diversity} label="Sources" />
        <DetailStat icon={FileText} value={c.post_count} label="Posts" />
        <DetailStat icon={Clock} value={c.freshness_hours != null ? `${c.freshness_hours.toFixed(1)}h` : "—"} label="Freshness" />
        <DetailStat icon={Flag} value={cap(priority)} label="Priority" />
        <DetailStat icon={BarChart3} value={c.score ?? "—"} label="Score" />
        <DetailStat icon={Eye} value={c.used_in ?? "—"} label="Used In" />
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Top Sources</div>
        <div className="divide-y divide-line-soft">
          {!(c.top_sources ?? []).length && <div className="py-2 text-[12px] text-ink/50">No source breakdown available.</div>}
          {(c.top_sources ?? []).map((s) => (
            <div key={s.name} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 py-2">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-canvas text-[10px] font-bold text-ink/70">
                {s.initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{s.name}</div>
                <div className="text-[11px] text-ink/55">{s.posts} posts</div>
              </div>
              <span className="whitespace-nowrap text-[11px] text-ink/50">{s.ago}</span>
            </div>
          ))}
        </div>
      </div>

      <Button variant="secondary" className="w-full justify-between" onClick={() => onViewPosts(c.id)}>
        View All {c.post_count} Posts in Cluster <ArrowUp className="h-4 w-4 rotate-90" />
      </Button>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Actions</div>
        <div className="space-y-2">
          <ActionRow icon={PenLine} label="Create Draft from This Cluster" onClick={() => onCreate(c.id)} />
          <ActionRow icon={Eye} label="View All Posts in Cluster" onClick={() => onViewPosts(c.id)} />
          <ActionRow icon={Trash2} label="Dismiss This Cluster" danger onClick={() => onDismiss(c.id)} />
        </div>
      </div>
    </Panel>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick }: { icon: typeof Boxes; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-white px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-canvas"
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-chip", danger ? "bg-blush-dismiss" : "bg-line-soft")}>
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </button>
  )
}

function RowAction({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-card text-ink/55 transition-colors hover:bg-line-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-text/60"
    >
      {children}
    </button>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

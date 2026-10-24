"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  MessageCircle,
  Repeat2,
  RefreshCw,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge } from "@/components/ui/badge"
import { PlatformIcon, platformLabel } from "@/components/ui/platform-icon"
import { Pagination } from "@/components/ui/pagination"
import { Field, Select, SearchInput, Checkbox } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { usePublished, useSyncPublished, useSyncAllPublished } from "@/lib/api/hooks"
import type { PublishedPost } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

type IconTone = "lavender" | "blush" | "sprout" | "line"
type PRow = {
  id: string
  draft_id?: string
  platform: string
  published_text: string
  published_at: string
  language: string
  tags?: string[]
  post_url?: string | null
  likes: number | null
  reposts: number | null
  views: number | null
  comments: number | null
  title?: string
  pub_id?: string
  platform_kind?: string
  thumb_tone?: IconTone
  related_draft?: string
}


function toRow(p: PublishedPost): PRow {
  const r = p as PRow
  return {
    ...r,
    title: r.title ?? r.published_text?.slice(0, 60) ?? "Post",
    pub_id: r.pub_id ?? `pub_${p.id?.slice(0, 8)}`,
    platform_kind: r.platform_kind ?? platformLabel(p.platform),
    thumb_tone: r.thumb_tone ?? "lavender",
    likes: r.likes ?? p.likes,
    reposts: r.reposts ?? p.reposts,
    views: r.views ?? p.views,
    comments: r.comments ?? p.comments,
  }
}

const toneBg: Record<IconTone, string> = {
  lavender: "bg-lavender",
  blush: "bg-blush-soft",
  sprout: "bg-sprout",
  line: "bg-line-soft",
}

export default function PublishedPage() {
  const { data, isLoading, isError, error } = usePublished({ limit: "50" })
  const sync = useSyncPublished()
  const syncAll = useSyncAllPublished()

  const posts: PRow[] = (data ?? []).map(toRow)

  const [search, setSearch] = useState("")
  const [selected, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [perPage, setPerPage] = useState(20)
  const [page, setPage] = useState(1)
  const [platformF, setPlatformF] = useState("all")
  const [langF, setLangF] = useState("all")
  const [tagF, setTagF] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [minEng, setMinEng] = useState("")
  const [maxEng, setMaxEng] = useState("")
  const [sortBy, setSortBy] = useState("newest")

  const engagement = (p: PRow) => (p.likes ?? 0) + (p.reposts ?? 0) + (p.views ?? 0) + (p.comments ?? 0)
  const tagOptions = useMemo(() => Array.from(new Set(posts.flatMap((p) => p.tags ?? []))).sort(), [posts])

  const filtered = useMemo(() => {
    let rows = posts
    if (search) rows = rows.filter((p) => (p.title ?? "").toLowerCase().includes(search.toLowerCase()))
    if (platformF !== "all") rows = rows.filter((p) => p.platform === platformF)
    if (langF !== "all") rows = rows.filter((p) => (p.language ?? "en").toLowerCase() === langF)
    if (tagF) rows = rows.filter((p) => (p.tags ?? []).includes(tagF))
    if (dateFrom) rows = rows.filter((p) => new Date(p.published_at) >= new Date(dateFrom))
    if (dateTo) rows = rows.filter((p) => new Date(p.published_at) <= new Date(`${dateTo}T23:59:59Z`))
    if (minEng) rows = rows.filter((p) => engagement(p) >= Number(minEng))
    if (maxEng) rows = rows.filter((p) => engagement(p) <= Number(maxEng))
    const sorted = [...rows]
    if (sortBy === "engagement") sorted.sort((a, b) => engagement(b) - engagement(a))
    else sorted.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    return sorted
  }, [posts, search, platformF, langF, tagF, dateFrom, dateTo, minEng, maxEng, sortBy])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const selectedPost = posts.find((p) => p.id === selected) ?? null
  const allPicked = pageRows.length > 0 && pageRows.every((p) => picked.has(p.id))

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const header = ["title", "platform", "published_at", "language", "likes", "reposts", "views", "comments", "url", "tags"]
    const lines = filtered.map((p) =>
      [p.title, p.platform, p.published_at, p.language, p.likes, p.reposts, p.views, p.comments, p.post_url, (p.tags ?? []).join("|")].map(esc).join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "published-posts.csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} posts`)
  }

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const togglePickAll = () =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (allPicked) filtered.forEach((p) => next.delete(p.id))
      else filtered.forEach((p) => next.add(p.id))
      return next
    })

  const openPost = (id: string) => {
    if (selected === id) {
      setSelectedId(null)
      setDrawerOpen(false)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }
  const onSyncAll = () =>
    syncAll.mutate(undefined, {
      onSuccess: (r) => toast.success(`Synced ${(r as { synced?: number })?.synced ?? "all"} posts`),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Published Posts" subtitle="Track performance and engagement across all platforms" />

      {/* Toolbar — full width */}
      <Card className="mb-[16px] flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSyncAll} disabled={syncAll.isPending}>
            <RefreshCw className="h-4 w-4" /> Sync Engagement
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(perPage)} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} className="w-[130px]">
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </Select>
        </div>
      </Card>

      <div className={cn("grid grid-cols-1 items-stretch gap-[16px] xl:grid-cols-[260px_minmax(0,1fr)]", selectedPost && "2xl:grid-cols-[260px_minmax(0,1fr)_360px]")}>
        {/* FILTERS */}
        <aside className="h-full">
          <Panel
            className="h-full"
            title="Filters"
            action={
              <button
                onClick={() => {
                  setSearch("")
                  setPlatformF("all")
                  setLangF("all")
                  setTagF("")
                  setDateFrom("")
                  setDateTo("")
                  setMinEng("")
                  setMaxEng("")
                  setSortBy("newest")
                }}
                className="cursor-pointer text-[12px] font-semibold text-lavender-text hover:underline"
              >
                Clear all
              </button>
            }
            bodyClassName="flex h-full flex-col gap-4 py-4"
          >
            <Field label="Search">
              <SearchInput placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <Field label="Platform">
              <Select value={platformF} onChange={(e) => setPlatformF(e.target.value)}>
                <option value="all">All Platforms</option>
                <option value="telegram">Telegram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X (Twitter)</option>
                <option value="email">Email</option>
              </Select>
            </Field>
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Date Range</span>
              <div className="space-y-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2.5" aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2.5" aria-label="To date" />
              </div>
            </div>
            <Field label="Tags">
              <Select value={tagF} onChange={(e) => setTagF(e.target.value)}>
                <option value="">All tags</option>
                {tagOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Language">
              <Select value={langF} onChange={(e) => setLangF(e.target.value)}>
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="ru">Russian</option>
              </Select>
            </Field>
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Engagement Range</span>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" min={0} value={minEng} onChange={(e) => setMinEng(e.target.value)} aria-label="Min engagement" />
                <span className="text-ink/40">–</span>
                <Input type="number" placeholder="Max" min={0} value={maxEng} onChange={(e) => setMaxEng(e.target.value)} aria-label="Max engagement" />
              </div>
            </div>
            <Field label="Sort By">
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Published At (Newest)</option>
                <option value="engagement">Engagement</option>
              </Select>
            </Field>
          </Panel>
        </aside>

        {/* TABLE */}
        <div className="min-w-0">

          {isLoading ? (
            <TableSkeleton />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No published posts" hint="Publish a draft to see analytics here." />
          ) : (
            <Card className="flex h-full w-full flex-col overflow-hidden p-0">
              <div className="px-4 py-3 text-[13px]">
                <span className="font-semibold">{filtered.length}</span> <span className="text-ink/55">posts found</span>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-y border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-4 py-3">
                        <Checkbox checked={allPicked} onChange={togglePickAll} aria-label="Select all" />
                      </th>
                      <th className="px-2 py-3">Post</th>
                      <th className="px-2 py-3">Tags</th>
                      <th className="px-2 py-3">Platform</th>
                      <th className="px-2 py-3">Published At</th>
                      <th className="px-2 py-3">Engagement</th>
                      <th className="px-2 py-3">Language</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => openPost(p.id)}
                        className={cn("cursor-pointer align-top transition-colors hover:bg-canvas", p.id === selected && "bg-lavender/10")}
                      >
                        <td className="px-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={picked.has(p.id)} onChange={() => togglePick(p.id)} aria-label={`Select ${p.title}`} />
                        </td>
                        <td className="!text-left">
                          <div className="flex items-start gap-3">
                            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-card", toneBg[p.thumb_tone ?? "lavender"])}>
                              <FileText className="h-5 w-5 text-ink/70" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold leading-snug">{p.title}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-ink/45">ID: {p.pub_id}</span>
                                <Badge tone="success" className="px-1.5 py-0 text-[10px]">Published</Badge>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-[176px] px-2">
                          <div className="flex flex-wrap justify-center gap-1">
                            {(p.tags ?? []).slice(0, 6).map((t) => (
                              <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">{t}</span>
                            ))}
                            {(p.tags?.length ?? 0) > 6 && (
                              <span className="self-center text-[11px] font-medium text-ink/45">+{(p.tags?.length ?? 0) - 6}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2">
                          <div className="flex items-start justify-center gap-2">
                            <PlatformIcon type={p.platform} className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="text-[12px] leading-tight text-ink/70">{p.platform_kind}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2">
                          <div className="text-[12px] font-medium">{safeDate(p.published_at, "MMM d, yyyy")}</div>
                          <div className="mt-0.5 text-[11px] text-ink/55">{safeDate(p.published_at, "HH:mm")} UTC</div>
                        </td>
                        <td className="px-2">
                          <div className="mx-auto grid w-fit grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-ink/65">
                            <EngCell icon={Heart} value={fmt(p.likes)} />
                            <EngCell icon={Eye} value={fmt(p.views)} />
                            <EngCell icon={Repeat2} value={fmt(p.reposts)} />
                            <EngCell icon={MessageCircle} value={fmt(p.comments)} />
                          </div>
                        </td>
                        <td className="px-2 text-center text-[12px] font-medium text-ink/70">{p.language?.toUpperCase()}</td>
                        <td className="px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <RowAction label="View" onClick={() => openPost(p.id)}>
                              <Eye className="h-4 w-4" />
                            </RowAction>
                            <RowAction label="Sync engagement" onClick={() => sync.mutate(p.id, { onSuccess: () => toast.success("Engagement synced"), onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") })}>
                              <RefreshCw className="h-4 w-4" />
                            </RowAction>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            </Card>
          )}
        </div>

        {/* POST DETAILS — inline 2xl+ (only when selected) */}
        {selectedPost && (
          <aside className="hidden h-full 2xl:block">
            <PostDetails post={selectedPost} onClose={() => setSelectedId(null)} sync={sync} clear={() => setSelectedId(null)} />
          </aside>
        )}
      </div>

      {/* POST DETAILS — drawer below 2xl */}
      {drawerOpen && selectedPost && (
        <div className="2xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <PostDetails post={selectedPost} onClose={() => setDrawerOpen(false)} sync={sync} clear={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function EngCell({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-ink/45" /> {value}
    </span>
  )
}

function BigMetric({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <Icon className={cn("mx-auto h-5 w-5", color)} />
      <div className="mt-1.5 text-[16px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.04em] text-ink/50">{label}</div>
    </div>
  )
}

function PostDetails({
  post: p,
  onClose,
  sync,
  clear,
}: {
  post: PRow | null
  onClose: () => void
  sync: ReturnType<typeof useSyncPublished>
  clear: () => void
}) {
  if (!p) {
    return (
      <Panel title="Post Details" bodyClassName="py-6">
        <p className="text-[13px] text-ink/55">Select a post to see details.</p>
      </Panel>
    )
  }
  const onSync = () =>
    sync.mutate(p.id, {
      onSuccess: () => toast.success("Engagement synced"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  return (
    <Panel
      title="Post Details"
      action={
        <RowAction label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </RowAction>
      }
      bodyClassName="space-y-4 py-4"
    >
      <Badge tone="medium">Published</Badge>
      <h3 className="text-[17px] font-semibold leading-snug">{p.title}</h3>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <PlatformIcon type={p.platform} className="h-4 w-4" /> {p.platform_kind}
        </span>
        <a href={p.post_url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-ink/55 hover:text-lavender-text">
          {safeDate(p.published_at, "MMM d, yyyy, HH:mm")} UTC <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Engagement</span>
          <span className="text-[11px] text-ink/45">Last synced: 2 min ago</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <BigMetric icon={Heart} label="Likes" value={fmt(p.likes)} color="text-rose-400" />
          <BigMetric icon={Repeat2} label="Reposts" value={fmt(p.reposts)} color="text-emerald-500" />
          <BigMetric icon={Eye} label="Views" value={fmt(p.views)} color="text-sky-500" />
          <BigMetric icon={MessageCircle} label="Comments" value={fmt(p.comments)} color="text-lavender-text" />
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Content Preview</div>
        <span className="mb-2 inline-block rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-semibold uppercase">{p.language}</span>
        <p className="whitespace-pre-wrap text-[13px] leading-normal text-ink/70">{p.published_text}</p>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Tags</div>
        <div className="flex flex-wrap gap-1.5">
          {(p.tags ?? []).map((t) => (
            <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">{t}</span>
          ))}
        </div>
      </div>

      {p.draft_id && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Related Draft</div>
          <div className="flex items-center justify-between gap-2">
            <a href={`/content/drafts/new?id=${p.draft_id}`} className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-lavender-text hover:underline">
              <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{p.related_draft ?? p.title}</span>
            </a>
            <a href={`/content/drafts/new?id=${p.draft_id}`}>
              <Button size="sm">View Draft</Button>
            </a>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Actions</div>
        <div className="space-y-2">
          <ActionRow icon={RefreshCw} label="Sync Engagement" onClick={onSync} />
          {p.post_url && <ActionRow icon={ExternalLink} label="View on Platform" href={p.post_url} />}
        </div>
      </div>
    </Panel>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick, href }: { icon: LucideIcon; label: string; danger?: boolean; onClick?: () => void; href?: string }) {
  const cls = cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-card border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
    danger ? "border-blush bg-blush-dismiss text-red-600 hover:brightness-95" : "border-line bg-white hover:bg-canvas"
  )
  const inner = (
    <>
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-chip", danger ? "bg-white/60" : "bg-line-soft")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
    </>
  )
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
  return <button onClick={onClick} className={cls}>{inner}</button>
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

function safeDate(d: string, f: string) {
  try {
    return format(new Date(d), f)
  } catch {
    return "—"
  }
}

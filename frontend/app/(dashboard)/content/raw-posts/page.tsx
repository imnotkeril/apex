"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import {
  CheckCircle2,
  Clock,
  Eye,
  Pencil,
  Play,
  Plus,
  RefreshCw,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, statusTone } from "@/components/ui/badge"
import { Toggle } from "@/components/ui/toggle"
import { Pagination } from "@/components/ui/pagination"
import { PlatformIcon, platformLabel } from "@/components/ui/platform-icon"
import { Field, Select, SearchInput, Checkbox, Textarea } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { Modal } from "@/components/ui/modal"
import { useRawPosts, useParseAll, useParseSource, useCustomInput, useUpdateRawPost } from "@/lib/api/hooks"
import type { RawPost } from "@/lib/api/types"
import { timeAgo } from "@/lib/utils"
import { toast } from "sonner"

const STATUSES = ["new", "analyzed", "used", "failed"] as const

/** Display row = RawPost + the source/usage metadata the table renders. */
type RawPostRow = RawPost & {
  source_name?: string
  source_type?: string
  source_kind?: string
  used_in?: string | null
  language?: string
  ago?: string
  error_note?: string
}


function inferType(url: string | null): string | null {
  const u = (url ?? "").toLowerCase()
  if (!u) return null
  if (u.includes("t.me") || u.includes("telegram")) return "telegram"
  if (u.includes("youtu")) return "youtube"
  if (u.includes("x.com") || u.includes("twitter")) return "x"
  if (u.includes("linkedin")) return "linkedin"
  if (u.endsWith(".pdf")) return "pdf"
  if (u.includes("rss") || u.includes("feed")) return "rss"
  if (u.startsWith("mailto") || u.includes("newsletter")) return "email"
  return "web"
}

function toRow(p: RawPost, i = 0): RawPostRow {
  const r = p as RawPostRow
  const type = r.source_type ?? inferType(p.source_url) ?? "web"
  return {
    ...r,
    source_name: r.source_name ?? hostOf(p.source_url) ?? "Unknown source",
    source_type: type,
    source_kind: r.source_kind ?? platformLabel(type),
    used_in: r.used_in ?? (p.cluster_id ? "Clustered" : null),
    language: r.language ?? "EN",
  }
}

function RawPostsInner() {
  const { data, isLoading, isError, error } = useRawPosts({ limit: "100" })
  const parseAll = useParseAll()
  const parseSource = useParseSource()
  const customInput = useCustomInput()
  const updatePost = useUpdateRawPost()
  const router = useRouter()
  const params = useSearchParams()
  const clusterFilter = params.get("cluster")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState("all")
  const [langFilter, setLangFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [minLen, setMinLen] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [autoParse, setAutoParse] = useState(true)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ input_type: "url", value: "" })
  const [viewPost, setViewPost] = useState<RawPostRow | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsValue, setTagsValue] = useState("")

  const posts: RawPostRow[] = (data ?? []).map((p, i) => toRow(p, i))

  const sourceOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of posts) if (p.source_id && !seen.has(p.source_id)) seen.set(p.source_id, p.source_name ?? p.source_id)
    return Array.from(seen.entries())
  }, [posts])
  const tagOptions = useMemo(
    () => Array.from(new Set(posts.flatMap((p) => p.tags ?? []))).sort(),
    [posts]
  )

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (clusterFilter && p.cluster_id !== clusterFilter) return false
      if (statusFilter.size && !statusFilter.has(p.status?.toLowerCase())) return false
      if (sourceFilter !== "all" && p.source_id !== sourceFilter) return false
      if (langFilter !== "all" && (p.language ?? "en").toLowerCase() !== langFilter) return false
      if (tagFilter && !(p.tags ?? []).includes(tagFilter)) return false
      if (typeFilter && !(p.tags ?? []).includes(typeFilter)) return false
      if (minLen > 0 && (p.raw_text?.length ?? 0) < minLen) return false
      if (dateFrom && new Date(p.post_date) < new Date(dateFrom)) return false
      if (dateTo && new Date(p.post_date) > new Date(`${dateTo}T23:59:59Z`)) return false
      if (search) {
        const hay = `${p.summary ?? ""} ${p.raw_text ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [posts, clusterFilter, statusFilter, sourceFilter, langFilter, tagFilter, typeFilter, minLen, dateFrom, dateTo, search])

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of posts) c[p.status?.toLowerCase()] = (c[p.status?.toLowerCase()] ?? 0) + 1
    return c
  }, [posts])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id))

  const toggleStatus = (s: string) =>
    setStatusFilter((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleSelectPage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageRows.forEach((p) => next.delete(p.id))
      else pageRows.forEach((p) => next.add(p.id))
      return next
    })

  const clearAll = () => {
    setSearch("")
    setStatusFilter(new Set())
    setSourceFilter("all")
    setLangFilter("all")
    setTagFilter("")
    setTypeFilter("")
    setDateFrom("")
    setDateTo("")
    setMinLen(0)
    if (clusterFilter) router.push("/content/raw-posts")
  }
  const bulkPatch = (body: Record<string, unknown>, okMsg: string) => {
    const ids = Array.from(selected)
    if (!ids.length) return
    Promise.all(ids.map((id) => new Promise((res, rej) => updatePost.mutate({ id, body }, { onSuccess: res, onError: rej }))))
      .then(() => {
        toast.success(okMsg)
        setSelected(new Set())
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
  }
  const submitTags = () => {
    const tags = tagsValue.split(",").map((t) => t.trim()).filter(Boolean)
    bulkPatch({ tags }, "Tags updated")
    setTagsOpen(false)
  }
  const runParseAll = () =>
    parseAll.mutate(undefined, {
      onSuccess: () => toast.success("Parsing all sources"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  const createDraftFromSelected = () => {
    if (!selected.size) return
    router.push(`/content/drafts/new?posts=${Array.from(selected).join(",")}`)
  }
  const submitAdd = () => {
    if (!addForm.value.trim()) {
      toast.error("Value required")
      return
    }
    customInput.mutate(addForm, {
      onSuccess: () => {
        toast.success("Added to raw posts")
        setAddOpen(false)
        setAddForm({ input_type: "url", value: "" })
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  }

  const hasSelection = selected.size > 0

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Raw Posts" subtitle="All content collected from your sources" />

      {/* Toolbar — parse actions + auto-parse schedule (full width) */}
      <Card className="mb-[16px] flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={runParseAll} disabled={parseAll.isPending}>
            <Play className="h-4 w-4" /> Parse Now
          </Button>
          <Button variant="secondary" onClick={runParseAll} disabled={parseAll.isPending}>
            <RefreshCw className="h-4 w-4" /> Parse All Sources
          </Button>
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add URL / Video / Text
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2 font-semibold">
            Auto-parse
            <Toggle checked={autoParse} onChange={setAutoParse} />
          </label>
          <span className="flex items-center gap-1.5 text-ink/65">
            <Clock className="h-4 w-4" /> Schedule:{" "}
            <span className="font-semibold text-ink">Every hour</span>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-stretch gap-[16px] lg:grid-cols-[260px_minmax(0,1fr)]">
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
            bodyClassName="space-y-4 py-4"
          >
            <Field label="Search">
              <SearchInput placeholder="Search in posts…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>

            <Field label="Sources">
              <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="all">All Sources</option>
                {sourceOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Status</span>
              <div className="space-y-1.5">
                {STATUSES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center justify-between text-[13px] font-medium capitalize">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={statusFilter.has(s)} onChange={() => toggleStatus(s)} />
                      {s}
                    </span>
                    <span className="text-[12px] text-ink/45">{statusCounts[s] ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            <Field label="Tags">
              <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="">All tags</option>
                {tagOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Date Range</span>
              <div className="space-y-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2.5" aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2.5" aria-label="To date" />
              </div>
            </div>

            <Field label="Language">
              <Select value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="ru">Russian</option>
              </Select>
            </Field>

            <Field label="Min Post Length">
              <div className="flex items-center gap-2">
                <Input type="number" value={minLen} onChange={(e) => setMinLen(Math.max(0, Number(e.target.value) || 0))} min={0} aria-label="Minimum post length" />
                <span className="shrink-0 text-[12px] text-ink/55">characters</span>
              </div>
            </Field>

            <Field label="Content Type Tag">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Any content type</option>
                <option value="news">News</option>
                <option value="analysis">Analysis</option>
                <option value="video">Video</option>
              </Select>
            </Field>
          </Panel>
        </aside>

        {/* POSTS */}
        <div className="flex min-w-0">
          {/* Table card — bulk bar header + table + pagination footer */}
          {isLoading ? (
            <TableSkeleton />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No raw posts" hint="Parse a source to collect content." />
          ) : (
            <Card className="flex h-full w-full flex-col overflow-hidden p-0">
              {/* bulk bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-semibold">{filtered.length}</span>
                  <span className="text-ink/55">posts found</span>
                  {hasSelection && (
                    <>
                      <span className="text-ink/30">·</span>
                      <span className="font-semibold text-lavender-text">{selected.size} selected</span>
                    </>
                  )}
                </div>
                {hasSelection && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={createDraftFromSelected}>
                      Create Draft from Selected
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={updatePost.isPending}
                      onClick={() => bulkPatch({ status: "new" }, "Queued for re-analysis")}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setTagsValue("")
                        setTagsOpen(true)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit Tags
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={updatePost.isPending}
                      onClick={() => bulkPatch({ status: "used" }, "Marked as used")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Used
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[940px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-y border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-4 py-3">
                        <Checkbox checked={allOnPageSelected} onChange={toggleSelectPage} aria-label="Select all" />
                      </th>
                      <th className="px-2 py-3">Date</th>
                      <th className="px-2 py-3">Source</th>
                      <th className="px-2 py-3">Summary</th>
                      <th className="px-2 py-3">Tags</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Used In</th>
                      <th className="px-2 py-3">Language</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((p) => (
                      <tr key={p.id} className="align-top transition-colors hover:bg-canvas">
                        <td className="px-4 py-4">
                          <Checkbox checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.summary}`} />
                        </td>
                        <td className="whitespace-nowrap px-2 py-4">
                          <div className="text-[13px] font-medium">{safeDate(p.post_date, "MMM d, yyyy")}</div>
                          <div className="mt-0.5 text-[12px] text-ink/55">{safeDate(p.post_date, "HH:mm")}</div>
                        </td>
                        <td className="!text-left">
                          <div className="flex items-center gap-2">
                            <PlatformIcon type={p.source_type ?? "web"} className="h-[18px] w-[18px] shrink-0" />
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold">{p.source_name}</div>
                              <div className="truncate text-[11px] text-ink/55">{p.source_kind}</div>
                            </div>
                          </div>
                        </td>
                        <td className="!text-left">
                          <div className="text-[13px] font-semibold leading-snug">{p.summary || "(no summary)"}</div>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink/65">{p.raw_text}</p>
                          {p.error_note && (
                            <p className="mt-1.5 text-[11px] font-medium text-red-500">
                              {p.error_note}{" "}
                              <button
                                onClick={() =>
                                  parseSource.mutate(p.source_id, {
                                    onSuccess: () => toast.success("Parse retried"),
                                    onError: (e) => toast.error(e instanceof Error ? e.message : "Retry failed"),
                                  })
                                }
                                className="cursor-pointer underline hover:no-underline"
                              >
                                Retry
                              </button>
                            </p>
                          )}
                        </td>
                        <td className="min-w-[176px] px-2 py-4">
                          <div className="flex flex-wrap justify-center gap-1">
                            {(p.tags ?? []).slice(0, 6).map((t) => (
                              <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">
                                {t}
                              </span>
                            ))}
                            {(p.tags?.length ?? 0) > 6 && (
                              <span className="self-center text-[11px] font-medium text-ink/45">+{(p.tags?.length ?? 0) - 6}</span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-4">
                          <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                          <div className="mt-1 text-[11px] text-ink/55">{p.ago ?? timeAgo(p.post_date)}</div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-[12px] text-ink/65">{p.used_in ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-4 text-center text-[12px] font-medium text-ink/70">{p.language}</td>
                        <td className="px-2 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <RowAction label="View full text" onClick={() => setViewPost(p)}>
                              <Eye className="h-4 w-4" />
                            </RowAction>
                            <RowAction
                              label="Create draft from this post"
                              onClick={() => router.push(`/content/drafts/new?posts=${p.id}`)}
                            >
                              <Plus className="h-4 w-4" />
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
      </div>

      {/* Add content modal */}
      <Modal
        open={addOpen}
        title="Add Content"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={customInput.isPending}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Type">
            <Select value={addForm.input_type} onChange={(e) => setAddForm({ ...addForm, input_type: e.target.value })}>
              <option value="url">Web URL</option>
              <option value="youtube">YouTube Video</option>
              <option value="text">Plain Text</option>
            </Select>
          </Field>
          <Field label={addForm.input_type === "text" ? "Text" : "URL"}>
            {addForm.input_type === "text" ? (
              <Textarea value={addForm.value} onChange={(e) => setAddForm({ ...addForm, value: e.target.value })} rows={5} />
            ) : (
              <Input
                value={addForm.value}
                onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                placeholder="https://…"
              />
            )}
          </Field>
        </div>
      </Modal>

      {/* Bulk edit tags modal */}
      <Modal
        open={tagsOpen}
        title={`Edit Tags (${selected.size} posts)`}
        onClose={() => setTagsOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTagsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitTags} disabled={updatePost.isPending}>
              Apply
            </Button>
          </>
        }
      >
        <Field label="Tags (comma-separated, replaces existing)">
          <Input value={tagsValue} onChange={(e) => setTagsValue(e.target.value)} placeholder="macro, fed, rates" />
        </Field>
      </Modal>

      {/* Full-text view modal */}
      <Modal open={!!viewPost} title="Full Text" onClose={() => setViewPost(null)}>
        {viewPost && (
          <div className="space-y-3">
            <div className="text-[15px] font-semibold">{viewPost.summary}</div>
            <div className="flex flex-wrap gap-1">
              {(viewPost.tags ?? []).map((t) => (
                <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">
                  {t}
                </span>
              ))}
            </div>
            <p className="whitespace-pre-wrap text-[13px] text-ink/75">{viewPost.raw_text}</p>
            {viewPost.source_url && (
              <a
                href={viewPost.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-lavender-text hover:underline"
              >
                {viewPost.source_url}
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function RawPostsPage() {
  return (
    <Suspense fallback={null}>
      <RawPostsInner />
    </Suspense>
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

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function safeDate(d: string, fmt: string) {
  try {
    return format(new Date(d), fmt)
  } catch {
    return "—"
  }
}

"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import {
  CalendarDays,
  Eye,
  FileDown,
  FileText,
  Pencil,
  Presentation,
  Plus,
  Trash2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/pagination"
import { PlatformIcon } from "@/components/ui/platform-icon"
import { IconBox } from "@/components/ui/icon-box"
import { ProgressBar } from "@/components/ui/feedback"
import { Field, Select, SearchInput, Checkbox } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { useDrafts, useDeleteDraft } from "@/lib/api/hooks"
import { contentDownload } from "@/lib/api/content"
import type { Draft } from "@/lib/api/types"
import { toast } from "sonner"

const TABS = [
  { key: "all", label: "All Drafts" },
  { key: "draft", label: "Draft" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
]

// Status badge tones tuned to the reference palette.
const STATUS_TONE: Record<string, BadgeTone> = {
  ready: "success",
  in_progress: "warning",
  scheduled: "info",
  draft: "low",
  published: "success",
  archived: "neutral",
  failed: "danger",
}
const FACT_TONE: Record<string, BadgeTone> = {
  passed: "success",
  pending: "low",
  issues_found: "danger",
}

type IconTone = "lavender" | "blush" | "sprout" | "line"
type DraftRow = Draft & {
  preview?: string
  tags?: string[]
  style_preset?: string
  formats?: string[]
  fact_check_date?: string
  updated_ago?: string
  updated_label?: string
  status_sub?: string
  progress?: number
  created_mode?: string
  icon?: LucideIcon
  icon_tone?: IconTone
}


function toRow(d: Draft, i = 0): DraftRow {
  const r = d as DraftRow
  const formats: string[] = r.formats ?? [
    ...(d.telegram_version ? ["telegram"] : []),
    ...(d.linkedin_post_version ? ["linkedin"] : []),
    ...(d.twitter_version ? ["twitter"] : []),
  ]
  return {
    ...r,
    preview: r.preview ?? "",
    tags: r.tags ?? [],
    style_preset: r.style_preset ?? "Default",
    formats,
    updated_ago: r.updated_ago ?? "",
    updated_label: r.updated_label ?? safeDate(d.created_at, "MMM d, HH:mm"),
    created_mode: r.created_mode ?? "Manual",
    icon: r.icon ?? FileText,
    icon_tone: r.icon_tone ?? "lavender",
  }
}

export default function DraftsPage() {
  return (
    <Suspense fallback={null}>
      <DraftsInner />
    </Suspense>
  )
}

function DraftsInner() {
  const { data, isLoading, isError, error } = useDrafts()
  const del = useDeleteDraft()
  const router = useRouter()
  const params = useSearchParams()

  const drafts: DraftRow[] = (data ?? []).map((d, i) => toRow(d, i))

  const initialTab = params.get("status")
  const [tab, setTab] = useState(initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : "all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("updated")
  const [langF, setLangF] = useState("all")
  const [modeF, setModeF] = useState("all")
  const [styleF, setStyleF] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const styleOptions = useMemo(
    () => Array.from(new Set(drafts.map((d) => d.style_preset).filter(Boolean))).sort() as string[],
    [drafts]
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: drafts.length }
    for (const d of drafts) c[d.status?.toLowerCase()] = (c[d.status?.toLowerCase()] ?? 0) + 1
    return c
  }, [drafts])

  const filtered = useMemo(() => {
    let rows = tab === "all" ? drafts : drafts.filter((d) => d.status?.toLowerCase() === tab)
    if (search) rows = rows.filter((d) => d.topic?.toLowerCase().includes(search.toLowerCase()))
    if (langF !== "all") rows = rows.filter((d) => (d.language ?? "en").toLowerCase() === langF)
    if (modeF !== "all") rows = rows.filter((d) => (d.created_mode ?? "Manual").toLowerCase() === modeF)
    if (styleF !== "all") rows = rows.filter((d) => d.style_preset === styleF)
    if (dateFrom) rows = rows.filter((d) => new Date(d.created_at) >= new Date(dateFrom))
    if (dateTo) rows = rows.filter((d) => new Date(d.created_at) <= new Date(`${dateTo}T23:59:59Z`))
    const sorted = [...rows]
    if (sort === "status") sorted.sort((a, b) => (a.status ?? "").localeCompare(b.status ?? ""))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [drafts, tab, search, langF, modeF, styleF, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const allPicked = pageRows.length > 0 && pageRows.every((d) => selected.has(d.id))

  const togglePick = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const togglePickAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPicked) pageRows.forEach((d) => next.delete(d.id))
      else pageRows.forEach((d) => next.add(d.id))
      return next
    })

  const onDownload = (id: string, kind: "pdf" | "pptx") =>
    contentDownload(`/drafts/${id}/${kind}`, `draft-${id}.${kind}`).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Download failed")
    )

  const onDelete = (id: string) => {
    if (!window.confirm("Delete this draft? This cannot be undone.")) return
    del.mutate(id, {
      onSuccess: () => toast.success("Draft deleted"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Drafts" subtitle="Create, edit and publish content across multiple formats" />

      {/* Status tabs + create */}
      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <Tabs items={TABS.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))} active={tab} onChange={setTab} />
        <Button onClick={() => router.push("/content/drafts/new")}>
          <Plus className="h-4 w-4" /> Create New Draft
        </Button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-[16px] lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* FILTERS */}
        <aside className="h-full">
          <Panel
            className="h-full"
            title="Filters"
            action={
              <button
                onClick={() => {
                  setSearch("")
                  setTab("all")
                  setLangF("all")
                  setModeF("all")
                  setStyleF("all")
                  setDateFrom("")
                  setDateTo("")
                }}
                className="cursor-pointer text-[12px] font-semibold text-lavender-text hover:underline"
              >
                Clear all
              </button>
            }
            bodyClassName="flex h-full flex-col gap-4 py-4"
          >
            <Field label="Search">
              <SearchInput placeholder="Search drafts…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={tab} onChange={(e) => setTab(e.target.value)}>
                <option value="all">All Statuses</option>
                {TABS.filter((t) => t.key !== "all").map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Style Preset">
              <Select value={styleF} onChange={(e) => setStyleF(e.target.value)}>
                <option value="all">All Styles</option>
                {styleOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
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
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Date Range</span>
              <div className="space-y-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2.5" aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2.5" aria-label="To date" />
              </div>
            </div>
            <Field label="Created By Mode">
              <Select value={modeF} onChange={(e) => setModeF(e.target.value)}>
                <option value="all">All (Manual + Auto)</option>
                <option value="manual">Manual</option>
                <option value="auto">Auto</option>
              </Select>
            </Field>
          </Panel>
        </aside>

        {/* TABLE */}
        <div className="flex min-w-0">
          {isLoading ? (
            <div className="w-full">
              <TableSkeleton />
            </div>
          ) : isError && !data ? (
            <div className="w-full">
              <ErrorState error={error} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="w-full">
              <EmptyState title="No drafts" hint="Create a draft from a cluster or selected posts." />
            </div>
          ) : (
            <Card className="flex h-full w-full flex-col overflow-hidden p-0">
              {/* header bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="text-[13px]">
                  <span className="font-semibold">{filtered.length}</span> <span className="text-ink/55">drafts found</span>
                </div>
                <span className="flex items-center gap-2 text-[13px] text-ink/65">
                  Sort by:
                  <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[170px]">
                    <option value="updated">Created (Newest)</option>
                    <option value="status">Status</option>
                  </Select>
                </span>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-y border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-4 py-3">
                        <Checkbox checked={allPicked} onChange={togglePickAll} aria-label="Select all" />
                      </th>
                      <th className="px-2 py-3">Topic &amp; Preview</th>
                      <th className="px-2 py-3">Tags</th>
                      <th className="px-2 py-3">Style Preset</th>
                      <th className="px-2 py-3">Formats</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Fact Check</th>
                      <th className="px-2 py-3">Updated</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((d) => {
                      const status = d.status?.toLowerCase()
                      const fact = d.fact_check_status?.toLowerCase()
                      const Icon = d.icon ?? FileText
                      return (
                        <tr key={d.id} className="align-top transition-colors hover:bg-canvas">
                          <td className="px-4">
                            <Checkbox checked={selected.has(d.id)} onChange={() => togglePick(d.id)} aria-label={`Select ${d.topic}`} />
                          </td>
                          <td className="!text-left">
                            <div className="flex items-start gap-3">
                              <IconBox icon={Icon} tone={d.icon_tone} size="md" />
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold leading-snug">{d.topic}</div>
                                {d.preview && <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink/60">{d.preview}</p>}
                                <div className="mt-1 text-[11px] text-ink/45">
                                  ID: {d.id} · {d.created_mode}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="min-w-[176px] px-2">
                            <div className="flex flex-wrap justify-center gap-1">
                              {(d.tags ?? []).slice(0, 6).map((t) => (
                                <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">
                                  {t}
                                </span>
                              ))}
                              {!(d.tags ?? []).length && <span className="text-[12px] text-ink/40">—</span>}
                            </div>
                          </td>
                          <td className="px-2">
                            <div className="text-[13px] font-medium">{d.style_preset}</div>
                            <div className="mt-0.5 text-[11px] uppercase text-ink/50">{d.language}</div>
                          </td>
                          <td className="px-2">
                            <FormatIcons formats={d.formats ?? []} />
                          </td>
                          <td className="px-2">
                            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{labelize(d.status)}</Badge>
                            {d.status_sub && <div className="mt-1 text-[11px] text-ink/55">{d.status_sub}</div>}
                            {typeof d.progress === "number" && (
                              <div className="mt-1.5 flex items-center justify-center gap-2">
                                <ProgressBar value={d.progress} className="w-[70px]" />
                                <span className="text-[10px] text-ink/55">{d.progress}%</span>
                              </div>
                            )}
                          </td>
                          <td className="px-2">
                            <Badge tone={FACT_TONE[fact] ?? "neutral"}>{labelize(d.fact_check_status)}</Badge>
                            <div className="mt-1 text-[11px] text-ink/55">{d.fact_check_date || "—"}</div>
                            {fact === "issues_found" && (
                              <button
                                onClick={() => router.push(`/content/drafts/new?id=${d.id}`)}
                                className="mt-1 cursor-pointer rounded-chip bg-blush-dismiss px-2 py-0.5 text-[11px] font-semibold"
                              >
                                View Issues
                              </button>
                            )}
                          </td>
                          <td className="px-2">
                            <div className="text-[12px] font-medium">{d.updated_ago}</div>
                            <div className="mt-0.5 text-[11px] text-ink/55">{d.updated_label}</div>
                          </td>
                          <td className="px-2">
                            <div className="flex items-center justify-center gap-1">
                              <RowAction label="View" onClick={() => router.push(`/content/drafts/new?id=${d.id}`)}>
                                <Eye className="h-4 w-4" />
                              </RowAction>
                              <RowAction label="Edit" onClick={() => router.push(`/content/drafts/new?id=${d.id}`)}>
                                <Pencil className="h-4 w-4" />
                              </RowAction>
                              <RowAction label="Download PDF" onClick={() => onDownload(d.id, "pdf")}>
<FileDown className="h-4 w-4" />
</RowAction>
<RowAction label="Download PPTX" onClick={() => onDownload(d.id, "pptx")}>
<Presentation className="h-4 w-4" />
</RowAction>
<RowAction label="Delete" onClick={() => onDelete(d.id)}>
                                <Trash2 className="h-4 w-4" />
                              </RowAction>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
    </div>
  )
}

function FormatIcons({ formats }: { formats: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {formats.map((f) => {
        if (f.startsWith("+")) return <span key={f} className="text-[11px] font-medium text-ink/45">{f}</span>
        if (f === "pdf")
          return (
            <span key={f} className="grid h-[26px] place-items-center rounded-chip bg-blush-dismiss px-1.5 text-[10px] font-bold text-ink">
              PDF
            </span>
          )
        if (f === "calendar")
          return (
            <span key={f} className="grid h-[26px] w-[26px] place-items-center rounded-chip border border-line bg-white">
              <CalendarDays className="h-4 w-4 text-ink/70" />
            </span>
          )
        if (f === "file")
          return (
            <span key={f} className="grid h-[26px] w-[26px] place-items-center rounded-chip border border-line bg-white">
              <FileText className="h-4 w-4 text-ink/70" />
            </span>
          )
        return (
          <span key={f} className="grid h-[26px] w-[26px] place-items-center rounded-chip border border-line bg-white">
            <PlatformIcon type={f} className="h-4 w-4" />
          </span>
        )
      })}
    </div>
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

function labelize(s: string) {
  return (s ?? "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function safeDate(d: string, fmt: string) {
  try {
    return format(new Date(d), fmt)
  } catch {
    return "—"
  }
}

"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Pencil,
  Play,
  Plus,
  Power,
  X,
  XCircle,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { PlatformIcon, platformLabel } from "@/components/ui/platform-icon"
import { Field, Select } from "@/components/ui/forms"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { useSources, useParseSource, useCreateSource, useUpdateSource } from "@/lib/api/hooks"
import type { ContentSource } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TYPE_TABS = [
  { key: "all", label: "All Sources", count: 0 },
  { key: "telegram", label: "Telegram", count: 0 },
  { key: "twitter", label: "Twitter / X", count: 0 },
  { key: "rss", label: "RSS", count: 0 },
  { key: "youtube", label: "YouTube", count: 0 },
  { key: "other", label: "Other", count: 0 },
]
const KNOWN = new Set(["telegram", "twitter", "rss", "youtube"])

type Act = { ok: boolean; text: string; ago: string; sub?: string }
type SRow = {
  id: string
  source_type: string
  handle: string
  name: string
  status: "active" | "error" | "disabled"
  lastParsedAgo: string
  lastParsedDate: string
  lastPostAgo: string
  lastPostDate: string
  success: number
  errors: number
  description?: string
  language?: string
  postsParsed?: number
  duplicates?: string
  filteredOut?: string
  activity?: Act[]
}

const ACT: Act[] = [
  { ok: true, text: "Parsed successfully", ago: "3 minutes ago" },
  { ok: true, text: "Parsed successfully", ago: "18 minutes ago" },
  { ok: true, text: "Parsed successfully", ago: "33 minutes ago" },
  { ok: true, text: "Parsed successfully", ago: "48 minutes ago" },
  { ok: false, text: "Failed to parse", ago: "1 hour ago", sub: "Timeout while fetching messages" },
  { ok: true, text: "Parsed successfully", ago: "1 hour ago" },
]


function toRow(s: ContentSource): SRow {
  const status: SRow["status"] = s.error_count > 0 ? "error" : s.is_active ? "active" : "disabled"
  return {
    id: s.id,
    source_type: s.source_type,
    handle: s.source_id,
    name: s.display_name,
    status,
    lastParsedAgo: "—",
    lastParsedDate: "",
    lastPostAgo: "—",
    lastPostDate: "",
    success: s.error_count > 0 ? 0 : 100,
    errors: s.error_count,
    description: "High impact content source.",
    language: s.default_language?.toUpperCase() ?? "EN",
    postsParsed: s.total_posts_parsed,
    duplicates: "—",
    filteredOut: "—",
    activity: ACT,
  }
}

export default function SourcesPage() {
  const { data, isLoading, isError, error } = useSources()
  const parseOne = useParseSource()
  const createSrc = useCreateSource()
  const updateSrc = useUpdateSource()

  const sources: SRow[] = (data ?? []).map(toRow)

  const [tab, setTab] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ source_type: "telegram", source_id: "", display_name: "", default_language: "en" })

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sources.length, telegram: 0, twitter: 0, rss: 0, youtube: 0, other: 0 }
    for (const s of sources) {
      const t = s.source_type?.toLowerCase()
      if (KNOWN.has(t)) c[t] = (c[t] ?? 0) + 1
      else c.other += 1
    }
    return c
  }, [sources])

  const filtered = useMemo(() => {
    if (tab === "all") return sources
    if (tab === "other") return sources.filter((s) => !KNOWN.has(s.source_type?.toLowerCase()))
    return sources.filter((s) => s.source_type?.toLowerCase() === tab)
  }, [sources, tab])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const selected = sources.find((s) => s.id === selectedId) ?? null

  const openSource = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDrawerOpen(false)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }
  const onRun = (id: string) =>
    parseOne.mutate(id, {
      onSuccess: () => toast.success("Parse triggered"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Parse failed"),
    })
  const setActive = (id: string, active: boolean) =>
    updateSrc.mutate(
      { id, body: { is_active: active } },
      {
        onSuccess: () => toast.success(active ? "Source enabled" : "Source disabled"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      }
    )
  const openCreate = () => {
    setEditId(null)
    setForm({ source_type: "telegram", source_id: "", display_name: "", default_language: "en" })
    setModalOpen(true)
  }
  const openEdit = (s: SRow) => {
    setEditId(s.id)
    setForm({ source_type: s.source_type, source_id: s.handle, display_name: s.name, default_language: "en" })
    setModalOpen(true)
  }
  const submitForm = () => {
    if (!form.source_id.trim() || !form.display_name.trim()) {
      toast.error("Name and source ID required")
      return
    }
    const done = { onSuccess: () => { toast.success(editId ? "Source updated" : "Source added"); setModalOpen(false) }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed") }
    if (editId) updateSrc.mutate({ id: editId, body: { display_name: form.display_name, default_language: form.default_language } }, done)
    else createSrc.mutate(form, done)
  }

  // header stats
  const total = sources.length
  const active = sources.filter((s) => s.status === "active").length
  const errors = sources.filter((s) => s.status === "error").length
  const disabled = sources.filter((s) => s.status === "disabled").length

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Sources" subtitle="Manage content sources and monitor parsing health" />

      {/* tabs + add */}
      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <Tabs items={TYPE_TABS.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))} active={tab} onChange={setTab} />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Source
        </Button>
      </div>

      {/* stats bar */}
      <div className="mb-[16px] grid grid-cols-2 gap-[12px] sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Sources" value={String(total)} />
        <StatCard label="Active" value={String(active)} />
        <StatCard label="With Errors" value={String(errors)} valueClass="text-red-500" labelClass="text-red-500/80" />
        <StatCard label="Disabled" value={String(disabled)} />
        <StatCard label="Success Rate (7d)" value="98.7%" spark />
        <StatCard label="Last Parsed" value="3m ago" icon={Clock} />
      </div>

      <div className={cn("grid grid-cols-1 items-start gap-[16px]", selected && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
        {/* TABLE */}
        <div className="min-w-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No sources yet" hint="Add a source to start collecting posts." />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-2 py-3">Source</th>
                      <th className="px-2 py-3">Type</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Last Parsed</th>
                      <th className="px-2 py-3">Last Post</th>
                      <th className="px-2 py-3">Success Rate (7d)</th>
                      <th className="px-2 py-3">Error Count</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => openSource(s.id)}
                        className={cn("cursor-pointer align-middle transition-colors hover:bg-canvas", s.id === selectedId && "bg-lavender/10")}
                      >
                        <td className="!text-left">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas">
                              <PlatformIcon type={s.source_type} className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold">{s.name}</div>
                              <div className="truncate text-[11px] text-ink/50">{s.handle}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2">
                          <span className="rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink/70">{platformLabel(s.source_type)}</span>
                        </td>
                        <td className="px-2">
                          <Badge tone={s.status === "active" ? "success" : s.status === "error" ? "danger" : "neutral"}>{cap(s.status)}</Badge>
                        </td>
                        <td className="px-2">
                          <div className="text-[12px] font-medium">{s.lastParsedAgo}</div>
                          <div className="text-[11px] text-ink/50">{s.lastParsedDate}</div>
                        </td>
                        <td className="px-2">
                          <div className="text-[12px] font-medium">{s.lastPostAgo}</div>
                          <div className="text-[11px] text-ink/50">{s.lastPostDate}</div>
                        </td>
                        <td className="px-2">
                          <div className="text-[12px] font-semibold">{s.success}%</div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                            <div className={cn("h-full rounded-full", s.success >= 60 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${s.success}%` }} />
                          </div>
                        </td>
                        <td className={cn("px-2 text-center text-[13px] font-semibold", s.errors > 0 ? "text-red-500" : "text-ink/40")}>{s.errors}</td>
                        <td className="px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <RowAction label="Run parser" onClick={() => onRun(s.id)}><Play className="h-4 w-4" /></RowAction>
                            <RowAction label="Edit" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></RowAction>
                            <RowAction label={s.status === "disabled" ? "Enable" : "Disable"} onClick={() => setActive(s.id, s.status === "disabled")}><Power className="h-4 w-4" /></RowAction>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12px] text-ink/60">
                <span>Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} results</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <RowAction label="Prev" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronDown className="h-4 w-4 rotate-90" /></RowAction>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 3).map((n) => (
                      <button key={n} onClick={() => setPage(n)} className={cn("grid h-8 min-w-8 place-items-center rounded-card px-2 text-[12px] font-semibold", n === page ? "bg-lavender-text text-white" : "text-ink/65 hover:bg-line-soft")}>{n}</button>
                    ))}
                    <RowAction label="Next" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}><ChevronDown className="h-4 w-4 -rotate-90" /></RowAction>
                  </div>
                  <Select value={String(perPage)} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} className="w-[72px]">
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </Select>
                  <span>per page</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* SOURCE DETAILS — inline xl+ (only when selected) */}
        {selected && (
          <aside className="hidden xl:block">
            <SourceDetails source={selected} onClose={() => setSelectedId(null)} onRun={onRun} onEdit={openEdit} onSetActive={setActive} />
          </aside>
        )}
      </div>

      {/* SOURCE DETAILS — drawer below xl */}
      {drawerOpen && (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <SourceDetails source={selected} onClose={() => setDrawerOpen(false)} onRun={onRun} onEdit={openEdit} onSetActive={setActive} />
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        title={editId ? "Edit Source" : "Add Source"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} disabled={createSrc.isPending || updateSrc.isPending}>{editId ? "Save" : "Add Source"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Type">
            <Select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
              <option value="telegram">Telegram</option>
              <option value="twitter">Twitter / X</option>
              <option value="rss">RSS</option>
              <option value="youtube">YouTube</option>
              <option value="email">Email (IMAP)</option>
              <option value="web">Web Article</option>
            </Select>
          </Field>
          <Field label="Source ID / Handle / URL">
            <Input value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })} placeholder="@channel or https://…" disabled={!!editId} />
          </Field>
          <Field label="Display Name">
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Macro Alerts" />
          </Field>
          <Field label="Language">
            <Select value={form.default_language} onChange={(e) => setForm({ ...form, default_language: e.target.value })}>
              <option value="en">English</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value, valueClass, labelClass, spark, icon: Icon }: { label: string; value: string; valueClass?: string; labelClass?: string; spark?: boolean; icon?: typeof Clock }) {
  return (
    <Card className={cn("flex gap-2 p-4", spark ? "items-end" : "items-start justify-between")}>
      <div className={cn(spark && "shrink-0")}>
        <div className={cn("text-[24px] font-semibold leading-none", valueClass)}>{value}</div>
        <div className={cn("mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55", labelClass)}>{label}</div>
      </div>
      {spark && (
        <svg width="80" height="34" viewBox="0 0 80 34" preserveAspectRatio="none" className="h-[34px] w-full min-w-0 flex-1 self-center">
          <polyline points="0,26 13,23 26,24 40,13 53,17 66,7 80,10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {Icon && <Icon className="mt-1 h-4 w-4 shrink-0 text-ink/40" />}
    </Card>
  )
}

function SourceDetails({ source: s, onClose, onRun, onEdit, onSetActive }: { source: SRow | null; onClose: () => void; onRun: (id: string) => void; onEdit: (s: SRow) => void; onSetActive: (id: string, active: boolean) => void }) {
  if (!s) {
    return (
      <Panel title="Source Details" bodyClassName="py-6">
        <p className="text-[13px] text-ink/55">Select a source to see details.</p>
      </Panel>
    )
  }
  return (
    <Panel
      title="Source Details"
      action={<RowAction label="Close" onClick={onClose}><X className="h-4 w-4" /></RowAction>}
      bodyClassName="space-y-4 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas">
          <PlatformIcon type={s.source_type} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{s.name}</span>
            <Badge tone={s.status === "active" ? "success" : s.status === "error" ? "danger" : "neutral"} className="px-1.5 py-0 text-[10px]">{cap(s.status)}</Badge>
          </div>
          <div className="truncate text-[12px] text-ink/50">{s.handle}</div>
        </div>
        <Toggle checked={s.status !== "disabled"} onChange={(v) => onSetActive(s.id, v)} />
      </div>

      {s.description && (
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Description</div>
          <p className="text-[13px] text-ink/70">{s.description}</p>
        </div>
      )}
      <div className="text-[13px]"><span className="text-ink/55">Language: </span><span className="font-medium">{s.language}</span></div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Stats (7 Days)</div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat value={s.postsParsed != null ? s.postsParsed.toLocaleString() : "—"} label="Posts Parsed" />
          <MiniStat value={`${s.success}%`} label="Success Rate" />
          <MiniStat value={String(s.errors || 12)} label="Errors" />
          <MiniStat value={s.duplicates ?? "—"} label="Duplicates" />
          <MiniStat value={s.filteredOut ?? "—"} label="Filtered Out" />
          <MiniStat value={s.lastParsedAgo} label="Last Parsed" />
        </div>
      </div>

      {(s.activity?.length ?? 0) > 0 && (
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Recent Activity</div>
          <div className="space-y-2.5">
            {s.activity!.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                {a.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium">{a.text}</span>
                    <span className="shrink-0 text-[11px] text-ink/50">{a.ago}</span>
                  </div>
                  {a.sub && <div className="text-[11px] text-ink/55">{a.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Actions</div>
        <div className="space-y-2">
          <ActionRow icon={Play} label="Run Parser Now" onClick={() => onRun(s.id)} />
          <ActionRow icon={Pencil} label="Edit Source" onClick={() => onEdit(s)} />
          <ActionRow
            icon={Power}
            label={s.status === "disabled" ? "Enable Source" : "Disable Source"}
            danger={s.status !== "disabled"}
            onClick={() => onSetActive(s.id, s.status === "disabled")}
          />
        </div>
      </div>
    </Panel>
  )
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-line bg-canvas px-2.5 py-2 text-center">
      <div className="text-[15px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.03em] text-ink/50">{label}</div>
    </div>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick }: { icon: typeof Play; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-card border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
        danger ? "border-blush bg-blush-dismiss text-red-600 hover:brightness-95" : "border-line bg-white hover:bg-canvas"
      )}
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-chip", danger ? "bg-white/60" : "bg-line-soft")}>
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

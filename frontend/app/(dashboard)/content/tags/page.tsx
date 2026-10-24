"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  ChevronDown,
  Eye,
  Hash,
  Pencil,
  Plus,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Select, SearchInput, Field } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { Modal } from "@/components/ui/modal"
import { useTags, useDeleteTag, useCreateTag, useUpdateTag } from "@/lib/api/hooks"
import type { TagConfig } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SUBTABS = [
  { key: "all", label: "All Tags" },
  { key: "topic", label: "Topic Tags" },
  { key: "content", label: "Content Tags" },
  { key: "platform", label: "Platform Tags" },
  { key: "status", label: "Status Tags" },
]

const typeTone: Record<string, BadgeTone> = { topic: "info", content: "medium", platform: "warning", status: "neutral" }

type TRow = {
  id: string
  name: string
  display_name: string
  description: string
  type: "topic" | "content" | "platform" | "status"
  category: string
  usage: number
  trendUp: boolean
  firstUsed: string
  lastUsed: string
  languages: string[]
  status: "active" | "archived"
  related: string[]
}

const REL = ["prices", "cpi", "rates", "fed", "monetary-policy"]

function toRow(t: TagConfig): TRow {
  const r = t as TagConfig & Partial<TRow>
  const cat = (t.category ?? "topic").toLowerCase()
  const type: TRow["type"] = ["topic", "content", "platform", "status"].includes(cat) ? (cat as TRow["type"]) : "topic"
  return {
    id: t.id,
    name: t.tag_name,
    display_name: t.display_name,
    description: r.description ?? `Content tagged with ${t.display_name}.`,
    type,
    category: r.category ?? "Macro",
    usage: r.usage ?? 0,
    trendUp: r.trendUp ?? true,
    firstUsed: r.firstUsed ?? "—",
    lastUsed: r.lastUsed ?? "—",
    languages: r.languages ?? ["EN"],
    status: r.status ?? "active",
    related: r.related ?? REL,
  }
}

export default function TagsPage() {
  const { data, isLoading, isError, error } = useTags()
  const del = useDeleteTag()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()

  const tags: TRow[] = (data ?? []).map(toRow)

  const [subtab, setSubtab] = useState("all")
  const [search, setSearch] = useState("")
  const [catF, setCatF] = useState("all")
  const [langF, setLangF] = useState("all")
  const [sort, setSort] = useState("usage")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [perPage, setPerPage] = useState(12)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ tag_name: "", display_name: "", category: "topic", description: "" })

  const filtered = useMemo(() => {
    let rows = tags
    if (subtab !== "all") rows = rows.filter((t) => t.type === subtab)
    if (catF !== "all") rows = rows.filter((t) => t.category.toLowerCase() === catF)
    if (langF !== "all") rows = rows.filter((t) => t.languages.map((l) => l.toLowerCase()).includes(langF))
    if (search) rows = rows.filter((t) => t.display_name.toLowerCase().includes(search.toLowerCase()))
    const s = [...rows]
    if (sort === "usage") s.sort((a, b) => b.usage - a.usage)
    else if (sort === "name") s.sort((a, b) => a.display_name.localeCompare(b.display_name))
    return s
  }, [tags, subtab, catF, langF, search, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const selected = tags.find((t) => t.id === selectedId) ?? null

  const total = tags.length
  const active = tags.filter((t) => t.status === "active").length

  const openTag = (id: string) => {
    if (selectedId === id) { setSelectedId(null); setDrawerOpen(false) }
    else { setSelectedId(id); setDrawerOpen(true) }
  }
  const openCreate = () => { setEditId(null); setForm({ tag_name: "", display_name: "", category: "topic", description: "" }); setModalOpen(true) }
  const onDeleteTag = (t: TRow) => {
    if (!window.confirm(`Delete tag "${t.display_name}"? This cannot be undone.`)) return
    del.mutate(t.id, {
      onSuccess: () => {
        toast.success("Tag deleted")
        setSelectedId(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  }
  const openEdit = (t: TRow) => { setEditId(t.id); setForm({ tag_name: t.name, display_name: t.display_name, category: t.type, description: t.description }); setModalOpen(true) }
  const submit = () => {
    if (!form.display_name.trim()) { toast.error("Display name required"); return }
    const done = { onSuccess: () => { toast.success(editId ? "Tag updated" : "Tag created"); setModalOpen(false) }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed") }
    if (editId) updateTag.mutate({ id: editId, body: { display_name: form.display_name, category: form.category, description: form.description } }, done)
    else createTag.mutate({ tag_name: form.tag_name || form.display_name.toLowerCase().replace(/\s+/g, "_"), display_name: form.display_name, category: form.category, description: form.description || null }, done)
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Tags" subtitle="Organize and manage tags used across your content" />

      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <Tabs items={SUBTABS} active={subtab} onChange={setSubtab} />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create Tag
        </Button>
      </div>

      {/* stats */}
      <div className="mb-[16px] grid grid-cols-2 gap-[12px] sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Tags" value={String(total)} />
        <StatCard label="Active" value={String(active)} />
        <StatCard label="Archived" value="12" />
        <StatCard label="Unused" value="18" />
        <Card className="flex items-end gap-2 p-4">
          <div className="shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">Usage (30d)</div>
            <div className="mt-1 text-[24px] font-semibold leading-none">2,431</div>
          </div>
          <svg viewBox="0 0 80 34" preserveAspectRatio="none" className="h-[34px] w-full min-w-0 flex-1 self-center">
            <polyline points="0,26 13,23 26,24 40,13 53,17 66,7 80,10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </Card>
      </div>

      <div className={cn("grid grid-cols-1 items-start gap-[16px]", selected && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-[16px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-[240px]">
              <SearchInput placeholder="Search tags…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={catF} onChange={(e) => setCatF(e.target.value)} className="w-[150px]">
                <option value="all">All Categories</option>
                <option value="macro">Macro</option>
                <option value="markets">Markets</option>
                <option value="format">Format</option>
              </Select>
              <Select value={langF} onChange={(e) => setLangF(e.target.value)} className="w-[150px]">
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="ru">Russian</option>
              </Select>
              <span className="flex items-center gap-2 text-[13px] text-ink/65">
                Sort by:
                <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[170px]">
                  <option value="usage">Usage (High to Low)</option>
                  <option value="name">Name</option>
                </Select>
              </span>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No tags" hint="Tags are created from content analysis or manually." />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-2 py-3">Tag</th>
                      <th className="px-2 py-3">Type</th>
                      <th className="px-2 py-3">Category</th>
                      <th className="px-2 py-3">Usage (30d)</th>
                      <th className="px-2 py-3">Trend</th>
                      <th className="px-2 py-3">First Used</th>
                      <th className="px-2 py-3">Last Used</th>
                      <th className="px-2 py-3">Languages</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((t) => (
                      <tr key={t.id} onClick={() => openTag(t.id)} className={cn("cursor-pointer align-middle transition-colors hover:bg-canvas", t.id === selectedId && "bg-lavender/10")}>
                        <td className="!text-left">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-card bg-lavender"><Hash className="h-4 w-4 text-ink/70" /></span>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold">{t.display_name}</div>
                              <div className="truncate text-[11px] text-ink/50">{t.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2"><Badge tone={typeTone[t.type]} className="capitalize">{t.type}</Badge></td>
                        <td className="px-2"><span className="rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink/70">{t.category}</span></td>
                        <td className="text-[13px] font-semibold">{t.usage}</td>
                        <td className="px-2"><div className="flex justify-center"><Sparkline up={t.trendUp} small /></div></td>
                        <td className="px-2 text-[12px] text-ink/60">{t.firstUsed}</td>
                        <td className="px-2 text-[12px] text-ink/60">{t.lastUsed}</td>
                        <td className="px-2">
                          <div className="flex flex-wrap justify-center gap-1">
                            {t.languages.slice(0, 2).map((l) => (
                              <span key={l} className="rounded-chip bg-lavender px-1.5 py-0.5 text-[10px] font-semibold uppercase">{l}</span>
                            ))}
                            {t.languages.length > 2 && <span className="self-center text-[10px] text-ink/45">+{t.languages.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-2 text-center"><Badge tone={t.status === "active" ? "success" : "neutral"}>{cap(t.status)}</Badge></td>
                        <td className="px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <RowAction label="View" onClick={() => openTag(t.id)}><Eye className="h-4 w-4" /></RowAction>
                            <RowAction label="Edit" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></RowAction>
                            <RowAction label="Delete" onClick={() => onDeleteTag(t)}><Archive className="h-4 w-4" /></RowAction>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12px] text-ink/60">
                <span>Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} results</span>
                <div className="flex items-center gap-1">
                  <RowAction label="Prev" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronDown className="h-4 w-4 rotate-90" /></RowAction>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 5).map((n) => (
                    <button key={n} onClick={() => setPage(n)} className={cn("grid h-8 min-w-8 place-items-center rounded-card px-2 text-[12px] font-semibold", n === page ? "bg-lavender-text text-white" : "text-ink/65 hover:bg-line-soft")}>{n}</button>
                  ))}
                  <RowAction label="Next" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}><ChevronDown className="h-4 w-4 -rotate-90" /></RowAction>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* TAG DETAILS — inline xl+ (only when selected) */}
        {selected && (
          <aside className="hidden xl:block">
            <TagDetails tag={selected} onClose={() => setSelectedId(null)} onEdit={openEdit} onDelete={onDeleteTag} />
          </aside>
        )}
      </div>

      {/* drawer below xl */}
      {drawerOpen && (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <TagDetails tag={selected} onClose={() => setDrawerOpen(false)} onEdit={openEdit} onDelete={onDeleteTag} />
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        title={editId ? "Edit Tag" : "Create Tag"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createTag.isPending || updateTag.isPending}>{editId ? "Save" : "Create"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Display Name">
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="inflation" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="topic">Topic</option>
              <option value="content">Content</option>
              <option value="platform">Platform</option>
              <option value="status">Status</option>
            </Select>
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[24px] font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">{label}</div>
    </Card>
  )
}

function Sparkline({ up, small, className }: { up: boolean; small?: boolean; className?: string }) {
  const pts = up ? "0,14 8,12 16,13 24,7 32,9 40,4 48,5" : "0,4 8,6 16,5 24,9 32,8 40,12 48,14"
  const w = small ? 40 : 48
  const h = small ? 18 : 24
  return (
    <svg width={w} height={h} viewBox="0 0 48 18" className={cn("shrink-0", className)} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={up ? "#10b981" : "#ef4444"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UsageChart() {
  const bars = [30, 45, 40, 55, 60, 48, 70, 65, 80, 60, 90, 75, 85, 70, 95, 88, 100, 78, 92, 85]
  return (
    <svg viewBox="0 0 200 90" className="h-24 w-full" preserveAspectRatio="none">
      {bars.map((b, i) => (
        <rect key={i} x={i * 10 + 1} y={90 - (b / 100) * 80} width="7" height={(b / 100) * 80} rx="1" fill="#c9b3ff" />
      ))}
    </svg>
  )
}

function DStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-line bg-canvas px-2 py-2 text-center">
      <div className="text-[14px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.03em] text-ink/50">{label}</div>
    </div>
  )
}

function TagDetails({ tag: t, onClose, onEdit, onDelete }: { tag: TRow | null; onClose: () => void; onEdit: (t: TRow) => void; onDelete: (t: TRow) => void }) {
  if (!t) {
    return (
      <Panel title="Tag Details" bodyClassName="py-6">
        <p className="text-[13px] text-ink/55">Select a tag to see details.</p>
      </Panel>
    )
  }
  const langName: Record<string, string> = { EN: "English", RU: "Russian", JA: "Japanese", DE: "German" }
  return (
    <Panel
      title="Tag Details"
      action={<RowAction label="Close" onClick={onClose}><X className="h-4 w-4" /></RowAction>}
      bodyClassName="space-y-4 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-lavender"><Hash className="h-5 w-5 text-ink/70" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{t.display_name}</span>
            <Badge tone={t.status === "active" ? "success" : "neutral"} className="px-1.5 py-0 text-[10px]">{cap(t.status)}</Badge>
          </div>
          <div className="truncate text-[12px] capitalize text-ink/50">{t.type} Tag</div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Description</div>
        <p className="text-[13px] leading-normal text-ink/70">{t.description}</p>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Stats (30 Days)</div>
        <div className="grid grid-cols-4 gap-2">
          <DStat value={String(t.usage)} label="Posts" />
          <DStat value="12.4K" label="Mentions" />
          <DStat value="2.1M" label="Reach" />
          <DStat value={t.trendUp ? "↑ 18%" : "↓ 9%"} label="Trend" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Usage Over Time</div>
        <UsageChart />
        <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-ink/50">
          <span className="h-2 w-2 rounded-[2px] bg-[#c9b3ff]" /> Mentions
        </div>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Languages</div>
        <div className="space-y-1.5">
          {t.languages.map((l) => (
            <div key={l} className="flex items-center gap-2 text-[13px]">
              <span className="rounded-chip bg-line-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase">{l}</span>
              <span className="text-ink/70">{langName[l] ?? l}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Related Tags</div>
        <div className="flex flex-wrap gap-1.5">
          {t.related.map((r) => (
            <span key={r} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">{r}</span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <ActionRow icon={Pencil} label="Edit Tag" onClick={() => onEdit(t)} />
        <ActionRow icon={Archive} label="Delete Tag" danger onClick={() => onDelete(t)} />
      </div>
    </Panel>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick }: { icon: typeof Hash; label: string; danger?: boolean; onClick?: () => void }) {
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

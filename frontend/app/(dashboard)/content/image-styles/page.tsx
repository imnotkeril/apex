"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  BarChart3,
  ChevronDown,
  Eye,
  Grid3x3,
  Layers,
  LayoutGrid,
  List as ListIcon,
  Palette,
  Pencil,
  Plus,
  RectangleHorizontal,
  Square,
  Star,
  Sun,
  Type as TypeIcon,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Select, SearchInput, Field } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { Modal, Textarea } from "@/components/ui/modal"
import { useImageStyles, useCreateImageStyle, useUpdateImageStyle, useDeleteImageStyle } from "@/lib/api/hooks"
import type { ImageStylePreset } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SUBTABS = [
  { key: "all", label: "All Styles" },
  { key: "charts", label: "Charts & Data" },
  { key: "diagrams", label: "Diagrams" },
  { key: "photos", label: "Photos" },
  { key: "illustrations", label: "Illustrations" },
  { key: "custom", label: "Custom" },
]

type Preview = "dashboard" | "candles" | "flow" | "nodes" | "photo" | "iso" | "gradient" | "chart"
type Setting = { icon: LucideIcon; label: string; value: string }
type IRow = {
  id: string
  name: string
  display_name: string
  category: string
  catKey: string
  description: string
  preview: Preview
  used: number
  languages: string[]
  status: "active" | "draft" | "archived"
  updated: string
  is_default: boolean
  icon: LucideIcon
  settings: Setting[]
}

const SETTINGS: Setting[] = [
  { icon: Palette, label: "Color Scheme", value: "Purple" },
  { icon: Sun, label: "Background", value: "Light" },
  { icon: TypeIcon, label: "Typography", value: "Inter" },
  { icon: Grid3x3, label: "Grid System", value: "12 Column" },
  { icon: Square, label: "Corner Radius", value: "8px" },
  { icon: Layers, label: "Shadow", value: "Soft" },
  { icon: RectangleHorizontal, label: "Aspect Ratios", value: "16:9, 4:3, 1:1" },
]

const catTone: Record<string, string> = {
  charts: "bg-lavender", diagrams: "bg-lavender", photos: "bg-blush-soft", illustrations: "bg-orange-200", backgrounds: "bg-line-soft", custom: "bg-sprout",
}
const statusTone: Record<string, BadgeTone> = { active: "success", draft: "info", archived: "neutral" }


function toRow(s: ImageStylePreset): IRow {
  const r = s as ImageStylePreset & Partial<IRow>
  return {
    id: s.id,
    name: s.name,
    display_name: s.display_name,
    category: r.category ?? "Charts & Data",
    catKey: r.catKey ?? "charts",
    description: r.description ?? `${s.display_name} image style preset.`,
    preview: r.preview ?? "chart",
    used: r.used ?? 0,
    languages: r.languages ?? ["EN"],
    status: r.status ?? (s.is_active ? "active" : "draft"),
    updated: r.updated ?? "—",
    is_default: s.is_default,
    icon: r.icon ?? BarChart3,
    settings: r.settings ?? SETTINGS,
  }
}

export default function ImageStylesPage() {
  const { data, isLoading, isError, error } = useImageStyles()
  const createStyle = useCreateImageStyle()
  const updateStyle = useUpdateImageStyle()
  const deleteStyle = useDeleteImageStyle()

  const styles: IRow[] = (data ?? []).map(toRow)

  const [subtab, setSubtab] = useState("all")
  const [search, setSearch] = useState("")
  const [catF, setCatF] = useState("all")
  const [sort, setSort] = useState("updated")
  const [view, setView] = useState<"list" | "grid">("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: "", style_type: "charts", style_prompt: "", mood: "" })

  const filtered = useMemo(() => {
    let rows = styles
    if (subtab !== "all") rows = rows.filter((s) => s.catKey === subtab)
    if (catF !== "all") rows = rows.filter((s) => s.catKey === catF)
    if (search) rows = rows.filter((s) => s.display_name.toLowerCase().includes(search.toLowerCase()))
    return rows
  }, [styles, subtab, catF, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const selected = styles.find((s) => s.id === selectedId) ?? null

  const total = styles.length
  const active = styles.filter((s) => s.status === "active").length
  const draft = styles.filter((s) => s.status === "draft").length
  const archived = styles.filter((s) => s.status === "archived").length

  const openStyle = (id: string) => {
    if (selectedId === id) { setSelectedId(null); setDrawerOpen(false) }
    else { setSelectedId(id); setDrawerOpen(true) }
  }
  const openCreate = () => { setEditId(null); setForm({ display_name: "", style_type: "charts", style_prompt: "", mood: "" }); setModalOpen(true) }
  const onDeleteStyle = (s: IRow) => {
    if (!window.confirm(`Delete image style "${s.display_name}"? This cannot be undone.`)) return
    deleteStyle.mutate(s.id, {
      onSuccess: () => {
        toast.success("Style deleted")
        setSelectedId(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  }
  const openEdit = (s: IRow) => { setEditId(s.id); setForm({ display_name: s.display_name, style_type: s.catKey, style_prompt: "", mood: "" }); setModalOpen(true) }
  const submit = () => {
    if (!form.display_name.trim()) { toast.error("Name required"); return }
    const done = { onSuccess: () => { toast.success(editId ? "Style updated" : "Style created"); setModalOpen(false) }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed") }
    if (editId) updateStyle.mutate({ id: editId, body: { display_name: form.display_name, style_type: form.style_type, mood: form.mood } }, done)
    else {
      if (!form.style_prompt.trim()) { toast.error("Style prompt required"); return }
      createStyle.mutate({ name: form.display_name.toLowerCase().replace(/\s+/g, "_"), display_name: form.display_name, style_type: form.style_type, style_prompt: form.style_prompt, mood: form.mood || null }, done)
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Image Styles" subtitle="Manage visual styles and generation preferences for consistent imagery" />

      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <Tabs items={SUBTABS.map((t) => ({ ...t, count: t.key === "all" ? styles.length : styles.filter((s) => s.catKey === t.key).length }))} active={subtab} onChange={setSubtab} />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Style
        </Button>
      </div>

      {/* stats */}
      <div className="mb-[16px] grid grid-cols-2 gap-[12px] sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Styles" value={String(total)} />
        <StatCard label="Active" value={String(active)} />
        <StatCard label="Draft" value={String(draft)} />
        <StatCard label="Archived" value={String(archived)} />
        <Card className="flex items-end gap-2 p-4">
          <div className="shrink-0">
            <div className="text-[24px] font-semibold leading-none">92%</div>
            <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">Consistency Score</div>
          </div>
          <svg viewBox="0 0 80 34" preserveAspectRatio="none" className="h-[34px] w-full min-w-0 flex-1 self-center"><polyline points="0,26 13,23 26,24 40,13 53,17 66,7 80,10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
        </Card>
        <StatCard label="Images Generated (30d)" value="2.1K" />
      </div>

      <div className={cn("grid grid-cols-1 items-start gap-[16px]", selected && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-[16px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-[240px]">
              <SearchInput placeholder="Search image styles…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={catF} onChange={(e) => setCatF(e.target.value)} className="w-[150px]">
                <option value="all">All Categories</option>
                <option value="charts">Charts & Data</option>
                <option value="diagrams">Diagrams</option>
                <option value="photos">Photos</option>
                <option value="illustrations">Illustrations</option>
              </Select>
              <span className="flex items-center gap-2 text-[13px] text-ink/65">
                Sort by:
                <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[160px]">
                  <option value="updated">Updated (Newest)</option>
                  <option value="used">Used In</option>
                </Select>
              </span>
              <div className="flex overflow-hidden rounded-card border border-line">
                <ViewBtn active={view === "list"} onClick={() => setView("list")}><ListIcon className="h-4 w-4" /></ViewBtn>
                <ViewBtn active={view === "grid"} onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></ViewBtn>
              </div>
            </div>
          </div>

          {isLoading ? (
            <CardSkeleton count={6} />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No image styles" hint="Create a style to keep generated imagery consistent." />
          ) : view === "grid" ? (
            <div className="grid gap-[12px] sm:grid-cols-2 2xl:grid-cols-3">
              {pageRows.map((s) => (
                <Card key={s.id} onClick={() => openStyle(s.id)} className={cn("cursor-pointer overflow-hidden p-0 transition-colors hover:border-ink/20", s.id === selectedId && "border-lavender-text ring-1 ring-lavender-text")}>
                  <MiniPreview kind={s.preview} className="h-28 w-full" />
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold">{s.display_name}</span>
                      {s.is_default && <Star className="h-3.5 w-3.5 fill-lavender-text text-lavender-text" />}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn("rounded-chip px-2 py-0.5 text-[10px] font-semibold", catTone[s.catKey] ?? "bg-line-soft")}>{s.category}</span>
                      <Badge tone={statusTone[s.status]}>{cap(s.status)}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-2 py-3">Style</th>
                      <th className="px-2 py-3">Category</th>
                      <th className="px-2 py-3">Description</th>
                      <th className="px-2 py-3">Preview</th>
                      <th className="px-2 py-3">Used In</th>
                      <th className="px-2 py-3">Languages</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Updated</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((s) => {
                      const Icon = s.icon
                      return (
                        <tr key={s.id} onClick={() => openStyle(s.id)} className={cn("cursor-pointer align-middle transition-colors hover:bg-canvas", s.id === selectedId && "bg-lavender/10")}>
                          <td className="!text-left">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-lavender"><Icon className="h-5 w-5 text-ink/75" /></span>
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold">{s.display_name}</div>
                                <div className="truncate text-[11px] text-ink/50">{s.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2"><span className={cn("rounded-chip px-2 py-0.5 text-[11px] font-semibold", catTone[s.catKey] ?? "bg-line-soft")}>{s.category}</span></td>
                          <td className="!text-left"><p className="line-clamp-2 text-[12px] leading-snug text-ink/65">{s.description}</p></td>
                          <td className="px-2"><MiniPreview kind={s.preview} className="mx-auto h-12 w-[108px] rounded-card border border-line" /></td>
                          <td className="px-2 text-[12px] font-medium text-ink/70">{s.used} posts</td>
                          <td className="px-2">
                            <div className="flex flex-wrap justify-center gap-1">
                              {s.languages.slice(0, 3).map((l) => (
                                <span key={l} className="rounded-chip bg-lavender px-1.5 py-0.5 text-[10px] font-semibold uppercase">{l}</span>
                              ))}
                              {s.languages.length > 3 && <span className="self-center text-[10px] text-ink/45">+{s.languages.length - 3}</span>}
                            </div>
                          </td>
                          <td className="px-2 text-center"><Badge tone={statusTone[s.status]}>{cap(s.status)}</Badge></td>
                          <td className="px-2 text-[12px] text-ink/60">{s.updated}</td>
                          <td className="px-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <RowAction label="View" onClick={() => openStyle(s.id)}><Eye className="h-4 w-4" /></RowAction>
                              <RowAction label="Edit" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></RowAction>
                              <RowAction label="Delete" onClick={() => onDeleteStyle(s)}><Archive className="h-4 w-4" /></RowAction>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
                    <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="flex items-center gap-1 rounded-card px-2 py-1.5 font-semibold text-ink/65 hover:bg-line-soft">Next <ChevronDown className="h-4 w-4 -rotate-90" /></button>
                  </div>
                  <Select value={String(perPage)} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} className="w-[72px]">
                    <option value="10">10</option>
                    <option value="25">25</option>
                  </Select>
                  <span>per page</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* STYLE DETAILS — inline xl+ (only when selected) */}
        {selected && (
          <aside className="hidden xl:block">
            <StyleDetails style={selected} onClose={() => setSelectedId(null)} onEdit={openEdit} onDelete={onDeleteStyle} />
          </aside>
        )}
      </div>

      {/* drawer below xl */}
      {drawerOpen && (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <StyleDetails style={selected} onClose={() => setDrawerOpen(false)} onEdit={openEdit} onDelete={onDeleteStyle} />
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        title={editId ? "Edit Image Style" : "New Image Style"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createStyle.isPending || updateStyle.isPending}>{editId ? "Save" : "Create"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Display Name">
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Data Dashboard" />
          </Field>
          <Field label="Category">
            <Select value={form.style_type} onChange={(e) => setForm({ ...form, style_type: e.target.value })}>
              <option value="charts">Charts & Data</option>
              <option value="diagrams">Diagrams</option>
              <option value="photos">Photos</option>
              <option value="illustrations">Illustrations</option>
              <option value="backgrounds">Backgrounds</option>
            </Select>
          </Field>
          <Field label="Mood">
            <Input value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} placeholder="minimal, modern" />
          </Field>
          {!editId && (
            <Field label="Style Prompt">
              <Textarea value={form.style_prompt} onChange={(v) => setForm({ ...form, style_prompt: v })} rows={3} placeholder="clean minimal dashboard, purple accent…" />
            </Field>
          )}
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

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("grid h-9 w-9 cursor-pointer place-items-center transition-colors", active ? "bg-lavender text-ink" : "text-ink/55 hover:bg-line-soft")}>{children}</button>
  )
}

function MiniPreview({ kind, className }: { kind: Preview; className?: string }) {
  return (
    <div className={cn("overflow-hidden bg-canvas", className)}>
      <svg viewBox="0 0 120 60" preserveAspectRatio="none" className="h-full w-full">
        {kind === "dashboard" && (
          <>
            <rect x="4" y="4" width="52" height="22" rx="2" fill="#ede9fe" />
            <rect x="60" y="4" width="56" height="22" rx="2" fill="#f3f0ff" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={8 + i * 7} y={44 - (i % 4) * 5} width="4" height={12 + (i % 4) * 5} fill="#8d68ff" />)}
            <circle cx="98" cy="42" r="12" fill="none" stroke="#c9b3ff" strokeWidth="5" />
            <path d="M98 30 A12 12 0 0 1 108 46" fill="none" stroke="#8d68ff" strokeWidth="5" />
          </>
        )}
        {(kind === "candles" || kind === "chart") && (
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const up = i % 2 === 0
              return <g key={i}><line x1={12 + i * 13} y1={12 + i} x2={12 + i * 13} y2={48 - i} stroke="#9ca3af" strokeWidth="1" /><rect x={9 + i * 13} y={20 + (i % 3) * 4} width="6" height={12} fill={up ? "#10b981" : "#ef4444"} /></g>
            })}
          </>
        )}
        {kind === "flow" && (
          <>
            {[8, 48, 88].map((x, i) => <rect key={i} x={x} y="22" width="26" height="16" rx="4" fill="#d7c1ff" />)}
            <line x1="34" y1="30" x2="48" y2="30" stroke="#8d68ff" strokeWidth="1.5" /><line x1="74" y1="30" x2="88" y2="30" stroke="#8d68ff" strokeWidth="1.5" />
          </>
        )}
        {kind === "nodes" && (
          <>
            <line x1="30" y1="20" x2="60" y2="34" stroke="#c9b3ff" strokeWidth="1.5" /><line x1="60" y1="34" x2="92" y2="18" stroke="#c9b3ff" strokeWidth="1.5" /><line x1="60" y1="34" x2="78" y2="48" stroke="#c9b3ff" strokeWidth="1.5" />
            {[[30, 20], [60, 34], [92, 18], [78, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 1 ? 7 : 5} fill="#8d68ff" />)}
          </>
        )}
        {kind === "photo" && (
          <>
            <defs><linearGradient id="ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bcd4ff" /><stop offset="1" stopColor="#e9e2ff" /></linearGradient></defs>
            <rect x="0" y="0" width="120" height="60" fill="url(#ph)" /><polygon points="0,60 40,34 70,60" fill="#9db8e0" /><polygon points="55,60 90,40 120,60" fill="#7f9bd0" /><circle cx="98" cy="16" r="7" fill="#fff2c0" />
          </>
        )}
        {kind === "iso" && (
          <>
            {[[60, 20], [40, 34], [80, 34], [60, 48]].map(([x, y], i) => <polygon key={i} points={`${x},${y - 8} ${x + 16},${y} ${x},${y + 8} ${x - 16},${y}`} fill={["#d7c1ff", "#c9b3ff", "#ffd7dc", "#ccead2"][i]} stroke="#8d68ff" strokeWidth="0.5" />)}
          </>
        )}
        {kind === "gradient" && (
          <><defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d7c1ff" /><stop offset="0.5" stopColor="#ffd7dc" /><stop offset="1" stopColor="#bcd4ff" /></linearGradient></defs><rect x="0" y="0" width="120" height="60" fill="url(#gr)" /></>
        )}
      </svg>
    </div>
  )
}

function StyleDetails({ style: s, onClose, onEdit, onDelete }: { style: IRow | null; onClose: () => void; onEdit: (s: IRow) => void; onDelete: (s: IRow) => void }) {
  if (!s) {
    return <Panel title="Style Details" bodyClassName="py-6"><p className="text-[13px] text-ink/55">Select a style to see details.</p></Panel>
  }
  const Icon = s.icon
  return (
    <Panel
      title="Style Details"
      action={<RowAction label="Close" onClick={onClose}><X className="h-4 w-4" /></RowAction>}
      bodyClassName="space-y-4 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-lavender"><Icon className="h-5 w-5 text-ink/75" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{s.display_name}</span>
            <Badge tone={statusTone[s.status]} className="px-1.5 py-0 text-[10px]">{cap(s.status)}</Badge>
          </div>
          <div className="truncate text-[12px] text-ink/50">{s.name}</div>
        </div>
      </div>

      {s.is_default && (
        <span className="inline-flex items-center gap-1.5 rounded-chip bg-lavender px-2.5 py-1 text-[11px] font-semibold">
          <Star className="h-3.5 w-3.5 fill-lavender-text text-lavender-text" /> Default {s.category} Style
        </span>
      )}

      <div>
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Description</div>
        <p className="text-[13px] leading-normal text-ink/70">{s.description}</p>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Preview</div>
        <MiniPreview kind={s.preview} className="h-40 w-full rounded-card border border-line" />
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Settings</div>
        {s.settings.map((st) => (
          <div key={st.label} className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="flex items-center gap-2 text-ink/65"><st.icon className="h-4 w-4 text-ink/45" /> {st.label}</span>
            <span className="font-semibold">{st.value}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Used In</div>
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-semibold">{s.used} posts</span>
          <span className="text-[11px] text-ink/50">Last used: 2 hours ago</span>
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <ActionRow icon={Pencil} label="Edit Style" onClick={() => onEdit(s)} />
        <ActionRow icon={Archive} label="Delete Style" danger onClick={() => onDelete(s)} />
      </div>
    </Panel>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick }: { icon: LucideIcon; label: string; danger?: boolean; onClick?: () => void }) {
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

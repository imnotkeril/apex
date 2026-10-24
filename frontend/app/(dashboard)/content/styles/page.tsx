"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Gauge,
  LayoutList,
  Mic,
  PenLine,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Star,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Select, SearchInput, Field } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/states"
import { Modal, Textarea } from "@/components/ui/modal"
import { useStylePresets, useDuplicateStyle, useCreateStyle, useUpdateStyle, useDeleteStyle } from "@/lib/api/hooks"
import type { StylePreset } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SUBTABS = [{ key: "presets", label: "Style Presets" }]

type Settings = { tone: string; writing: string; length: string; complexity: string; format: string }
type PRow = {
  id: string
  name: string
  display_name: string
  description: string
  is_default: boolean
  language: string
  used: number
  status: "active" | "archived"
  updated: string
  tags: string[]
  icon: LucideIcon
  settings: Settings
  custom: string
}

const SET_A: Settings = { tone: "Analytical", writing: "Professional", length: "Long-form", complexity: "Advanced", format: "Structured" }
const CUSTOM_A = "Always include data points and cite sources when possible. Use charts and tables to support key arguments. End with actionable takeaways."


function toRow(s: StylePreset): PRow {
  const r = s as StylePreset & Partial<PRow>
  return {
    id: s.id,
    name: s.name,
    display_name: s.display_name,
    description: r.description || "Reusable AI style preset defining tone, format and rewrite rules for generation.",
    is_default: s.is_default,
    language: s.language?.toUpperCase() ?? "EN",
    used: r.used ?? 0,
    status: r.status ?? "active",
    updated: r.updated ?? "—",
    tags: r.tags?.length ? r.tags : ["style", "preset"],
    icon: r.icon ?? FileText,
    settings: r.settings ?? SET_A,
    custom: r.custom || CUSTOM_A,
  }
}

export default function StylesPage() {
  const { data, isLoading, isError, error, refetch } = useStylePresets()
  const dup = useDuplicateStyle()
  const createStyle = useCreateStyle()
  const updateStyle = useUpdateStyle()
  const deleteStyle = useDeleteStyle()

  const presets: PRow[] = (data ?? []).map(toRow)

  const [subtab, setSubtab] = useState("presets")
  const [search, setSearch] = useState("")
  const [statusF, setStatusF] = useState("all")
  const [langF, setLangF] = useState("all")
  const [sort, setSort] = useState("updated")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: "", language: "en", system_prompt: "", rewrite_instructions: "", temperature: 0.7 })

  const filtered = useMemo(() => {
    let rows = presets
    if (statusF !== "all") rows = rows.filter((p) => p.status === statusF)
    if (langF !== "all") rows = rows.filter((p) => p.language.toLowerCase() === langF)
    if (search) rows = rows.filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()))
    const sorted = [...rows]
    if (sort === "used") sorted.sort((a, b) => b.used - a.used)
    else if (sort === "name") sorted.sort((a, b) => a.display_name.localeCompare(b.display_name))
    return sorted
  }, [presets, statusF, langF, search, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)
  const selected = presets.find((p) => p.id === selectedId) ?? null

  const totalCount = presets.length
  const activeCount = presets.filter((p) => p.status === "active").length
  const archivedCount = presets.filter((p) => p.status === "archived").length
  const defaultCount = presets.filter((p) => p.is_default).length

  const openPreset = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDrawerOpen(false)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }
  const openCreate = () => {
    setEditId(null)
    setForm({ display_name: "", language: "en", system_prompt: "", rewrite_instructions: "", temperature: 0.7 })
    setModalOpen(true)
  }
  const openEdit = (p: PRow) => {
    setEditId(p.id)
    setForm({ display_name: p.display_name, language: p.language.toLowerCase(), system_prompt: "", rewrite_instructions: "", temperature: 0.7 })
    setModalOpen(true)
  }
  const submit = () => {
    if (!form.display_name.trim()) { toast.error("Name required"); return }
    const done = { onSuccess: () => { toast.success(editId ? "Preset updated" : "Preset created"); setModalOpen(false) }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed") }
    if (editId) updateStyle.mutate({ id: editId, body: { display_name: form.display_name, language: form.language } }, done)
    else {
      if (!form.system_prompt.trim()) { toast.error("System prompt required"); return }
      createStyle.mutate({ name: form.display_name.toLowerCase().replace(/\s+/g, "_"), display_name: form.display_name, language: form.language, system_prompt: form.system_prompt, rewrite_instructions: form.rewrite_instructions, temperature: form.temperature }, done)
    }
  }
  const onDuplicate = (id: string) => dup.mutate(id, { onSuccess: () => toast.success("Duplicated"), onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") })
  const onSetDefault = (p: PRow) => {
    if (p.is_default) return
    updateStyle.mutate(
      { id: p.id, body: { is_default: true } },
      {
        onSuccess: () => toast.success(`"${p.display_name}" set as default`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      }
    )
  }
  const onArchive = (p: PRow) => {
    if (!window.confirm(`Delete preset "${p.display_name}"? This cannot be undone.`)) return
    deleteStyle.mutate(p.id, {
      onSuccess: () => {
        toast.success("Preset deleted")
        setSelectedId(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Styles & Presets" subtitle="Define content style presets and formatting rules for AI generation" />

      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <Tabs items={SUBTABS} active={subtab} onChange={setSubtab} />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create New Preset
        </Button>
      </div>

      <div className={cn("grid grid-cols-1 items-start gap-[16px]", selected && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-[16px]">
          {/* stats + create */}
          <div className="flex flex-wrap items-stretch gap-[12px]">
            <StatCard label="Total Presets" value={String(totalCount)} />
            <StatCard label="Active" value={String(activeCount)} />
            <StatCard label="Archived" value={String(archivedCount)} />
            <StatCard label="Default" value={String(defaultCount)} />
            <Card className="flex flex-1 items-center justify-between gap-3 p-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">Last Updated</div>
                <div className="mt-1 text-[18px] font-semibold leading-none">2m ago</div>
              </div>
              <button
                onClick={() => refetch()}
                aria-label="Refresh presets"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-card text-ink/55 hover:bg-line-soft hover:text-ink"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </Card>
          </div>

          {/* filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-[260px]">
              <SearchInput placeholder="Search presets…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-[150px]">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
              <Select value={langF} onChange={(e) => setLangF(e.target.value)} className="w-[150px]">
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="ru">Russian</option>
              </Select>
              <span className="flex items-center gap-2 text-[13px] text-ink/65">
                Sort by:
                <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[160px]">
                  <option value="updated">Updated (Newest)</option>
                  <option value="used">Used in Drafts</option>
                  <option value="name">Name</option>
                </Select>
              </span>
            </div>
          </div>

          {/* table */}
          {isLoading ? (
            <TableSkeleton />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No style presets" hint="Create a preset to control AI tone and format." />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left [&_td]:px-2 [&_td]:py-4 [&_td]:text-center [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-3 [&_th]:text-center">
                  <thead>
                    <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/55">
                      <th className="px-2 py-3">Preset</th>
                      <th className="px-2 py-3">Description</th>
                      <th className="px-2 py-3">Default</th>
                      <th className="px-2 py-3">Language</th>
                      <th className="px-2 py-3">Used in Drafts</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Updated</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft [&_td]:py-4">
                    {pageRows.map((p) => {
                      const Icon = p.icon
                      return (
                        <tr key={p.id} onClick={() => openPreset(p.id)} className={cn("cursor-pointer align-top transition-colors hover:bg-canvas", p.id === selectedId && "bg-lavender/10")}>
                          <td className="!text-left">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-lavender"><Icon className="h-5 w-5 text-ink/75" /></span>
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold">{p.display_name}</div>
                                <div className="truncate text-[11px] text-ink/50">{p.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="!text-left">
                            <p className="line-clamp-2 text-[12px] leading-snug text-ink/65">{p.description}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {p.tags.slice(0, 3).map((t) => (
                                <span key={t} className="rounded-chip bg-line-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink/60">{t}</span>
                              ))}
                              {p.tags.length > 3 && <span className="self-center text-[10px] text-ink/45">+{p.tags.length - 3}</span>}
                            </div>
                          </td>
                          <td className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onSetDefault(p)}
                              className="grid cursor-pointer place-items-center"
                              title={p.is_default ? "Default preset" : "Set as default"}
                            >
                              <Star className={cn("mx-auto h-4 w-4 transition-colors", p.is_default ? "fill-lavender-text text-lavender-text" : "text-ink/30 hover:text-lavender-text")} />
                            </button>
                          </td>
                          <td className="px-2 text-center">
                            <Badge tone="neutral">{p.language}</Badge>
                          </td>
                          <td className="px-2 text-center text-[13px] font-semibold">{p.used}</td>
                          <td className="px-2 text-center">
                            <Badge tone={p.status === "active" ? "success" : "neutral"}>{cap(p.status)}</Badge>
                          </td>
                          <td className="px-2 text-[12px] text-ink/65">{p.updated}</td>
                          <td className="px-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <RowAction label="View" onClick={() => openPreset(p.id)}><Eye className="h-4 w-4" /></RowAction>
                              <RowAction label="Edit" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></RowAction>
                              <RowAction label="Duplicate" onClick={() => onDuplicate(p.id)}><Copy className="h-4 w-4" /></RowAction>
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

        {/* PRESET DETAILS — inline xl+ (only when selected) */}
        {selected && (
          <aside className="hidden xl:block">
            <PresetDetails preset={selected} onClose={() => setSelectedId(null)} onEdit={openEdit} onDup={onDuplicate} onArchive={onArchive} />
          </aside>
        )}
      </div>

      {/* PRESET DETAILS — drawer below xl */}
      {drawerOpen && (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <PresetDetails preset={selected} onClose={() => setDrawerOpen(false)} onEdit={openEdit} onDup={onDuplicate} onArchive={onArchive} />
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        title={editId ? "Edit Preset" : "Create Style Preset"}
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
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Macro Analyst" />
          </Field>
          <Field label="Language">
            <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="en">English</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
            </Select>
          </Field>
          {!editId && (
            <>
              <Field label="System Prompt">
                <Textarea value={form.system_prompt} onChange={(v) => setForm({ ...form, system_prompt: v })} rows={3} placeholder="You are a financial analyst…" />
              </Field>
              <Field label="Rewrite Instructions">
                <Textarea value={form.rewrite_instructions} onChange={(v) => setForm({ ...form, rewrite_instructions: v })} rows={3} placeholder="Rewrite concisely…" />
              </Field>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1 p-4">
      <div className="text-[24px] font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">{label}</div>
    </Card>
  )
}

function SettingRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="flex items-center gap-2 text-ink/65"><Icon className="h-4 w-4 text-ink/45" /> {label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function PresetDetails({ preset: p, onClose, onEdit, onDup, onArchive }: { preset: PRow | null; onClose: () => void; onEdit: (p: PRow) => void; onDup: (id: string) => void; onArchive: (p: PRow) => void }) {
  if (!p) {
    return (
      <Panel title="Preset Details" bodyClassName="py-6">
        <p className="text-[13px] text-ink/55">Select a preset to see details.</p>
      </Panel>
    )
  }
  const Icon = p.icon
  return (
    <Panel
      title="Preset Details"
      action={<RowAction label="Close" onClick={onClose}><X className="h-4 w-4" /></RowAction>}
      bodyClassName="space-y-4 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-lavender"><Icon className="h-5 w-5 text-ink/75" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{p.display_name}</span>
            <Badge tone={p.status === "active" ? "success" : "neutral"} className="px-1.5 py-0 text-[10px]">{cap(p.status)}</Badge>
          </div>
          <div className="truncate text-[12px] text-ink/50">{p.name}</div>
        </div>
      </div>

      {p.is_default && (
        <span className="inline-flex items-center gap-1.5 rounded-chip bg-lavender px-2.5 py-1 text-[11px] font-semibold">
          <Star className="h-3.5 w-3.5 fill-lavender-text text-lavender-text" /> Default Preset
        </span>
      )}

      <div>
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Description</div>
        <p className="text-[13px] leading-normal text-ink/70">{p.description}</p>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Tags</div>
        <div className="flex flex-wrap gap-1.5">
          {p.tags.slice(0, 5).map((t) => (
            <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">{t}</span>
          ))}
          {p.tags.length > 5 && <span className="rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink/60">+{p.tags.length - 5}</span>}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Languages</div>
        <span className="rounded-chip bg-line-soft px-2 py-0.5 text-[12px] font-semibold">{p.language} {p.language === "RU" ? "Russian" : "English"}</span>
      </div>

      <div>
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Used in Drafts</div>
        <div className="text-[14px] font-semibold">{p.used} drafts</div>
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Settings</div>
        <SettingRow icon={Mic} label="Tone" value={p.settings.tone} />
        <SettingRow icon={PenLine} label="Writing Style" value={p.settings.writing} />
        <SettingRow icon={Ruler} label="Length" value={p.settings.length} />
        <SettingRow icon={Gauge} label="Complexity" value={p.settings.complexity} />
        <SettingRow icon={LayoutList} label="Format" value={p.settings.format} />
      </div>

      {p.custom && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Custom Instructions</div>
          <div className="rounded-card border border-line bg-canvas p-3 text-[12px] leading-normal text-ink/70">{p.custom}</div>
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-3">
        <ActionRow icon={Pencil} label="Edit Preset" onClick={() => onEdit(p)} />
        <ActionRow icon={Copy} label="Duplicate Preset" onClick={() => onDup(p.id)} />
        <ActionRow icon={Archive} label="Delete Preset" danger onClick={() => onArchive(p)} />
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

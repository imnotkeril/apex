"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TableSkeleton, ErrorState } from "@/components/ui/states"
import { Panel } from "@/components/ui/section"
import { Badge, statusTone } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { Select } from "@/components/ui/forms"
import { PlatformIcon, platformLabel } from "@/components/ui/platform-icon"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { useCalendar, useCancelCalendar, useRescheduleCalendar } from "@/lib/api/hooks"
import type { CalendarEntry } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

type CalRow = CalendarEntry & {
  title?: string
  preview?: string
  draft_title?: string
  created_label?: string
  created_by?: string
}

// platform → chip background (warm tints)
const platformBg: Record<string, string> = {
  telegram: "bg-lavender/40",
  linkedin: "bg-blush-soft/35",
  x: "bg-line-soft",
  twitter: "bg-line-soft",
  email: "bg-orange-100",
  internal: "bg-line-soft",
  pdf: "bg-blush-dismiss",
  web: "bg-line-soft",
}
// status → left accent + legend dot
const statusBorder: Record<string, string> = {
  scheduled: "border-l-lavender-text",
  publishing: "border-l-amber-400",
  published: "border-l-emerald-500",
  failed: "border-l-red-500",
  cancelled: "border-l-zinc-400",
}
const statusDot: Record<string, string> = {
  scheduled: "bg-lavender-text",
  publishing: "bg-amber-400",
  published: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-zinc-400",
}

export default function CalendarPage() {
  const router = useRouter()
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState("month")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [platformF, setPlatformF] = useState("all")
  const [langF, setLangF] = useState("all")
  const [statusF, setStatusF] = useState("all")
  const [rescheduleFor, setRescheduleFor] = useState<CalRow | null>(null)
  const [rescheduleAt, setRescheduleAt] = useState("")

  const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  const { data, isLoading, isError, error } = useCalendar({ date_from: from.toISOString(), date_to: to.toISOString() })

  const cancel = useCancelCalendar()
  const reschedule = useRescheduleCalendar()
  const allEntries = useMemo(() => (data ?? []) as CalRow[], [data])
  const entries = useMemo(
    () =>
      allEntries.filter((e) => {
        if (platformF !== "all" && !(e.platforms ?? []).includes(platformF)) return false
        if (langF !== "all" && !(e.languages ?? []).map((l) => l.toLowerCase()).includes(langF)) return false
        if (statusF !== "all" && (e.status ?? "scheduled").toLowerCase() !== statusF) return false
        return true
      }),
    [allEntries, platformF, langF, statusF]
  )
  const selected = entries.find((e) => e.id === selectedId) ?? null

  const platformOptions = useMemo(() => Array.from(new Set(allEntries.flatMap((e) => e.platforms ?? []))).sort(), [allEntries])
  const langOptions = useMemo(
    () => Array.from(new Set(allEntries.flatMap((e) => (e.languages ?? []).map((l) => l.toLowerCase())))).sort(),
    [allEntries]
  )

  const openReschedule = (e: CalRow) => {
    setRescheduleFor(e)
    setRescheduleAt(format(new Date(e.scheduled_at), "yyyy-MM-dd'T'HH:mm"))
  }
  const submitReschedule = () => {
    if (!rescheduleFor || !rescheduleAt) return
    reschedule.mutate(
      { id: rescheduleFor.id, scheduled_at: new Date(rescheduleAt).toISOString() },
      {
        onSuccess: () => {
          toast.success("Rescheduled")
          setRescheduleFor(null)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      }
    )
  }

  const monthDays = useMemo(() => {
    const arr: Date[] = []
    let d = from
    while (d <= to) {
      arr.push(d)
      d = new Date(d.getTime() + 86400000)
    }
    return arr
  }, [from, to])

  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => new Date(s.getTime() + i * 86400000))
  }, [cursor])

  const byDay = (day: Date) =>
    entries
      .filter((e) => isSameDay(new Date(e.scheduled_at), day))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const openEvent = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDrawerOpen(false)
    } else {
      setSelectedId(id)
      setDrawerOpen(true)
    }
  }
  const step = (dir: number) => setCursor(view === "week" ? addWeeks(cursor, dir) : addMonths(cursor, dir))

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Content Calendar" subtitle="Schedule and manage your content across platforms" />

      {/* Toolbar */}
      <Card className="mb-[16px] flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            items={[
              { key: "month", label: "Month" },
              { key: "week", label: "Week" },
              { key: "list", label: "List" },
            ]}
            active={view}
            onChange={setView}
          />
          <div className="flex items-center gap-1">
            <RowAction label="Previous" onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </RowAction>
            <span className="min-w-[110px] text-center text-[14px] font-semibold">{format(cursor, "MMMM yyyy")}</span>
            <RowAction label="Next" onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </RowAction>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
          </div>
          <Select value={platformF} onChange={(e) => setPlatformF(e.target.value)} className="w-[150px]">
            <option value="all">All Platforms</option>
            {platformOptions.map((p) => (
              <option key={p} value={p}>{platformLabel(p)}</option>
            ))}
          </Select>
          <Select value={langF} onChange={(e) => setLangF(e.target.value)} className="w-[150px]">
            <option value="all">All Languages</option>
            {langOptions.map((l) => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </Select>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-[150px]">
            <option value="all">All Statuses</option>
            {["scheduled", "publishing", "published", "failed", "cancelled"].map((s) => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </Select>
        </div>
        <Button onClick={() => router.push("/content/drafts?status=ready")}>
          <Plus className="h-4 w-4" /> Schedule Content
        </Button>
      </Card>

      <div className={cn("grid grid-cols-1 items-start gap-[16px]", selected && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
        {/* CALENDAR */}
        <div className="min-w-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError && !data ? (
            <ErrorState error={error} />
          ) : (
          <Card className="overflow-hidden p-0">
            {entries.length === 0 && (
              <div className="border-b border-line px-4 py-3 text-xs text-ink/50">
                Nothing scheduled in this period. Schedule a draft to see it here.
              </div>
            )}
            {view === "list" ? (
              <ListView entries={entries} onSelect={openEvent} />
            ) : (
              <CalendarGrid
                days={view === "week" ? weekDays : monthDays}
                cursor={cursor}
                week={view === "week"}
                byDay={byDay}
                selectedId={selected?.id ?? null}
                onSelect={openEvent}
              />
            )}
            <Legend />
          </Card>
          )}
        </div>

        {/* DETAILS — inline on xl+ (only when an event is selected) */}
        {selected && (
          <aside className="hidden xl:block">
            <DetailPanel entry={selected} onClose={() => setSelectedId(null)} cancel={cancel} clear={() => setSelectedId(null)} onReschedule={openReschedule} />
          </aside>
        )}
      </div>

      {/* DETAILS — drawer below xl */}
      {drawerOpen && (
        <div className="xl:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-[92vw] overflow-y-auto bg-canvas p-3 shadow-drawer">
            <DetailPanel entry={selected} onClose={() => setDrawerOpen(false)} cancel={cancel} clear={() => setDrawerOpen(false)} onReschedule={openReschedule} />
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      <Modal
        open={!!rescheduleFor}
        title="Reschedule Post"
        onClose={() => setRescheduleFor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRescheduleFor(null)}>Cancel</Button>
            <Button onClick={submitReschedule} disabled={reschedule.isPending || !rescheduleAt}>Save</Button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="text-[13px] font-semibold">{rescheduleFor?.title ?? "Scheduled post"}</div>
          <Input
            type="datetime-local"
            value={rescheduleAt}
            onChange={(e) => setRescheduleAt(e.target.value)}
            aria-label="New date and time"
          />
        </div>
      </Modal>
    </div>
  )
}

function CalendarGrid({
  days,
  cursor,
  week,
  byDay,
  selectedId,
  onSelect,
}: {
  days: Date[]
  cursor: Date
  week: boolean
  byDay: (d: Date) => CalRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const maxShown = week ? 8 : 3
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2.5 text-center">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const items = byDay(day)
          const muted = !week && !isSameMonth(day, cursor)
          const isToday = items.some((e) => e.id === selectedId)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-b border-r border-line-soft p-1.5",
                week ? "min-h-[440px]" : "min-h-[122px]",
                (idx + 1) % 7 === 0 && "border-r-0",
                muted && "bg-canvas/60",
                isToday && "bg-lavender/10"
              )}
            >
              <div className="mb-1 flex justify-start px-0.5">
                <span
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-semibold",
                    isToday ? "bg-lavender-text text-white" : muted ? "text-ink/30" : "text-ink/70"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-1">
                {items.slice(0, maxShown).map((e) => (
                  <EventChip key={e.id} entry={e} selected={e.id === selectedId} onClick={() => onSelect(e.id)} />
                ))}
                {items.length > maxShown && (
                  <div className="px-1 text-[10px] font-medium text-ink/45">+{items.length - maxShown} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventChip({ entry: e, selected, onClick }: { entry: CalRow; selected: boolean; onClick: () => void }) {
  const platform = e.platforms?.[0] ?? "web"
  const status = (e.status ?? "scheduled").toLowerCase()
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-1.5 rounded-chip border-l-2 px-1.5 py-1 text-left transition-colors",
        platformBg[platform] ?? "bg-line-soft",
        statusBorder[status] ?? "border-l-lavender-text",
        selected && "ring-1 ring-lavender-text"
      )}
    >
      <PlatformIcon type={platform} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-1">
          <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{e.title}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-ink/55">{format(new Date(e.scheduled_at), "HH:mm")}</span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-ink/55">
          {platformLabel(platform)} · {(e.languages ?? []).join(", ")}
        </span>
      </span>
    </button>
  )
}

function ListView({ entries, onSelect }: { entries: CalRow[]; onSelect: (id: string) => void }) {
  const sorted = [...entries].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  return (
    <div className="divide-y divide-line-soft">
      {sorted.map((e) => {
        const platform = e.platforms?.[0] ?? "web"
        const status = (e.status ?? "scheduled").toLowerCase()
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className="grid w-full grid-cols-[120px_28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas"
          >
            <span className="text-[12px] font-medium text-ink/65">{format(new Date(e.scheduled_at), "MMM d, HH:mm")}</span>
            <PlatformIcon type={platform} className="h-4 w-4" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{e.title}</span>
              <span className="block truncate text-[11px] text-ink/55">{platformLabel(platform)} · {(e.languages ?? []).join(", ")}</span>
            </span>
            <span className={cn("h-2.5 w-2.5 rounded-full", statusDot[status] ?? "bg-lavender-text")} />
          </button>
        )
      })}
    </div>
  )
}

function Legend() {
  const platforms = ["telegram", "linkedin", "x", "email", "pdf", "internal"]
  const statuses = ["scheduled", "publishing", "published", "failed", "cancelled"]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-[11px] text-ink/60">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {platforms.map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <PlatformIcon type={p} className="h-3.5 w-3.5" /> {platformLabel(p)}
          </span>
        ))}
      </div>
      <span className="hidden h-4 w-px bg-line sm:block" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {statuses.map((s) => (
          <span key={s} className="flex items-center gap-1.5 capitalize">
            <span className={cn("h-2.5 w-2.5 rounded-full", statusDot[s])} /> {s}
          </span>
        ))}
      </div>
    </div>
  )
}

function DetailPanel({
  entry: e,
  onClose,
  cancel,
  clear,
  onReschedule,
}: {
  entry: CalRow | null
  onClose: () => void
  cancel: ReturnType<typeof useCancelCalendar>
  clear: () => void
  onReschedule: (e: CalRow) => void
}) {
  if (!e) {
    return (
      <Panel title="Scheduled Post" bodyClassName="py-6">
        <p className="text-[13px] text-ink/55">Select an event to see details.</p>
      </Panel>
    )
  }
  const platform = e.platforms?.[0] ?? "web"
  const status = (e.status ?? "scheduled").toLowerCase()
  const onCancel = () =>
    cancel.mutate(e.id, {
      onSuccess: () => {
        toast.success("Cancelled")
        clear()
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    })
  return (
    <Panel
      title={e.title ?? "Scheduled Post"}
      action={
        <RowAction label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </RowAction>
      }
      bodyClassName="space-y-4 py-4"
    >
      <Badge tone={statusTone(status)}>{cap(status)}</Badge>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <PlatformIcon type={platform} className="h-4 w-4" /> {platformLabel(platform)}
        </span>
        <span className="text-right text-[12px] text-ink/60">
          {format(new Date(e.scheduled_at), "MMM d, yyyy")}
          <br />
          {format(new Date(e.scheduled_at), "HH:mm")} UTC
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Languages</div>
        <div className="flex gap-1.5">
          {(e.languages ?? []).map((l) => (
            <span key={l} className="rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-semibold uppercase">{l}</span>
          ))}
        </div>
      </div>

      {e.draft_title && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Draft</div>
          <a href={`/content/drafts/new?id=${e.draft_id}`} className="flex items-center gap-1.5 text-[13px] font-medium text-lavender-text hover:underline">
            {e.draft_title} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {e.preview && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Preview</div>
          <div className="rounded-card border border-line bg-canvas p-3 text-[12px] leading-normal text-ink/70">
            {e.preview}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Platforms &amp; Languages</div>
        <span className="flex items-center gap-2 text-[13px]">
          <PlatformIcon type={platform} className="h-4 w-4" /> {platformLabel(platform)}
          <span className="text-ink/55">{(e.languages ?? []).join(", ")}</span>
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Status</div>
        <Badge tone={statusTone(status)}>{cap(status)}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-ink/50">Created</div>
          <div className="mt-0.5 text-ink/75">{e.created_label}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-ink/50">By</div>
          <div className="mt-0.5 text-ink/75">{e.created_by}</div>
        </div>
      </div>

      {e.error_message && (
        <div className="rounded-card border border-blush bg-blush-dismiss p-2.5 text-[12px] text-ink">{e.error_message}</div>
      )}

      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Actions</div>
        <div className="space-y-2">
          <ActionRow icon={Pencil} label="Edit Schedule" onClick={() => onReschedule(e)} />
          <ActionRow icon={CalendarDays} label="Reschedule" onClick={() => onReschedule(e)} />
          <ActionRow icon={FileText} label="Cancel Scheduled Post" danger onClick={onCancel} />
        </div>
      </div>
    </Panel>
  )
}

function ActionRow({
  icon: Icon,
  label,
  danger,
  onClick,
  trailing,
}: {
  icon: LucideIcon
  label: string
  danger?: boolean
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-card border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
        danger ? "border-blush bg-blush-dismiss hover:brightness-95" : "border-line bg-white hover:bg-canvas"
      )}
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-chip", danger ? "bg-white/60" : "bg-line-soft")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
      {trailing}
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

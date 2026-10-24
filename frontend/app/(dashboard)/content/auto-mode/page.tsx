"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Bot, Calendar, CheckCircle2, CircleSlash, Pencil, Plus, XCircle } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Tabs } from "@/components/ui/tabs"
import { Select } from "@/components/ui/forms"
import { PlatformIcon } from "@/components/ui/platform-icon"
import { Input } from "@/components/ui/input"
import { useAutoMode, useAutoModeActivity, useToggleAutoMode, useUpdateAutoMode } from "@/lib/api/hooks"
import type { AutoModeConfig, AutoModeRun } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "rules", label: "Rules" },
  { key: "activity", label: "Activity" },
  { key: "settings", label: "Settings" },
]

const statusTone: Record<string, BadgeTone> = { active: "success", off: "neutral" }

function describeRun(run: AutoModeRun): { label: string; tone: BadgeTone } {
  const pipeline = (run.pipeline_status ?? "").toLowerCase()
  if (run.outcome === "skipped") return { label: "Skipped", tone: "neutral" }
  if (run.draft_status === "published") return { label: "Published", tone: "success" }
  if (pipeline === "failed") return { label: "Failed", tone: "danger" }
  if (run.mode === "draft_only" && pipeline === "ready") return { label: "Awaiting review", tone: "warning" }
  return { label: "In progress", tone: "neutral" }
}

function ago(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export default function AutoModePage() {
  const { data } = useAutoMode()
  const activity = useAutoModeActivity()
  const toggle = useToggleAutoMode()
  const [tab, setTab] = useState("overview")
  const enabled = data?.is_enabled ?? false
  const runs = activity.data?.runs ?? []
  const stats = activity.data?.stats

  const onToggle = (v: boolean) =>
    toggle.mutate(v, {
      onSuccess: () => toast.success(v ? "Auto Mode enabled" : "Auto Mode disabled"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Auto Mode" subtitle="Automate content generation and publishing on the schedule and topic filter you configure" />

      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <Button onClick={() => setTab("settings")}>
          <Plus className="h-4 w-4" /> Configure Auto Mode
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-[16px]">
          {(tab === "overview" || tab === "settings") && (
            <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-card bg-lavender"><Bot className="h-5 w-5 text-ink/75" /></span>
                    <span className="text-[14px] font-semibold">Auto Mode</span>
                  </div>
                  <Toggle checked={enabled} onChange={onToggle} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Active" : "Off"}</Badge>
                </div>
              </Card>
              <MetricCard label="Drafts Generated (30d)" value={String(stats?.generated ?? 0)} />
              <MetricCard label="Published (30d)" value={String(stats?.published ?? 0)} />
              <MetricCard label="Success Rate (30d)" value={stats?.success_rate == null ? "—" : `${stats.success_rate}%`} />
            </div>
          )}

          {(tab === "overview" || tab === "rules") && (
            <RulesCard config={data ?? null} enabled={enabled} lastRun={runs[0]} onConfigure={() => setTab("settings")} />
          )}

          {(tab === "overview" || tab === "activity") && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em]">Auto Mode Activity</h2>
                {tab !== "activity" && runs.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setTab("activity")}>View All Activity</Button>
                )}
              </div>
              <RunList runs={tab === "activity" ? runs : runs.slice(0, 5)} loading={activity.isLoading} />
            </Card>
          )}

          {tab === "settings" && <AutoModeSettings config={data ?? null} />}
        </div>

        <aside className="hidden xl:block">
          <AutoDetails config={data ?? null} enabled={enabled} stats={stats} runs={runs} onViewActivity={() => setTab("activity")} />
        </aside>
      </div>
    </div>
  )
}

function RulesCard({
  config, enabled, lastRun, onConfigure,
}: {
  config: AutoModeConfig | null
  enabled: boolean
  lastRun?: AutoModeRun
  onConfigure: () => void
}) {
  const days = config?.publish_days?.length ? config.publish_days.map(cap).join(", ") : "Every day"
  const times = config?.publish_times?.length ? config.publish_times.join(", ") : "—"
  const topics = config?.allowed_tags?.length ? config.allowed_tags.join(", ") : "Any topic"
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em]">Auto Mode Rule</h2>
          <p className="text-[12px] text-ink/55">What is generated, when, and where it is published</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onConfigure}>
          <Pencil className="h-3.5 w-3.5" /> Configure
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 border-t border-line px-4 py-4 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">Schedule</div>
          <div className="flex items-start gap-1.5">
            <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" />
            <div>
              <div className="font-medium">{times} {config?.timezone ?? "UTC"}</div>
              <div className="text-[11px] text-ink/55">{days} · max {config?.max_posts_per_day ?? 0}/day</div>
            </div>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">Topics</div>
          <div className="font-medium">{topics}</div>
          <div className="text-[11px] text-ink/55">min {config?.min_source_count ?? 0} sources · no repeat for {config?.avoid_repeat_hours ?? 0}h</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">Mode &amp; Channels</div>
          <div className="mb-1 font-medium">{config?.mode === "draft_only" ? "Draft only (human review)" : "Full auto (publishes)"}</div>
          <Channels list={config?.publish_to ?? []} />
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">Status</div>
          <Badge tone={statusTone[enabled ? "active" : "off"]}>{enabled ? "Active" : "Off"}</Badge>
          <div className="mt-1 text-[11px] text-ink/55">{lastRun ? `Last run ${ago(lastRun.ran_at)}` : "No runs yet"}</div>
        </div>
      </div>
    </Card>
  )
}

function RunList({ runs, loading }: { runs: AutoModeRun[]; loading: boolean }) {
  if (loading) return <div className="border-t border-line px-4 py-6 text-center text-[13px] text-ink/55">Loading…</div>
  if (!runs.length)
    return (
      <div className="border-t border-line px-4 py-6 text-center text-[13px] text-ink/55">
        No runs yet. Runs appear here when Auto Mode reaches a scheduled slot.
      </div>
    )
  return (
    <ul className="divide-y divide-line-soft border-t border-line">
      {runs.map((r) => {
        const d = describeRun(r)
        const Icon = r.outcome === "skipped" ? CircleSlash : d.tone === "danger" ? XCircle : CheckCircle2
        return (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <Icon className={cn("h-4 w-4 shrink-0", d.tone === "danger" ? "text-red-500" : r.outcome === "skipped" ? "text-ink/40" : "text-emerald-500")} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{r.topic ?? r.reason ?? "Skipped slot"}</div>
              {r.topic && r.reason && <div className="truncate text-[11px] text-ink/55">{r.reason}</div>}
              {!r.topic && r.reason && <div className="text-[11px] text-ink/55">Slot skipped</div>}
            </div>
            <Channels list={r.platforms} />
            <Badge tone={d.tone}>{d.label}</Badge>
            <span className="w-24 shrink-0 text-right text-[11px] text-ink/55">{ago(r.ran_at)}</span>
          </li>
        )
      })}
    </ul>
  )
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const PLATFORMS = ["telegram", "twitter", "linkedin", "email"] as const

function AutoModeSettings({ config }: { config: AutoModeConfig | null }) {
  const update = useUpdateAutoMode()
  const [times, setTimes] = useState(config?.publish_times?.join(", ") ?? "09:00, 18:00")
  const [days, setDays] = useState<string[]>(config?.publish_days ?? [])
  const [maxPosts, setMaxPosts] = useState(String(config?.max_posts_per_day ?? 2))
  const [tags, setTags] = useState(config?.allowed_tags?.join(", ") ?? "")
  const [mode, setMode] = useState(config?.mode ?? "full_auto")
  const [platforms, setPlatforms] = useState<string[]>(config?.publish_to ?? ["telegram"])

  const flipIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const save = () =>
    update.mutate(
      {
        publish_times: times.split(",").map((t) => t.trim()).filter(Boolean),
        publish_days: days,
        max_posts_per_day: Math.max(1, parseInt(maxPosts, 10) || 1),
        allowed_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        mode,
        publish_to: platforms,
      },
      {
        onSuccess: () => toast.success("Auto Mode settings saved"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
      }
    )

  return (
    <Card className="space-y-5 p-5">
      <SettingBlock label="Mode" desc="Full auto publishes after a clean fact-check; Draft only stops at a ready draft for your review">
        <Select value={mode} onChange={(e) => setMode(e.target.value as AutoModeConfig["mode"])} className="w-[220px]">
          <option value="full_auto">Full auto (generate + publish)</option>
          <option value="draft_only">Draft only (review before publish)</option>
        </Select>
      </SettingBlock>

      <SettingBlock label="Days of Week" desc="When auto mode is allowed to run (none selected = every day)">
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDays((x) => flipIn(x, d))}
              className={cn(
                "rounded-chip border px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors",
                days.includes(d) ? "border-lavender-text bg-lavender text-ink" : "border-line text-ink/60 hover:bg-line-soft"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </SettingBlock>

      <SettingBlock label="Publish Times" desc="Comma-separated hours (org timezone), e.g. 09:00, 18:00">
        <Input value={times} onChange={(e) => setTimes(e.target.value)} className="max-w-[280px]" />
      </SettingBlock>

      <SettingBlock label="Max Posts Per Day" desc="Hard daily cap across all platforms">
        <Input type="number" min={1} value={maxPosts} onChange={(e) => setMaxPosts(e.target.value)} className="w-[100px]" />
      </SettingBlock>

      <SettingBlock label="Allowed Topics" desc="Comma-separated tags; empty = any topic (e.g. macro, crypto, ai)">
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="any topic" className="max-w-[360px]" />
      </SettingBlock>

      <SettingBlock label="Publish To" desc="Platforms auto mode publishes to (needs keys in Settings → Integrations)">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatforms((x) => flipIn(x, p))}
              className={cn(
                "flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors",
                platforms.includes(p) ? "border-lavender-text bg-lavender text-ink" : "border-line text-ink/60 hover:bg-line-soft"
              )}
            >
              <PlatformIcon type={p} className="h-3.5 w-3.5" /> {p}
            </button>
          ))}
        </div>
      </SettingBlock>

      <div className="flex justify-end border-t border-line-soft pt-4">
        <Button onClick={save} disabled={update.isPending}>Save Settings</Button>
      </div>
    </Card>
  )
}

function SettingBlock({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-semibold">{label}</div>
      <div className="mb-2 text-[11px] text-ink/55">{desc}</div>
      {children}
    </div>
  )
}

function Channels({ list }: { list: string[] }) {
  const shown = list.slice(0, 3)
  const extra = list.length - shown.length
  return (
    <div className="flex items-center gap-1">
      {shown.map((c) => (
        <span key={c} className="grid h-6 w-6 place-items-center rounded-full bg-canvas"><PlatformIcon type={c} className="h-3.5 w-3.5" /></span>
      ))}
      {extra > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-line-soft px-1 text-[10px] font-bold text-ink/60">+{extra}</span>}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink/55">{label}</div>
      <div className="mt-2 text-[24px] font-semibold leading-none">{value}</div>
    </Card>
  )
}

function AutoDetails({
  config, enabled, stats, runs, onViewActivity,
}: {
  config: AutoModeConfig | null
  enabled: boolean
  stats?: { generated: number; published: number; failed: number; skipped: number; success_rate: number | null }
  runs: AutoModeRun[]
  onViewActivity: () => void
}) {
  return (
    <Panel title="Auto Mode Details" bodyClassName="space-y-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-lavender"><Bot className="h-5 w-5 text-ink/75" /></span>
        <div className="text-[14px] font-semibold">Auto Mode is <span className={enabled ? "text-emerald-600" : "text-ink/55"}>{enabled ? "Active" : "Off"}</span></div>
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Guardrails</div>
        <div className="space-y-1.5">
          <GuardItem label="Fact check runs in every pipeline" />
          <GuardItem label={`Min. ${config?.min_source_count ?? 0} sources per topic`} />
          <GuardItem label={`No repeated topic for ${config?.avoid_repeat_hours ?? 0}h`} />
          <GuardItem label={`Daily cap: ${config?.max_posts_per_day ?? 0} posts`} />
          <GuardItem label={config?.mode === "draft_only" ? "Human review before publish" : "Publishes after a clean pipeline"} />
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Quick Stats (30d)</div>
        <QuickStat label="Drafts generated" value={String(stats?.generated ?? 0)} />
        <QuickStat label="Published" value={String(stats?.published ?? 0)} />
        <QuickStat label="Pipeline failures" value={String(stats?.failed ?? 0)} />
        <QuickStat label="Slots skipped" value={String(stats?.skipped ?? 0)} />
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Recent Activity</div>
        {runs.length === 0 ? (
          <div className="text-[12px] text-ink/55">Nothing yet.</div>
        ) : (
          <div className="space-y-2.5">
            {runs.slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.topic ?? "Skipped slot"}</span>
                <span className="shrink-0 text-[11px] text-ink/55">{describeRun(r).label}</span>
                <span className="shrink-0 text-[11px] text-ink/45">{ago(r.ran_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button className="w-full" onClick={onViewActivity}>
        <Bot className="h-4 w-4" /> View Full Activity
      </Button>
    </Panel>
  )
}

function GuardItem({ label }: { label: string }) {
  return <div className="flex items-center gap-1.5 text-[12px] text-ink/70"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {label}</div>
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="text-ink/65">{label}</span>
      <span className="font-semibold">{value}</span>
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

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

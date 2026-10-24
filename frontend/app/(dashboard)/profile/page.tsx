"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Award,
  BarChart3,
  Boxes,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  KeyRound,
  Mail,
  PenLine,
  Pencil,
  Ruler,
  Send,
  Shield,
  Sparkles,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Badge, statusTone, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { Select, Field } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { useDrafts, useMe, useMyActivity, useUpdateMe } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "preferences", label: "Preferences" },
  { key: "security", label: "Security" },
  { key: "api", label: "API & Integrations" },
  { key: "activity", label: "Activity" },
  { key: "notifications", label: "Notifications" },
]

const METRICS = [
  { icon: Boxes, value: "142", label: "Posts Created", delta: "+28%" },
  { icon: FileText, value: "47", label: "Drafts", delta: "+16%" },
  { icon: Users, value: "23", label: "Topics Owned", delta: "+35%" },
  { icon: Sparkles, value: "128", label: "AI Generations", delta: "+22%" },
  { icon: Clock, value: "32h 40m", label: "Time Saved", delta: "+26%" },
]

type Worked = { title: string; slug: string; tag: string; tone: BadgeTone; time: string; icon: LucideIcon; iconTone: string }
const WORKED: Worked[] = [
  { title: "Market Trend Analysis 2025", slug: "market-trends-2025", tag: "Topic Cluster", tone: "info", time: "Updated 2h ago", icon: BarChart3, iconTone: "bg-lavender" },
  { title: "Q2 Content Strategy", slug: "q2-content-strategy", tag: "Draft", tone: "low", time: "Updated 5h ago", icon: FileText, iconTone: "bg-blush-soft" },
  { title: "AI in Content Marketing", slug: "ai-content-marketing", tag: "Published", tone: "success", time: "Published 1d ago", icon: Send, iconTone: "bg-sprout" },
  { title: "Competitor Analysis Report", slug: "competitor-analysis", tag: "Draft", tone: "low", time: "Updated 1d ago", icon: BarChart3, iconTone: "bg-lavender" },
  { title: "Content Performance Review", slug: "content-performance-review", tag: "Analysis", tone: "warning", time: "Updated 2d ago", icon: FileText, iconTone: "bg-orange-200" },
]

const LANGUAGE_LABELS: Record<string, string> = { en: "English", ru: "Russian", ja: "Japanese", ko: "Korean", zh: "Chinese" }
const TONE_LABELS: Record<string, string> = { professional: "Professional", casual: "Casual", playful: "Playful", formal: "Formal", technical: "Technical" }
const STYLE_LABELS: Record<string, string> = { analytical: "Analytical", narrative: "Narrative", concise: "Concise", persuasive: "Persuasive" }
const LENGTH_LABELS: Record<string, string> = { short: "Short-form", medium: "Medium", long: "Long-form" }

function prefsOverview(preferences: Record<string, unknown> | undefined) {
  const p = preferences ?? {}
  const lang = String(p.default_language ?? "en")
  const tone = String(p.content_tone ?? "professional")
  const style = String(p.writing_style ?? "analytical")
  const length = String(p.default_length ?? "long")
  return [
    { icon: Globe, label: "Default Language", value: LANGUAGE_LABELS[lang] ?? lang },
    { icon: Pencil, label: "Content Tone", value: TONE_LABELS[tone] ?? tone },
    { icon: PenLine, label: "Writing Style", value: STYLE_LABELS[style] ?? style },
    { icon: Ruler, label: "Default Length", value: LENGTH_LABELS[length] ?? length },
  ]
}

const ACHIEVEMENTS = [
  { name: "Content Creator", desc: "Create 100 posts", date: "Mar 15, 2025", color: "#d7c1ff", icon: PenLine },
  { name: "Consistency Pro", desc: "7-day streak", date: "Apr 2, 2025", color: "#ffd98a", icon: Award },
  { name: "AI Power User", desc: "Generate 100 posts", date: "Apr 20, 2025", color: "#ccead2", icon: Sparkles },
]

const RECENT = [
  { action: "Created post", sub: "Market Trend Analysis 2025", ago: "2h ago" },
  { action: "Published post", sub: "AI in Content Marketing", ago: "1d ago" },
  { action: "Generated content", sub: "Q2 Content Strategy", ago: "1d ago" },
  { action: "Updated topic", sub: "Digital Marketing Trends", ago: "2d ago" },
  { action: "Added source", sub: "Statista - Digital 2025 Report", ago: "3d ago" },
]

export default function ProfilePage() {
  const { data: me } = useMe()
  const updateMe = useUpdateMe()
  const [tab, setTab] = useState("overview")
  const [editOpen, setEditOpen] = useState(false)
  const [fullName, setFullName] = useState("")

  const name = me?.full_name || "Yoshida"
  const initials = (me?.full_name || "Yoshida").slice(0, 2).toUpperCase()

  const openEdit = () => { setFullName(me?.full_name ?? "Yoshida"); setEditOpen(true) }
  const saveProfile = () =>
    updateMe.mutate({ full_name: fullName }, {
      onSuccess: () => { toast.success("Profile updated"); setEditOpen(false) },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    })

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Profile" subtitle="Manage your profile, preferences, and account settings" />

      <div className="mb-[16px]">
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        {/* LEFT — profile card */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-blush text-[22px] font-semibold text-ink">{initials}</span>
              <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-canvas text-ink/60"><Camera className="h-3 w-3" /></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[18px] font-semibold">{name}</span>
                <Badge tone="info" className="px-1.5 py-0 text-[10px]">Admin</Badge>
              </div>
              <div className="text-[13px] text-ink/55">@yoshida_org</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[13px] font-semibold">Organization Administrator</div>
            <p className="mt-1 text-[12px] leading-normal text-ink/60">Managing content strategy and AI workflows for Apex Org.</p>
          </div>

          <div className="mt-4 space-y-3 border-t border-line-soft pt-4">
            <InfoRow icon={Mail} label="Email" value={me?.email ?? "yoshida@apexorg.ai"} />
            <InfoRow icon={Shield} label="Role" value="Organization Admin" />
            <InfoRow icon={Award} label="Member Since" value="Jan 12, 2025" />
            <InfoRow icon={Clock} label="Last Active" value="Online now" online />
            <InfoRow icon={Globe} label="Language" value="English" />
            <InfoRow icon={Clock} label="Time Zone" value="(UTC) Coordinated Universal Time" />
          </div>

          <div className="mt-4 flex gap-2">
            <Button className="flex-1" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit Profile</Button>
          </div>
        </Card>

        {/* CENTER */}
        <div className="flex min-w-0 flex-col gap-[16px]">
          {tab === "overview" ? (
            <>
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em]">Your Activity Overview</h2>
                  <Select defaultValue="30" className="w-[140px]"><option value="30">Last 30 Days</option><option value="7">Last 7 Days</option></Select>
                </div>
                <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 xl:grid-cols-5">
                  {METRICS.map((m) => (
                    <div key={m.label} className="rounded-card border border-line-soft p-3">
                      <m.icon className="h-4 w-4 text-ink/45" />
                      <div className="mt-2 text-[22px] font-semibold leading-none">{m.value}</div>
                      <div className="mt-1.5 text-[11px] text-ink/55">{m.label}</div>
                      <div className="mt-1.5 text-[11px] font-semibold text-emerald-600">↑ {m.delta}</div>
                      <div className="text-[10px] text-ink/45">vs last 30 days</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em]">Recently Worked On</h2>
                  <Button variant="secondary" size="sm" onClick={() => setTab("activity")}>View All</Button>
                </div>
                <div className="divide-y divide-line-soft">
                  {WORKED.map((w) => (
                    <div key={w.slug} className="flex items-center gap-3 py-3">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-card", w.iconTone)}><w.icon className="h-5 w-5 text-ink/75" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{w.title}</span>
                          <Badge tone={w.tone} className="px-1.5 py-0 text-[10px]">{w.tag}</Badge>
                        </div>
                        <div className="truncate text-[11px] text-ink/50">{w.slug}</div>
                      </div>
                      <span className="shrink-0 text-[12px] text-ink/55">{w.time}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab("activity")} className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-[13px] font-semibold text-lavender-text hover:underline">View all recent activity →</button>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em]">Your Preferences</h2>
                </div>
                <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-4">
                  {prefsOverview(me?.preferences).map((p) => (
                    <div key={p.label} className="flex items-start gap-2 rounded-card border border-line-soft p-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-line-soft text-ink/55"><p.icon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.03em] text-ink/50">{p.label}</div>
                        <div className="truncate text-[12px] font-semibold">{p.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab("preferences")} className="mt-3 flex w-full items-center justify-center gap-1 py-1 text-[13px] font-semibold text-lavender-text hover:underline">View All Preferences →</button>
              </Card>
            </>
          ) : tab === "preferences" ? (
            <PreferencesTab />
          ) : tab === "activity" ? (
            <ActivityTab />
          ) : tab === "security" ? (
            <SecurityTab />
          ) : tab === "api" ? (
            <ApiTab />
          ) : tab === "notifications" ? (
            <NotificationsTab />
          ) : (
            <Card className="p-6 text-[13px] text-ink/60">
              <span className="font-semibold capitalize text-ink">{TABS.find((t) => t.key === tab)?.label}</span> section is coming soon.
            </Card>
          )}
        </div>

        {/* RIGHT */}
        <aside className="hidden 2xl:flex 2xl:flex-col 2xl:gap-[16px]">
          <Panel title="Account & Plan" bodyClassName="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-lavender text-[18px] font-semibold">A</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">Apex Org</span><Badge tone="success" className="px-1.5 py-0 text-[10px]">Active</Badge></div>
                <div className="text-[12px] text-ink/55">Team Admin</div>
              </div>
            </div>
            <a href="/content/settings?tab=team" className="block">
              <Button variant="secondary" className="w-full"><Users className="h-4 w-4" /> Manage Team</Button>
            </a>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">Current Plan</div>
              <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-semibold">Pro Plan</span><a href="/content/settings?tab=billing"><Button size="sm">Upgrade Plan</Button></a></div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]"><span className="text-ink/60">AI Credits (Monthly)</span><span className="text-ink/45">12%</span></div>
              <div className="text-[13px] font-semibold">1,240 / 10,000</div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-lavender-text" style={{ width: "12%" }} /></div>
              <div className="mt-1.5 text-[11px] text-ink/50">Next reset: June 1, 2025</div>
            </div>
          </Panel>

          <Panel title="Achievements" bodyClassName="py-4">
            <div className="grid grid-cols-3 gap-2">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.name} className="flex flex-col items-center text-center">
                  <span className="grid h-12 w-12 place-items-center text-ink/80" style={{ background: a.color, clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }}><a.icon className="h-5 w-5" /></span>
                  <div className="mt-1.5 text-[11px] font-semibold leading-tight">{a.name}</div>
                  <div className="text-[10px] leading-tight text-ink/50">{a.desc}</div>
                  <div className="mt-0.5 text-[10px] text-ink/40">{a.date}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Recent Activity" action={<button onClick={() => setTab("activity")} className="text-[12px] font-semibold text-lavender-text hover:underline">View All</button>} bodyClassName="py-4">
            <div className="space-y-3">
              {RECENT.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold">{r.action}</div>
                    <div className="truncate text-[11px] text-ink/55">{r.sub}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink/45">{r.ago}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setTab("activity")} className="mt-3 flex w-full items-center justify-center gap-1 py-1 text-[13px] font-semibold text-lavender-text hover:underline">View Full Activity →</button>
          </Panel>
        </aside>
      </div>

      <Modal
        open={editOpen}
        title="Edit Profile"
        onClose={() => setEditOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={saveProfile} disabled={updateMe.isPending}>Save</Button></>}
      >
        <div className="space-y-3">
          <Field label="Full Name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" /></Field>
          <Field label="Email"><Input value={me?.email ?? ""} disabled /></Field>
        </div>
      </Modal>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, online }: { icon: LucideIcon; label: string; value: string; online?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-[13px]">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
      <span className="w-[92px] shrink-0 text-ink/55">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        {online && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
        {value}
      </span>
    </div>
  )
}

// ── Local Settings-style helpers (mirrors content/settings/page.tsx patterns) ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink/70">{title}</h2>
      <Card className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2">{children}</div>
      </Card>
    </div>
  )
}

function RowShell({ icon: Icon, label, desc, children }: { icon: LucideIcon; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-card bg-line-soft text-ink/55"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{label}</div>
          <div className="text-[11px] text-ink/55">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function RowSelect({ icon, label, desc, value, onChange, children }: { icon: LucideIcon; label: string; desc: string; value?: string; onChange?: (v: string) => void; children: React.ReactNode }) {
  return (
    <RowShell icon={icon} label={label} desc={desc}>
      <Select className="w-[190px]" value={value} onChange={(e) => onChange?.(e.target.value)}>{children}</Select>
    </RowShell>
  )
}

function RowToggle({ icon, label, desc, checked, onChange }: { icon: LucideIcon; label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <RowShell icon={icon} label={label} desc={desc}>
      <Toggle checked={checked} onChange={onChange} />
    </RowShell>
  )
}

// ── Preferences tab: content generation defaults, persisted to user.preferences ──

function PreferencesTab() {
  const { data: me } = useMe()
  const updateMe = useUpdateMe()
  const p = (me?.preferences ?? {}) as Record<string, unknown>

  const save = (patch: Record<string, unknown>) =>
    updateMe.mutate(
      { preferences: { ...p, ...patch } },
      {
        onSuccess: () => toast.success("Preferences saved"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
      }
    )

  return (
    <Section title="Content Preferences">
      <RowSelect
        icon={Globe}
        label="Default Language"
        desc="Language used for new drafts and generation"
        value={String(p.default_language ?? "en")}
        onChange={(v) => save({ default_language: v })}
      >
        <option value="en">English</option>
        <option value="ru">Russian</option>
        <option value="ja">Japanese</option>
        <option value="ko">Korean</option>
        <option value="zh">Chinese</option>
      </RowSelect>
      <RowSelect
        icon={Pencil}
        label="Content Tone"
        desc="Default tone applied to generated drafts"
        value={String(p.content_tone ?? "professional")}
        onChange={(v) => save({ content_tone: v })}
      >
        <option value="professional">Professional</option>
        <option value="casual">Casual</option>
        <option value="playful">Playful</option>
        <option value="formal">Formal</option>
        <option value="technical">Technical</option>
      </RowSelect>
      <RowSelect
        icon={PenLine}
        label="Writing Style"
        desc="Default structural style for drafts"
        value={String(p.writing_style ?? "analytical")}
        onChange={(v) => save({ writing_style: v })}
      >
        <option value="analytical">Analytical</option>
        <option value="narrative">Narrative</option>
        <option value="concise">Concise</option>
        <option value="persuasive">Persuasive</option>
      </RowSelect>
      <RowSelect
        icon={Ruler}
        label="Default Length"
        desc="Default target length for new drafts"
        value={String(p.default_length ?? "long")}
        onChange={(v) => save({ default_length: v })}
      >
        <option value="short">Short-form</option>
        <option value="medium">Medium</option>
        <option value="long">Long-form</option>
      </RowSelect>
    </Section>
  )
}

// ── Activity tab: real counts + recent drafts ──

function ActivityStat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-card border border-line-soft p-4 text-center">
      <Icon className="mx-auto h-5 w-5 text-ink/45" />
      <div className="mt-2 text-[24px] font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] text-ink/55">{label}</div>
    </div>
  )
}

function ActivityTab() {
  const { data: activity } = useMyActivity()
  const { data: drafts } = useDrafts()
  const top5 = (drafts ?? []).slice(0, 5)

  return (
    <>
      <Card className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.04em]">Activity Overview</h2>
        <div className="grid grid-cols-3 gap-[12px]">
          <ActivityStat icon={FileText} value={activity?.drafts ?? 0} label="Drafts" />
          <ActivityStat icon={Send} value={activity?.published ?? 0} label="Published" />
          <ActivityStat icon={Users} value={activity?.topics ?? 0} label="Topics" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.04em]">Recent Drafts</h2>
        {top5.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink/50">No drafts yet.</p>
        ) : (
          <div className="divide-y divide-line-soft">
            {top5.map((d) => (
              <a
                key={d.id}
                href={`/content/drafts/new?id=${d.id}`}
                className="flex items-center gap-3 py-3 hover:bg-line-soft/40"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-lavender">
                  <FileText className="h-4 w-4 text-ink/75" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{d.topic}</div>
                  <Badge tone={statusTone(d.status)} className="mt-0.5 px-1.5 py-0 text-[10px]">{d.status}</Badge>
                </div>
                <span className="shrink-0 text-[12px] text-ink/55">{new Date(d.created_at).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

// ── Security tab: honest read-only auth info (no password stored) ──

function SecurityTab() {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.04em]">Authentication</h2>
      <div className="space-y-3 border-t border-line-soft pt-3">
        <InfoRow icon={Shield} label="Method" value="Google OAuth" />
        <InfoRow icon={Shield} label="Password" value="Not used — APEX never stores a password" />
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-ink/55">
        Sign-in is handled entirely by Google OAuth via Supabase Auth (a dev bypass exists for local
        development only). APEX does not store, process, or reset passwords for this account.
      </p>
    </Card>
  )
}

// ── API & Integrations tab: points to the real key-management screen ──

function ApiTab() {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-line-soft text-ink/55">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[14px] font-semibold">API Keys &amp; Integrations</div>
          <div className="text-[12px] text-ink/55">Manage provider keys (Anthropic, OpenAI, Telegram…) in workspace settings</div>
        </div>
      </div>
      <a href="/content/settings?tab=integrations">
        <Button variant="secondary"><ExternalLink className="h-4 w-4" /> Open Integrations</Button>
      </a>
    </Card>
  )
}

// ── Notifications tab: user-level delivery preferences (org settings drive actual sends) ──

const USER_NOTIF_ITEMS: { key: string; icon: LucideIcon; label: string; desc: string }[] = [
  { key: "draft_ready", icon: FileText, label: "Draft Ready", desc: "Notify me when a new draft finishes generation" },
  { key: "published", icon: Send, label: "Published", desc: "Notify me when a post is published" },
  { key: "pipeline_failed", icon: AlertTriangle, label: "Pipeline Failed", desc: "Notify me when the generation pipeline errors out" },
  { key: "budget_alert", icon: Sparkles, label: "Budget Alert (80%)", desc: "Notify me when daily AI spend crosses 80% of the budget" },
]

function NotificationsTab() {
  const { data: me } = useMe()
  const updateMe = useUpdateMe()
  const p = (me?.preferences ?? {}) as Record<string, unknown>
  const n = (p.notifications ?? {}) as Record<string, boolean>

  const flip = (key: string) => {
    const next = { draft_ready: true, published: true, pipeline_failed: true, budget_alert: true, ...n, [key]: !(n[key] !== false) }
    updateMe.mutate(
      { preferences: { ...p, notifications: next } },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
      }
    )
  }

  return (
    <>
      <Section title="Notification Preferences">
        {USER_NOTIF_ITEMS.map((item) => (
          <RowToggle
            key={item.key}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
            checked={n[item.key] !== false}
            onChange={() => flip(item.key)}
          />
        ))}
      </Section>
      <Card className="p-4 text-[12px] leading-relaxed text-ink/60">
        These are your personal delivery preferences. Actual Telegram delivery is controlled by your
        organization&apos;s notification settings in{" "}
        <a href="/content/settings?tab=notifications" className="font-semibold text-lavender-text hover:underline">
          Settings → Notifications
        </a>
        .
      </Card>
    </>
  )
}

"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Code2,
  Copy,
  Database,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Link2,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/section"
import { Tabs } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Select } from "@/components/ui/forms"
import { Input } from "@/components/ui/input"
import {
  useAiUsage,
  useIntegrations,
  useMe,
  useOrg,
  useOrgUsers,
  useTestNotification,
  useUpdateIntegrations,
  useUpdateOrg,
  useUpdateOrgUser,
} from "@/lib/api/hooks"
import { baseUrl as apiBaseUrl, contentDownload } from "@/lib/api/content"
import type { IntegrationStatus, OrgUser } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TABS = [
  { key: "general", label: "General" },
  { key: "ai", label: "AI & Generation" },
  { key: "content", label: "Content" },
  { key: "integrations", label: "Integrations" },
  { key: "team", label: "Team & Access" },
  { key: "billing", label: "Billing" },
  { key: "notifications", label: "Notifications" },
  { key: "advanced", label: "Advanced" },
]

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  )
}

function SettingsInner() {
  const { data: org } = useOrg()
  const updateOrg = useUpdateOrg()
  const params = useSearchParams()
  const initialTab = params.get("tab")
  const [tab, setTab] = useState(initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : "general")
  const [name, setName] = useState("Apex Org")
  const [toggles, setToggles] = useState({ duplicate: true, autosave: true, media: true, link: true, api: true, updates: true })

  useEffect(() => { if (org?.name) setName(org.name) }, [org])

  const flip = (k: keyof typeof toggles) => {
    setToggles((t) => ({ ...t, [k]: !t[k] }))
    updateOrg.mutate({ name, settings: { ...(org?.settings ?? {}), [k]: !toggles[k] } }, { onError: () => toast.error("Failed to save") })
  }
  const saveName = (next: string) => {
    if (!next.trim() || next === org?.name) return
    setName(next)
    updateOrg.mutate({ name: next }, {
      onSuccess: () => toast.success("Workspace name saved"),
      onError: () => toast.error("Failed to save"),
    })
  }
  const s = (org?.settings ?? {}) as Record<string, unknown>
  const saveSetting = (key: string, value: string) =>
    updateOrg.mutate({ settings: { [key]: value } }, {
      onSuccess: () => toast.success("Saved"),
      onError: () => toast.error("Failed to save"),
    })

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader title="Settings" subtitle="Configure your workspace, AI preferences, integrations, and system settings" />

      <div className="mb-[16px]">
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-[20px]">
          {tab === "general" ? (
            <>
              <Section title="Workspace Settings">
                <RowText icon={Building2} label="Workspace Name" desc="The name of your workspace" value={name} onSave={saveName} />
                <RowText icon={Link2} label="Workspace URL" desc="Your workspace's unique URL" value={`${org?.slug ?? "apexorg"}.contentengine.ai`} />
                <RowSelect icon={Languages} label="Default Language" desc="Primary language for content generation" value={String(s.default_language ?? "en")} onChange={(v) => saveSetting("default_language", v)}>
                  <option value="en">English (EN)</option><option value="ru">Russian (RU)</option>
                </RowSelect>
                <RowSelect icon={Clock} label="Time Zone" desc="Used for scheduling and timestamps" value={String(s.timezone ?? "UTC")} onChange={(v) => saveSetting("timezone", v)}>
                  <option value="UTC">(UTC) Coordinated Universal Time</option>
                  <option value="Asia/Tokyo">(UTC+9) Tokyo</option>
                  <option value="Europe/Moscow">(UTC+3) Moscow</option>
                </RowSelect>
                <RowSelect icon={Calendar} label="Date Format" desc="Preferred date display format" value={String(s.date_format ?? "mdy")} onChange={(v) => saveSetting("date_format", v)}>
                  <option value="mdy">May 8, 2025 (MMM D, YYYY)</option>
                  <option value="dmy">8 May 2025 (D MMM YYYY)</option>
                </RowSelect>
                <RowSelect icon={Clock} label="Time Format" desc="Preferred time display format" value={String(s.time_format ?? "24h")} onChange={(v) => saveSetting("time_format", v)}>
                  <option value="24h">24-hour (14:35)</option><option value="12h">12-hour (2:35 PM)</option>
                </RowSelect>
              </Section>

              <Section title="Content Settings">
                <RowSelect icon={FileText} label="Default Post Status" desc="Status for newly created posts" value={String(s.default_post_status ?? "draft")} onChange={(v) => saveSetting("default_post_status", v)}>
                  <option value="draft">Draft</option><option value="ready">Ready</option><option value="scheduled">Scheduled</option>
                </RowSelect>
                <RowToggle icon={Copy} label="Duplicate Detection" desc="Check for similar content automatically" checked={toggles.duplicate} onChange={() => flip("duplicate")} />
                <RowToggle icon={RefreshCw} label="Auto Save" desc="Automatically save drafts and changes" checked={toggles.autosave} onChange={() => flip("autosave")} />
                <RowToggle icon={ImageIcon} label="Media Optimization" desc="Optimize images and media automatically" checked={toggles.media} onChange={() => flip("media")} />
                <RowToggle icon={Link2} label="Link Checking" desc="Validate links and flag broken URLs" checked={toggles.link} onChange={() => flip("link")} />
              </Section>

              <Section title="System Settings">
                <RowSelect icon={Database} label="Data Retention" desc="How long to keep deleted items" value={String(s.data_retention ?? "30d")} onChange={(v) => saveSetting("data_retention", v)}>
                  <option value="30d">30 days</option><option value="90d">90 days</option><option value="1y">1 year</option>
                </RowSelect>
                <RowSelect icon={Download} label="Export Format" desc="Default format for exports" value={String(s.export_format ?? "md")} onChange={(v) => saveSetting("export_format", v)}>
                  <option value="md">Markdown (.md)</option><option value="html">HTML</option><option value="pdf">PDF</option>
                </RowSelect>
                <RowToggle icon={Code2} label="API Access" desc="Enable API access for this workspace" checked={toggles.api} onChange={() => flip("api")} />
                <RowToggle icon={RefreshCw} label="System Updates" desc="Receive automatic updates and improvements" checked={toggles.updates} onChange={() => flip("updates")} />
              </Section>
            </>
          ) : tab === "integrations" ? (
            <IntegrationsTab />
          ) : tab === "ai" ? (
            <AiTab />
          ) : tab === "team" ? (
            <TeamTab />
          ) : tab === "billing" ? (
            <BillingTab />
          ) : tab === "notifications" ? (
            <NotificationsTab />
          ) : tab === "advanced" ? (
            <AdvancedTab />
          ) : (
            <Card className="p-6 text-[13px] text-ink/60">
              <span className="font-semibold capitalize text-ink">{TABS.find((t) => t.key === tab)?.label}</span> settings are coming soon — this section is not configurable yet.
            </Card>
          )}
        </div>

        {/* ACCOUNT & PLAN */}
        <aside className="hidden xl:block">
          <AccountPanel orgName={name} onTab={setTab} />
        </aside>
      </div>
    </div>
  )
}

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

function RowText({ icon, label, desc, value, onSave }: { icon: LucideIcon; label: string; desc: string; value: string; onSave?: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => {
    setEditing(false)
    onSave?.(draft)
  }
  return (
    <RowShell icon={icon} label={label} desc={desc}>
      <div className="flex items-center gap-2">
        {editing ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") setEditing(false)
            }}
            autoFocus
            className="w-[180px]"
          />
        ) : (
          <span className="max-w-[180px] truncate text-[13px] font-medium">{value}</span>
        )}
        {onSave && !editing && (
          <button
            aria-label="Edit"
            onClick={() => {
              setDraft(value)
              setEditing(true)
            }}
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-card border border-line text-ink/55 hover:bg-line-soft"
          >
            <Pencil />
          </button>
        )}
      </div>
    </RowShell>
  )
}

function Pencil() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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

function AccountPanel({ orgName, onTab }: { orgName: string; onTab: (t: string) => void }) {
  return (
    <Panel title="Account & Plan" bodyClassName="space-y-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-blush text-[18px] font-semibold">{orgName.charAt(0)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{orgName}</span>
            <Badge tone="success" className="px-1.5 py-0 text-[10px]">Active</Badge>
          </div>
          <div className="text-[12px] text-ink/55">Team Admin</div>
        </div>
      </div>
      <Button variant="secondary" className="w-full" onClick={() => onTab("team")}><Users className="h-4 w-4" /> Manage Team</Button>

      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">Current Plan</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold">Pro Plan</span>
          <Button size="sm" onClick={() => onTab("billing")}>Upgrade Plan</Button>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[12px]">
          <span className="text-ink/60">AI Credits (Monthly)</span>
          <span className="text-ink/45">12%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">1,240 / 10,000</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-lavender-text" style={{ width: "12%" }} /></div>
        <div className="mt-1.5 text-[11px] text-ink/50">Next reset: June 1, 2025</div>
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">Security</div>
        <SecRow icon={Shield} label="Password" sub="Last changed 2 months ago" />
        <SecRow icon={Shield} label="Two-Factor Authentication" sub="Enabled" ok />
        <SecRow icon={Users} label="Sessions" sub="3 active sessions" />
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">System Information</div>
        <InfoRow label="Workspace ID" value="ws_3f2b8e7a9c4d" />
        <InfoRow label="Created" value="Jan 12, 2025" />
        <InfoRow label="Region" value="US East (N. Virginia)" />
        <InfoRow label="Version" value="v2.8.1" />
      </div>
    </Panel>
  )
}

function SecRow({ icon: Icon, label, sub, ok }: { icon: LucideIcon; label: string; sub: string; ok?: boolean }) {
  return (
    <div className="flex w-full items-center gap-3 py-2 text-left">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-card bg-line-soft text-ink/55"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[11px] text-ink/55">{sub}</div>
      </div>
      {ok && <Badge tone="success" className="px-1.5 py-0 text-[10px]">✓</Badge>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-ink/55">{label}</span>
      <span className="font-medium text-ink/80">{value}</span>
    </div>
  )
}

// ── Integrations tab: paste API keys directly in the app ──

const GROUP_TITLES: Record<string, string> = {
  ai: "AI Providers",
  publishing: "Publishing",
  sources: "Source Parsing",
}

const KEY_DESCRIPTIONS: Record<string, string> = {
  anthropic: "Content synthesis, styling and formatting (Claude)",
  openai: "Fallback LLM, embeddings, Whisper transcription, DALL-E images",
  perplexity: "Fact-checking and research (Sonar Pro)",
  grok: "Social monitoring via xAI",
  google_ai: "Gemini models and Imagen image generation",
  telegram_bot_token: "Bot used to publish posts to your channel",
  telegram_chat_id: "Channel or chat id the bot posts to (e.g. @mychannel)",
  twitter_api_key: "App consumer key from developer.x.com",
  twitter_api_secret: "App consumer secret",
  twitter_access_token: "User access token (write permissions)",
  twitter_access_secret: "User access token secret",
  linkedin_access_token: "OAuth token with w_member_social scope",
  linkedin_author_urn: "Author URN, e.g. urn:li:person:XXXX",
  telegram_api_id: "my.telegram.org API id for channel parsing",
  telegram_api_hash: "my.telegram.org API hash for channel parsing",
}

function IntegrationsTab() {
  const { data, isLoading } = useIntegrations()
  const update = useUpdateIntegrations()

  const groups = ["ai", "publishing", "sources"] as const
  if (isLoading || !data) {
    return <Card className="p-6 text-[13px] text-ink/60">Loading integrations…</Card>
  }
  return (
    <>
      {groups.map((g) => {
        const items = data.filter((i) => i.group === g)
        if (!items.length) return null
        return (
          <Section key={g} title={GROUP_TITLES[g]}>
            {items.map((item) => (
              <IntegrationRow
                key={item.key}
                item={item}
                onSave={(value) =>
                  update.mutate(
                    { [item.key]: value },
                    {
                      onSuccess: () => toast.success(value ? "Key saved" : "Key removed"),
                      onError: (e) => toast.error(String(e?.message || "Failed to save")),
                    }
                  )
                }
                saving={update.isPending}
              />
            ))}
          </Section>
        )
      })}
      <Card className="p-4 text-[12px] leading-relaxed text-ink/60">
        Keys are encrypted at rest and never returned in full. A key set here overrides the server
        environment default for your workspace. Remove a key to fall back to the environment value.
      </Card>
    </>
  )
}

function IntegrationRow({
  item,
  onSave,
  saving,
}: {
  item: IntegrationStatus
  onSave: (value: string | null) => void
  saving: boolean
}) {
  const [value, setValue] = useState("")
  const submit = () => {
    if (!value.trim()) return
    onSave(value.trim())
    setValue("")
  }
  return (
    <div className="flex flex-col gap-2.5 border-b border-line-soft px-4 py-3.5 md:col-span-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-card bg-line-soft text-ink/55">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{item.label}</div>
            <div className="text-[11px] text-ink/55">{KEY_DESCRIPTIONS[item.key] ?? ""}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.configured ? (
            <>
              <Badge tone="success" className="px-1.5 py-0 text-[10px]">{item.masked ?? "set"}</Badge>
              <button
                aria-label="Remove key"
                onClick={() => onSave(null)}
                className="grid h-7 w-7 place-items-center rounded-card border border-line text-ink/55 hover:bg-line-soft"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : item.env_fallback ? (
            <Badge tone="neutral" className="px-1.5 py-0 text-[10px]">env default</Badge>
          ) : (
            <Badge tone="warning" className="px-1.5 py-0 text-[10px]">not set</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-11">
        <Input
          type={item.secret ? "password" : "text"}
          placeholder={item.secret ? "Paste key…" : "Paste value…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="max-w-[420px]"
        />
        <Button size="sm" onClick={submit} disabled={saving || !value.trim()}>
          Save
        </Button>
      </div>
    </div>
  )
}

// ── AI & Generation tab: functional org-level generation settings ──

function AiTab() {
  const { data: org } = useOrg()
  const updateOrg = useUpdateOrg()
  const s = (org?.settings ?? {}) as Record<string, unknown>

  const save = (patch: Record<string, unknown>) =>
    updateOrg.mutate(
      { settings: patch },
      {
        onSuccess: () => toast.success("Saved"),
        onError: () => toast.error("Failed to save"),
      }
    )

  return (
    <>
      <Section title="Generation">
        <RowToggle
          icon={ImageIcon}
          label="Image Generation"
          desc="Generate an illustration for every draft (DALL-E / Imagen)"
          checked={Boolean(s.generate_images)}
          onChange={() => save({ generate_images: !s.generate_images })}
        />
        <RowShell icon={Sparkles} label="Image Provider" desc="Model used to generate draft illustrations">
          <Select
            className="w-[190px]"
            value={String(s.image_provider ?? "openai")}
            onChange={(e) => save({ image_provider: e.target.value })}
          >
            <option value="openai">ChatGPT (DALL-E 3)</option>
            <option value="google">Google (Nano Banana)</option>
          </Select>
        </RowShell>
        <RowShell icon={Languages} label="Default Content Language" desc="Language used for new drafts">
          <Select
            className="w-[190px]"
            value={String(s.default_language ?? "en")}
            onChange={(e) => save({ default_language: e.target.value })}
          >
            <option value="en">English (EN)</option>
            <option value="ru">Russian (RU)</option>
            <option value="ja">Japanese (JA)</option>
            <option value="ko">Korean (KO)</option>
            <option value="zh">Chinese (ZH)</option>
          </Select>
        </RowShell>
        <RowShell icon={Sparkles} label="Fact-Check Gate" desc="Block publishing when fact-check finds issues">
          <Toggle
            checked={s.fact_check_gate !== false}
            onChange={() => save({ fact_check_gate: s.fact_check_gate === false })}
          />
        </RowShell>
      </Section>
      <AiUsagePanel />

      <Section title="What Uses Which AI">
        <UsageMapRow task="Post analysis (summary + tags)" model="Claude Haiku" cost="~$0.001 / post" />
        <UsageMapRow task="Embeddings (similarity, graph)" model="OpenAI text-embedding-3-small" cost="~$0.00002 / post" />
        <UsageMapRow task="Topic clustering + recommendations" model="Claude Haiku" cost="~$0.005 / cycle" />
        <UsageMapRow task="Web research before writing" model="Perplexity Sonar Pro" cost="~$0.01 / draft" />
        <UsageMapRow task="Write + style (one pass)" model="Claude Sonnet" cost="~$0.05 / draft" />
        <UsageMapRow task="Platform formats (TG/LI/TW)" model="Claude Sonnet" cost="~$0.02 / draft" />
        <UsageMapRow task="Translations" model="Claude Haiku" cost="~$0.002 / language" />
        <UsageMapRow task="Fact-check" model="Perplexity Sonar Pro" cost="~$0.01 / draft" />
        <UsageMapRow task="Image generation" model="DALL-E 3 / Nano Banana" cost="~$0.04 / image" />
        <UsageMapRow task="YouTube transcription (fallback only)" model="Whisper" cost="$0.006 / minute" />
      </Section>
    </>
  )
}

function AiUsagePanel() {
  const { data } = useAiUsage()
  if (!data) return null
  const fmt = (v: number) => `$${v.toFixed(2)}`
  return (
    <Section title="AI Spend">
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 md:col-span-2">
        <SpendStat label="Today" value={fmt(data.today_usd)} />
        <SpendStat label="Last 30 Days" value={fmt(data.month_usd)} />
        <SpendStat label="Daily Limit" value={fmt(data.daily_limit_usd)} />
        <SpendStat label="Left Today" value={fmt(data.daily_remaining_usd)} />
      </div>
      {data.by_model.length > 0 && (
        <div className="border-t border-line-soft p-4 md:col-span-2">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">By Model (30d)</div>
          {data.by_model
            .slice()
            .sort((a, b) => b.cost_usd - a.cost_usd)
            .map((m) => (
              <div key={m.key} className="flex items-center justify-between py-1 text-[12px]">
                <span className="truncate font-medium">{m.key}</span>
                <span className="shrink-0 text-ink/60">
                  {m.calls} calls · {(m.tokens / 1000).toFixed(1)}k tok · <span className="font-semibold text-ink">{fmt(m.cost_usd)}</span>
                </span>
              </div>
            ))}
        </div>
      )}
    </Section>
  )
}

function SpendStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-none">{value}</div>
    </div>
  )
}

function UsageMapRow({ task, model, cost }: { task: string; model: string; cost: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{task}</div>
        <div className="text-[11px] text-ink/55">{model}</div>
      </div>
      <span className="shrink-0 text-[12px] font-semibold text-ink/70">{cost}</span>
    </div>
  )
}

// ── Team & Access tab: real org members, role changes, deactivate/reactivate ──

const _TEAM_ADMIN_ROLES = new Set(["admin", "owner"])

function TeamTab() {
  const { data: users, isLoading } = useOrgUsers()
  const { data: me } = useMe()
  const updateUser = useUpdateOrgUser()

  if (isLoading || !users) {
    return <Card className="p-6 text-[13px] text-ink/60">Loading team…</Card>
  }

  const canManage = _TEAM_ADMIN_ROLES.has(me?.role ?? "")

  return (
    <Section title="Team & Access">
      <div className="overflow-x-auto md:col-span-2">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line-soft text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">
              <th className="px-4 py-2.5">Member</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <TeamRow key={u.id} user={u} isSelf={u.id === me?.id} canManage={canManage} onUpdate={updateUser} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink/50">No team members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function TeamRow({
  user,
  isSelf,
  canManage,
  onUpdate,
}: {
  user: OrgUser
  isSelf: boolean
  canManage: boolean
  onUpdate: ReturnType<typeof useUpdateOrgUser>
}) {
  const initials = (user.full_name || user.email || "?").slice(0, 2).toUpperCase()
  const created = new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  const disabled = isSelf || !canManage || onUpdate.isPending
  const disabledReason = isSelf
    ? "You cannot change your own account"
    : !canManage
      ? "Only admins can manage the team"
      : undefined

  const changeRole = (role: string) => {
    if (role === user.role) return
    onUpdate.mutate(
      { id: user.id, body: { role } },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update role"),
      }
    )
  }

  const toggleActive = () => {
    onUpdate.mutate(
      { id: user.id, body: { is_active: !user.is_active } },
      {
        onSuccess: () => toast.success(user.is_active ? "Member deactivated" : "Member reactivated"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update member"),
      }
    )
  }

  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blush text-[11px] font-semibold text-ink">{initials}</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{user.full_name || "—"}</div>
            <div className="truncate text-[11px] text-ink/55">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Select
          className="w-[130px]"
          value={user.role}
          disabled={disabled}
          title={disabledReason}
          onChange={(e) => changeRole(e.target.value)}
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </Select>
      </td>
      <td className="px-4 py-3">
        <Badge tone={user.is_active ? "success" : "neutral"} className="px-1.5 py-0 text-[10px]">
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-[12px] text-ink/60">{created}</td>
      <td className="px-4 py-3 text-right">
        <Button
          variant={user.is_active ? "danger" : "secondary"}
          size="sm"
          disabled={disabled}
          title={disabledReason}
          onClick={toggleActive}
        >
          {user.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      </td>
    </tr>
  )
}

// ── Billing tab: plan + real AI spend + editable daily budget ──

function BillingTab() {
  const updateOrg = useUpdateOrg()
  const { data: usage } = useAiUsage()
  const [limitDraft, setLimitDraft] = useState("")

  useEffect(() => {
    if (usage) setLimitDraft(String(usage.daily_limit_usd))
  }, [usage?.daily_limit_usd])

  const dirty = usage != null && limitDraft !== "" && limitDraft !== String(usage.daily_limit_usd)

  const saveLimit = () => {
    const n = Number(limitDraft)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid budget")
      return
    }
    updateOrg.mutate(
      { settings: { ai_daily_limit_usd: n } },
      {
        onSuccess: () => toast.success("Daily budget updated"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
      }
    )
  }

  const fmt = (v: number) => `$${v.toFixed(2)}`

  return (
    <>
      <Section title="Plan">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:col-span-2">
          <div>
            <div className="text-[13px] font-semibold">Pro · self-hosted</div>
            <div className="text-[11px] text-ink/55">Single-tenant deployment — no seat-based billing</div>
          </div>
          <Badge tone="success" className="px-1.5 py-0 text-[10px]">Active</Badge>
        </div>
      </Section>

      {usage ? (
        <Section title="AI Spend">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 md:col-span-2">
            <SpendStat label="Today" value={fmt(usage.today_usd)} />
            <SpendStat label="Last 30 Days" value={fmt(usage.month_usd)} />
            <SpendStat label="Daily Limit" value={fmt(usage.daily_limit_usd)} />
            <SpendStat label="Left Today" value={fmt(usage.daily_remaining_usd)} />
          </div>
          <RowShell icon={DollarSign} label="Daily AI Budget (USD)" desc="Spend guard — generation pauses once this is reached">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
                className="w-[120px]"
              />
              {dirty && (
                <Button size="sm" onClick={saveLimit} disabled={updateOrg.isPending}>Save</Button>
              )}
            </div>
          </RowShell>
          {usage.by_model.length > 0 && (
            <div className="border-t border-line-soft p-4 md:col-span-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">By Model (30d)</div>
              {usage.by_model
                .slice()
                .sort((a, b) => b.cost_usd - a.cost_usd)
                .map((m) => (
                  <div key={m.key} className="flex items-center justify-between py-1 text-[12px]">
                    <span className="truncate font-medium">{m.key}</span>
                    <span className="shrink-0 text-ink/60">
                      {m.calls} calls · {(m.tokens / 1000).toFixed(1)}k tok · <span className="font-semibold text-ink">{fmt(m.cost_usd)}</span>
                    </span>
                  </div>
                ))}
            </div>
          )}
          {usage.by_task.length > 0 && (
            <div className="border-t border-line-soft p-4 md:col-span-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">By Task (30d)</div>
              {usage.by_task
                .slice()
                .sort((a, b) => b.cost_usd - a.cost_usd)
                .map((t) => (
                  <div key={t.key} className="flex items-center justify-between py-1 text-[12px]">
                    <span className="truncate font-medium">{t.key}</span>
                    <span className="shrink-0 text-ink/60">
                      {t.calls} calls · {(t.tokens / 1000).toFixed(1)}k tok · <span className="font-semibold text-ink">{fmt(t.cost_usd)}</span>
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Section>
      ) : (
        <Card className="p-6 text-[13px] text-ink/60">Loading AI spend…</Card>
      )}
    </>
  )
}

// ── Notifications tab: org-level Telegram delivery toggles + test send ──

const ORG_NOTIF_ITEMS: { key: string; icon: LucideIcon; label: string; desc: string }[] = [
  { key: "draft_ready", icon: FileText, label: "Draft Ready", desc: "Notify when a new draft finishes generation" },
  { key: "published", icon: Send, label: "Published", desc: "Notify when a post is published" },
  { key: "pipeline_failed", icon: AlertTriangle, label: "Pipeline Failed", desc: "Notify when the generation pipeline errors out" },
  { key: "budget_alert", icon: DollarSign, label: "Budget Alert (80%)", desc: "Notify when daily AI spend crosses 80% of the budget" },
]

function NotificationsTab() {
  const { data: org } = useOrg()
  const updateOrg = useUpdateOrg()
  const testNotif = useTestNotification()
  const n = (((org?.settings ?? {}) as Record<string, unknown>).notifications ?? {}) as Record<string, boolean>

  const flip = (key: string) => {
    const next = { draft_ready: true, published: true, pipeline_failed: true, budget_alert: true, ...n, [key]: !(n[key] !== false) }
    updateOrg.mutate(
      { settings: { notifications: next } },
      {
        onSuccess: () => toast.success("Saved"),
        onError: () => toast.error("Failed to save"),
      }
    )
  }

  const sendTest = () => {
    testNotif.mutate(undefined, {
      onSuccess: () => toast.success("Test notification sent"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send test notification"),
    })
  }

  return (
    <>
      <Section title="Telegram Notifications">
        {ORG_NOTIF_ITEMS.map((item) => (
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
      <Card className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-[13px] font-semibold">Send Test Notification</div>
          <div className="text-[11px] text-ink/55">Sends a real message via the configured Telegram bot</div>
        </div>
        <Button variant="secondary" onClick={sendTest} disabled={testNotif.isPending}>
          <Send className="h-4 w-4" /> Send Test
        </Button>
      </Card>
    </>
  )
}

// ── Advanced tab: content export, read-only org info, llms.txt link ──

function AdvancedTab() {
  const { data: org } = useOrg()
  const [exporting, setExporting] = useState(false)

  const doExport = async () => {
    setExporting(true)
    try {
      await contentDownload("/export", "apex-export.json")
      toast.success("Export downloaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const llmsUrl = `${apiBaseUrl()}/llms.txt`

  // "integrations" holds Fernet-encrypted API keys (Settings -> Integrations manages
  // it exclusively). Never render it here, even ciphertext — this panel is visible to
  // every org member (not just admins), so it must not double as a secrets viewer.
  const { integrations: _integrations, ...safeSettings } = (org?.settings ?? {}) as Record<string, unknown>

  return (
    <>
      <Section title="Export">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:col-span-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-card bg-line-soft text-ink/55"><Download className="h-4 w-4" /></span>
            <div>
              <div className="text-[13px] font-semibold">Export All Content</div>
              <div className="text-[11px] text-ink/55">Download sources, drafts, published posts and tags as JSON</div>
            </div>
          </div>
          <Button variant="secondary" onClick={doExport} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </Section>

      <Section title="Workspace Info">
        <RowText icon={Database} label="Organization ID" desc="Internal identifier for this workspace" value={org?.id ?? "—"} />
        <RowText icon={Link2} label="Slug" desc="URL-safe workspace identifier" value={org?.slug ?? "—"} />
        <RowText icon={Calendar} label="Created" desc="When this workspace was provisioned" value={org ? new Date(org.created_at).toLocaleString() : "—"} />
        <div className="border-t border-line-soft px-4 py-3.5 md:col-span-2">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">Settings JSON</div>
          <pre className="max-h-[280px] overflow-x-auto overflow-y-auto rounded-card border border-line-soft bg-canvas p-3 text-[11px] leading-relaxed text-ink/70">
            {JSON.stringify(safeSettings, null, 2)}
          </pre>
        </div>
      </Section>

      <Card className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-card bg-line-soft text-ink/55"><Code2 className="h-4 w-4" /></span>
          <div>
            <div className="text-[13px] font-semibold">API Surface (llms.txt)</div>
            <div className="text-[11px] text-ink/55">Plain-text description of the API for LLM agents</div>
          </div>
        </div>
        <a href={llmsUrl} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm"><ExternalLink className="h-4 w-4" /> Open</Button>
        </a>
      </Card>
    </>
  )
}

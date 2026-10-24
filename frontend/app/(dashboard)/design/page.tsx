"use client"

import { useState } from "react"
import { FileText, Boxes, PenLine, BarChart3, Eye, Plus, ArrowRight, Trash2, Pencil, MoreVertical } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconBox } from "@/components/ui/icon-box"
import { StatCard } from "@/components/ui/stat-card"
import { Panel, SectionHeader } from "@/components/ui/section"
import { Input } from "@/components/ui/input"
import { Field, Textarea, Select, SearchInput, Checkbox, Radio, SettingRow } from "@/components/ui/forms"
import { Toggle } from "@/components/ui/toggle"
import { Tabs, UnderlineTabs } from "@/components/ui/tabs"
import { Alert, Spinner, ProgressBar, Tooltip } from "@/components/ui/feedback"
import { Tag, Avatar, SegmentedControl, Sparkline, Table, THead, TH, TBody, TR, TD } from "@/components/ui/data-display"
import { EmptyState, Skeleton } from "@/components/ui/states"

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} />
      {children}
    </section>
  )
}

const TYPE = [
  ["Page title", "text-[30px] font-semibold uppercase tracking-[0.08em]", "Aa Dashboard"],
  ["Panel title", "text-[17px] font-semibold uppercase tracking-[0.06em]", "Sources Health"],
  ["Stat number", "text-[34px] font-semibold leading-none", "48.2K"],
  ["Card title", "text-[18px] font-semibold", "US FRB Maintains Rate Range"],
  ["Body", "text-[14px] font-medium", "ETF inflows resume as risk sentiment improves."],
  ["Label (caps)", "text-[12px] font-semibold uppercase tracking-[0.08em]", "New Posts (24h)"],
  ["Meta", "text-[12px] text-ink/60", "2 hours ago"],
] as const

export default function DesignSystemPage() {
  const [tab, setTab] = useState("all")
  const [utab, setUtab] = useState("general")
  const [seg, setSeg] = useState("month")
  const [on, setOn] = useState(true)

  return (
    <div className="min-h-screen bg-canvas px-[30px] py-[22px] text-ink">
      <h1 className="text-[30px] font-semibold uppercase leading-none tracking-[0.08em]">Design System</h1>
      <p className="mt-3 text-[15px]">One source of truth — every page is composed from these primitives. See <code className="rounded-chip bg-line-soft px-1">DESIGN_SYSTEM.md</code>.</p>

      <div className="mt-8 space-y-10">
        {/* COLORS */}
        <Block title="Colors">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ["canvas #fbfaf8", "bg-canvas border border-line"],
              ["line #d7d2ca", "bg-line"],
              ["line-soft", "bg-line-soft"],
              ["ink #111", "bg-ink"],
              ["lavender", "bg-lavender"],
              ["lavender-text", "bg-lavender-text"],
              ["blush", "bg-blush"],
              ["sprout", "bg-sprout"],
            ].map(([name, cls]) => (
              <div key={name}>
                <div className={`h-14 rounded-card ${cls}`} />
                <div className="mt-1.5 text-[11px] font-bold">{name}</div>
              </div>
            ))}
          </div>
        </Block>

        {/* TYPOGRAPHY */}
        <Block title="Typography — Inter">
          <Card className="divide-y divide-line-soft p-0">
            {TYPE.map(([role, cls, sample]) => (
              <div key={role} className="flex items-center gap-6 px-4 py-3">
                <span className="w-32 shrink-0 text-[11px] font-bold uppercase text-ink/50">{role}</span>
                <span className={cls}>{sample}</span>
              </div>
            ))}
          </Card>
        </Block>

        {/* BUTTONS */}
        <Block title="Buttons">
          <Card className="flex flex-wrap items-center gap-3">
            <Button>Create Draft</Button>
            <Button variant="secondary">View Sources</Button>
            <Button variant="danger">Dismiss</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </Card>
        </Block>

        {/* BADGES + TAGS */}
        <Block title="Badges & Tags">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="high">High Priority</Badge>
              <Badge tone="medium">Medium Priority</Badge>
              <Badge tone="low">Low Priority</Badge>
              <Badge tone="success">Enabled</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Failed</Badge>
              <Badge tone="new">New</Badge>
              <Badge tone="info">3 in progress</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tag>macro</Tag><Tag>fed</Tag><Tag>rates</Tag><Tag>crypto</Tag><Tag>japan</Tag>
            </div>
          </Card>
        </Block>

        {/* ICON BOXES + AVATARS */}
        <Block title="Icon Boxes & Avatars">
          <Card className="flex flex-wrap items-center gap-4">
            <IconBox icon={Plus} size="lg" />
            <IconBox icon={FileText} />
            <IconBox icon={BarChart3} tone="blush" />
            <IconBox icon={Eye} tone="sprout" />
            <IconBox icon={Boxes} tone="line" size="sm" />
            <div className="mx-2 h-10 w-px bg-line" />
            <Avatar initials="YO" size="lg" square />
            <Avatar initials="AP" tone="lavender" />
            <Avatar initials="ME" tone="sprout" size="sm" />
          </Card>
        </Block>

        {/* STAT CARDS */}
        <Block title="Stat Cards">
          <div className="grid grid-cols-2 overflow-hidden rounded-card border border-line bg-white md:grid-cols-3 xl:grid-cols-5">
            <div className="border-r border-line"><StatCard icon={FileText} label="New Posts (24h)" value={124} delta="+18%" caption="vs yesterday" /></div>
            <div className="border-r border-line"><StatCard icon={Boxes} label="Active Clusters" value={17} deltaTone="flat" caption="vs yesterday" /></div>
            <div className="border-r border-line"><StatCard icon={PenLine} label="Drafts Ready" value={8} delta="+2" caption="vs yesterday" /></div>
            <div className="border-r border-line"><StatCard icon={BarChart3} label="Published" value={23} delta="+4" caption="vs last week" /></div>
            <div><StatCard icon={Eye} label="Total Views" value="48.2K" delta="+12%" caption="vs last week" /></div>
          </div>
        </Block>

        {/* FORMS */}
        <Block title="Form Controls">
          <Card className="grid gap-5 md:grid-cols-2">
            <Field label="Workspace Name"><Input defaultValue="Apex Org" /></Field>
            <Field label="Search"><SearchInput placeholder="Search posts…" /></Field>
            <Field label="Default Language"><Select defaultValue="en"><option value="en">English (EN)</option><option value="ru">Russian (RU)</option></Select></Field>
            <Field label="Custom Instructions" hint="Used by the AI when generating."><Textarea defaultValue="Always cite sources." /></Field>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-medium"><Checkbox defaultChecked /> Analyzed</label>
              <label className="flex items-center gap-2 text-sm font-medium"><Checkbox /> Used</label>
              <label className="flex items-center gap-2 text-sm font-medium"><Radio name="r" defaultChecked /> Manual</label>
              <label className="flex items-center gap-2 text-sm font-medium"><Radio name="r" /> Auto</label>
            </div>
            <div className="divide-y divide-line-soft">
              <SettingRow label="Auto Save" desc="Automatically save drafts"><Toggle checked={on} onChange={setOn} /></SettingRow>
              <SettingRow label="Duplicate Detection" desc="Check for similar content"><Toggle checked={!on} onChange={(v) => setOn(!v)} /></SettingRow>
            </div>
          </Card>
        </Block>

        {/* TABS + SEGMENTED */}
        <Block title="Tabs & Switchers">
          <Card className="space-y-4">
            <Tabs active={tab} onChange={setTab} items={[
              { key: "all", label: "All Drafts", count: 38 }, { key: "draft", label: "Draft", count: 12 },
              { key: "prog", label: "In Progress", count: 6 }, { key: "ready", label: "Ready", count: 9 },
            ]} />
            <UnderlineTabs active={utab} onChange={setUtab} items={[
              { key: "general", label: "General" }, { key: "ai", label: "AI & Generation" },
              { key: "content", label: "Content" }, { key: "billing", label: "Billing" },
            ]} />
            <SegmentedControl value={seg} onChange={setSeg} options={[{ key: "month", label: "Month" }, { key: "week", label: "Week" }, { key: "list", label: "List" }]} />
          </Card>
        </Block>

        {/* TABLE */}
        <Block title="Table">
          <Card className="overflow-x-auto p-0">
            <Table>
              <THead>
                <TH className="w-10"><Checkbox /></TH><TH>Source</TH><TH>Status</TH><TH>Tags</TH><TH className="text-right">Actions</TH>
              </THead>
              <TBody>
                {[["macro_alerts", "success", "Analyzed"], ["zerohedge", "new", "New"], ["bankless", "danger", "Failed"]].map(([n, tone, label]) => (
                  <TR key={n}>
                    <TD><Checkbox /></TD>
                    <TD className="font-bold">{n}</TD>
                    <TD><Badge tone={tone as "success"}>{label}</Badge></TD>
                    <TD><div className="flex gap-1"><Tag>macro</Tag><Tag>fed</Tag></div></TD>
                    <TD><div className="flex justify-end gap-1 text-ink/40">
                      <Eye className="h-4 w-4 cursor-pointer hover:text-ink" /><Pencil className="h-4 w-4 cursor-pointer hover:text-ink" /><MoreVertical className="h-4 w-4 cursor-pointer hover:text-ink" />
                    </div></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </Block>

        {/* FEEDBACK */}
        <Block title="Feedback & Progress">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-2.5">
              <Alert tone="info" title="Heads up">Topic clustering runs every hour.</Alert>
              <Alert tone="success" title="Published">Sent to Telegram.</Alert>
              <Alert tone="warning" title="Rate limited">Retrying in 30s.</Alert>
              <Alert tone="danger" title="Transcription failed">Audio processing error.</Alert>
            </Card>
            <Card className="space-y-4">
              <div><div className="mb-1.5 text-xs font-bold">AI Cost — 4.9%</div><ProgressBar value={4.9} /></div>
              <div><div className="mb-1.5 text-xs font-bold">Draft progress — 60%</div><ProgressBar value={60} /></div>
              <div className="flex items-center gap-4">
                <Spinner /> <span className="text-sm">Loading…</span>
                <Tooltip label="Open details"><Button variant="secondary" size="sm">Hover me</Button></Tooltip>
                <Sparkline data={[3, 5, 4, 7, 6, 9, 8]} />
                <Sparkline data={[9, 7, 8, 5, 6, 3, 2]} tone="down" />
              </div>
              <div className="flex items-center gap-3"><Trash2 className="h-4 w-4 text-rose-500" /><Skeleton className="h-3 flex-1" /></div>
            </Card>
          </div>
        </Block>

        {/* PANEL + EMPTY */}
        <Block title="Panel & Empty State">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Sources Health" action={<button className="flex items-center gap-2 text-[13px]">View all <ArrowRight className="h-4 w-4" /></button>}>
              <ul className="divide-y divide-line-soft">
                {["macro_alerts", "coinmetrics", "fed_watch"].map((n, i) => (
                  <li key={n} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-bold">{n}</span>
                    <span className="flex items-center gap-2 text-xs"><span className={`h-2.5 w-2.5 rounded-full ${i === 2 ? "bg-orange-400" : "bg-emerald-500"}`} />{i === 2 ? "Warning" : "OK"}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <EmptyState title="No drafts yet" hint="Create one from a topic cluster." />
          </div>
        </Block>
      </div>
    </div>
  )
}

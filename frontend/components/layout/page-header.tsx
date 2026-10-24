"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, ChevronDown } from "lucide-react"
import { ProgressBar } from "@/components/ui/feedback"
import { useAiUsage, useMe } from "@/lib/api/hooks"
import { userDisplay } from "@/lib/user"

/**
 * Shared page header — identical on every page, only `title` + `subtitle` change.
 * Left: page title + subtitle. Right: AI cost + clock (equal-height bordered cards)
 * and a borderless org switcher separated by a vertical divider.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  aiCost,
  aiBudget,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  aiCost?: number
  aiBudget?: number
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-[24px] font-semibold uppercase leading-none tracking-[0.06em]">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[13px] text-black/65">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-stretch gap-3">
        {actions}
        <AiCostCard cost={aiCost} budget={aiBudget} />
        <ClockCard />
        <OrgSwitcher />
      </div>
    </div>
  )
}

function AiCostCard({ cost, budget }: { cost?: number; budget?: number }) {
  const { data: usage } = useAiUsage()
  const shownCost = cost ?? usage?.today_usd ?? 0
  const shownBudget = budget ?? usage?.daily_limit_usd ?? 50
  const pct = shownBudget > 0 ? Math.min(100, (shownCost / shownBudget) * 100) : 0
  return (
    <div className="flex w-[236px] flex-col justify-center rounded-[4px] border border-line bg-white px-3.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-black/60">AI Cost (Today)</span>
        <span className="text-[12px] font-semibold">${shownCost.toFixed(2)} / ${shownBudget.toFixed(2)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <ProgressBar value={pct} className="flex-1" />
        <span className="w-8 shrink-0 text-right text-[10px] font-medium text-black/55">{pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function ClockCard() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  const date = now?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) ?? "May 8, 2025"
  const weekday = now?.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) ?? "Thursday"
  const time = now?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) ?? "14:35"
  return (
    <div className="flex items-center gap-2.5 rounded-[4px] border border-line bg-white px-3.5 py-2">
      <CalendarDays className="h-[18px] w-[18px] shrink-0 text-black/65" />
      <div className="leading-tight">
        <div className="text-[12px] font-medium">{date}</div>
        <div className="mt-0.5 text-[11px] text-black/55">{weekday}, {time} UTC</div>
      </div>
    </div>
  )
}

function OrgSwitcher() {
  const { data: me } = useMe()
  const { name, initials, role } = userDisplay(me)
  return (
    <Link
      href="/profile"
      className="flex items-center gap-2.5 border-l border-line pl-4 pr-1 text-left transition hover:opacity-80"
    >
      <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[#ff91a7] text-[15px] font-semibold">{initials}</span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold">{name}</span>
        <span className="mt-0.5 block text-[11px] text-black/55">{role}</span>
      </span>
      <ChevronDown className="h-4 w-4 text-black/55" />
    </Link>
  )
}

import { cn } from "@/lib/utils"
import { IconBox } from "@/components/ui/icon-box"
import type { LucideIcon } from "lucide-react"

/**
 * KPI metric — matches the Dashboard reference `Metric`: lavender icon tile on
 * the left, font-semibold uppercase label, oversized font-semibold number, violet
 * delta with ↗ (or "-" when flat). Designed to sit in a bordered 5-up row.
 */
export function StatCard({
  label,
  value,
  delta,
  caption,
  icon,
  deltaTone = "up",
}: {
  label: string
  value: string | number
  delta?: string
  caption?: string
  icon?: LucideIcon
  deltaTone?: "up" | "down" | "flat"
}) {
  return (
    <div className="flex items-center gap-6 px-7 py-6">
      {icon ? <IconBox icon={icon} tone="lavender" size="lg" /> : null}
      <div className="min-w-0">
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">{label}</div>
        <div className="mt-2.5 text-[34px] font-semibold leading-none tracking-[0.02em] text-ink">{value}</div>
        <div className="mt-2.5 flex items-center gap-2 text-[13px]">
          {deltaTone === "flat" || !delta ? (
            <span className="font-bold text-zinc-500">-</span>
          ) : (
            <span className={cn("font-bold", deltaTone === "up" ? "text-lavender-text" : "text-rose-500")}>
              {delta} ↗
            </span>
          )}
          {caption ? <span className="text-ink/70">{caption}</span> : null}
        </div>
      </div>
    </div>
  )
}

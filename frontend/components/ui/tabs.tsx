"use client"

import { cn } from "@/lib/utils"

export interface TabItem {
  key: string
  label: string
  count?: number
}

/** Pill tabs with optional counts (Drafts/Sources/Auto Mode headers). */
export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((t) => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-card px-3 py-1.5 text-sm font-bold transition-colors duration-200",
              isActive ? "bg-lavender text-ink" : "text-ink/60 hover:bg-line-soft hover:text-ink"
            )}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span
                className={cn(
                  "rounded-chip px-1.5 text-xs font-bold",
                  isActive ? "bg-white/60 text-ink" : "bg-line-soft text-ink/60"
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Underline tabs (Settings/Profile/Auto Mode section nav). */
export function UnderlineTabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={cn("flex gap-6 border-b border-line text-sm", className)}>
      {items.map((t) => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 pb-2.5 font-bold transition-colors",
              isActive ? "border-lavender-text text-ink" : "border-transparent text-ink/50 hover:text-ink"
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

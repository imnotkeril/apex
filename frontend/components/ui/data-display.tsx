"use client"

import { cn } from "@/lib/utils"

/** Lavender pill — content tags everywhere. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-chip bg-lavender px-2 py-0.5 text-[12px] font-semibold text-ink", className)}>
      {children}
    </span>
  )
}

const avatarTones = {
  blush: "bg-blush text-ink",
  lavender: "bg-lavender text-ink",
  sprout: "bg-sprout text-ink",
}
const avatarSizes = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-sm", lg: "h-[52px] w-[52px] text-[17px]" }

export function Avatar({
  initials,
  tone = "blush",
  size = "md",
  square,
  className,
}: {
  initials: string
  tone?: keyof typeof avatarTones
  size?: keyof typeof avatarSizes
  square?: boolean
  className?: string
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center font-bold", square ? "rounded-card" : "rounded-full", avatarTones[tone], avatarSizes[size], className)}>
      {initials}
    </span>
  )
}

/** Month/Week/List style view switcher. */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (k: string) => void
  className?: string
}) {
  return (
    <div className={cn("inline-flex rounded-card border border-line bg-white p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "cursor-pointer rounded-[2px] px-3 py-1 text-sm font-bold transition-colors",
            value === o.key ? "bg-lavender text-ink" : "text-ink/55 hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tiny inline sparkline (tag/source trends). */
export function Sparkline({ data, className, tone = "up" }: { data: number[]; className?: string; tone?: "up" | "down" }) {
  if (!data.length) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / span) * 100}`)
    .join(" ")
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-6 w-16", className)}>
      <polyline points={pts} fill="none" stroke={tone === "up" ? "#16a34a" : "#ef4444"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ── Table primitives ── always wrap <Table> in a parent with overflow-x-auto ── */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn("w-full text-left text-sm", className)}>{children}</table>
}
export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.05em] text-ink/60">{children}</tr>
    </thead>
  )
}
export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 font-semibold", className)}>{children}</th>
}
export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line-soft">{children}</tbody>
}
export function TR({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("transition-colors hover:bg-canvas", className)}>{children}</tr>
}
export function TD({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 align-middle", className)}>{children}</td>
}

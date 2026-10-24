import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Compact relative time, e.g. "3m ago", "2h ago", "5d ago". */
export function timeAgo(input?: string | number | Date | null): string {
  if (!input) return "—"
  const then = new Date(input).getTime()
  if (Number.isNaN(then)) return "—"
  const diff = Math.max(0, Date.now() - then)
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Compact relative time given a number of hours (from API freshness fields). */
export function hoursAgo(hours?: number | null): string {
  if (hours == null || Number.isNaN(hours)) return "—"
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  const d = Math.round(hours / 24)
  return `${d}d ago`
}

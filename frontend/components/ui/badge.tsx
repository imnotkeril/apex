import { cn } from "@/lib/utils"

export type BadgeTone =
  | "high"
  | "medium"
  | "low"
  | "success"
  | "danger"
  | "warning"
  | "new"
  | "info"
  | "neutral"

// Warm editorial tones from the Dashboard reference (near-square, ink text).
const tones: Record<BadgeTone, string> = {
  high: "bg-blush-dismiss text-ink",
  medium: "bg-lavender text-ink",
  low: "bg-line-soft text-ink",
  success: "bg-sprout text-ink",
  danger: "bg-blush-dismiss text-ink",
  warning: "bg-amber-200 text-ink",
  new: "bg-sky-200 text-ink",
  info: "bg-lavender text-ink",
  neutral: "bg-line-soft text-ink",
}

// Map common backend status strings → tone.
export function statusTone(status?: string | null): BadgeTone {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "ok":
    case "passed":
    case "published":
    case "analyzed":
    case "ready":
      return "success"
    case "failed":
    case "error":
    case "issues_found":
      return "danger"
    case "warning":
      return "warning"
    case "new":
      return "new"
    case "scheduled":
    case "in_progress":
    case "processing":
    case "queued":
      return "info"
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    default:
      return "neutral"
  }
}

export function Badge({
  children,
  tone = "neutral",
  uppercase = true,
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  /** Status/priority badges are UPPERCASE by mockup default. Set false for inline label chips. */
  uppercase?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        uppercase && "uppercase",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

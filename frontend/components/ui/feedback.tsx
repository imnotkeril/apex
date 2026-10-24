import { cn } from "@/lib/utils"
import { Info, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type AlertTone = "info" | "success" | "warning" | "danger"
const alertTones: Record<AlertTone, { cls: string; icon: LucideIcon }> = {
  info: { cls: "bg-lavender/40 text-ink", icon: Info },
  success: { cls: "bg-sprout text-ink", icon: CheckCircle2 },
  warning: { cls: "bg-amber-100 text-ink", icon: AlertTriangle },
  danger: { cls: "bg-blush-dismiss text-ink", icon: XCircle },
}

export function Alert({ tone = "info", title, children }: { tone?: AlertTone; title?: string; children?: React.ReactNode }) {
  const { cls, icon: Icon } = alertTones[tone]
  return (
    <div className={cn("flex items-start gap-2.5 rounded-card px-3.5 py-3 text-sm", cls)} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <div className="font-bold">{title}</div> : null}
        {children ? <div className="text-ink/80">{children}</div> : null}
      </div>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-lavender-text", className)} aria-label="Loading" />
}

/** Thin progress bar (AI cost, draft progress %). */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line-soft", className)}>
      <div className="h-full rounded-full bg-lavender-text transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

/** CSS-only tooltip wrapper. */
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-chip bg-ink px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </span>
  )
}

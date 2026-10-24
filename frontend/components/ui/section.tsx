import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

/** Uppercase section label above a block (e.g. "AI RECOMMENDATIONS"). */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between", className)}>
      <h2 className="text-[17px] font-semibold uppercase tracking-[0.06em] text-ink">{title}</h2>
      {action}
    </div>
  )
}

/**
 * Card with a titled header bar + body. Used for list/table panels
 * (Sources Health, Content Pipeline, Recent Activity, etc.). Matches the
 * Dashboard reference: 48px header, taupe divider, font-semibold uppercase title.
 */
export function Panel({
  title,
  badge,
  action,
  footer,
  bodyClassName,
  className,
  children,
}: {
  title: string
  badge?: string
  action?: React.ReactNode
  footer?: React.ReactNode
  bodyClassName?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden p-0", className)}>
      <div className="flex h-12 items-center justify-between gap-2 border-b border-line px-[18px]">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-semibold uppercase tracking-[0.06em] text-ink">{title}</h2>
          {badge ? <Badge tone="info">{badge}</Badge> : null}
        </div>
        {action}
      </div>
      <div className={cn("px-[18px] py-3", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-line px-[18px] py-3">{footer}</div> : null}
    </Card>
  )
}

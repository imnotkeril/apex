import { cn } from "@/lib/utils"
import { AlertCircle, Inbox } from "lucide-react"

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-chip bg-line-soft", className)} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({
  title = "Nothing here yet",
  hint,
  icon: Icon = Inbox,
}: {
  title?: string
  hint?: string
  icon?: typeof Inbox
}) {
  return (
    <div className="grid place-items-center rounded-card border border-dashed border-line bg-white py-16 text-center">
      <Icon className="h-8 w-8 text-ink/30" />
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-xs text-ink/50">{hint}</p> : null}
    </div>
  )
}

export function ErrorState({ error }: { error?: unknown }) {
  const msg = error instanceof Error ? error.message : "Failed to load data"
  return (
    <div className="grid place-items-center rounded-card border border-blush bg-blush-dismiss py-12 text-center">
      <AlertCircle className="h-7 w-7 text-rose-500" />
      <p className="mt-2 text-sm font-bold text-ink">{msg}</p>
      <p className="mt-1 text-xs text-ink/60">Check that the backend is running and you are signed in.</p>
    </div>
  )
}

import { cn } from "@/lib/utils"
import type { HTMLAttributes } from "react"

/**
 * Canonical surface — matches the Dashboard reference: white, taupe hairline
 * border (`line`), near-square 3px radius (`rounded-card`), flat (no shadow).
 * Pass `p-0` for tables/lists/panels that manage their own padding.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-line bg-white p-4", className)}
      {...props}
    />
  )
}

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type Tone = "lavender" | "blush" | "sprout" | "line"
type Size = "sm" | "md" | "lg"

// Dashboard reference: soft fills + ink icon, near-square tile.
const tones: Record<Tone, string> = {
  lavender: "bg-lavender text-ink",
  blush: "bg-blush-soft text-ink",
  sprout: "bg-sprout text-ink",
  line: "bg-line-soft text-ink",
}
const boxSizes: Record<Size, string> = {
  sm: "h-8 w-8 rounded-chip",
  md: "h-11 w-11 rounded-[4px]",
  lg: "h-[68px] w-[68px] rounded-[4px]",
}
const iconSizes: Record<Size, string> = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8" }

/** Soft-tinted square holding a line icon. Stat cards, quick actions, list rows. */
export function IconBox({
  icon: Icon,
  tone = "lavender",
  size = "md",
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  size?: Size
  className?: string
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center", boxSizes[size], tones[tone], className)}>
      <Icon className={cn(iconSizes[size], "stroke-[1.8]")} />
    </span>
  )
}

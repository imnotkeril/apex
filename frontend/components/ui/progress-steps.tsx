import { cn } from "@/lib/utils"
import { Check, Loader2, Sparkles, Wand2, Type, Languages, ShieldCheck, Image as ImageIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type StepState = "done" | "active" | "pending" | "failed"

export interface PipelineStep {
  key: string
  label: string
  state: StepState
}

export const DRAFT_PIPELINE: { key: string; label: string }[] = [
  { key: "synthesis", label: "Synthesis" },
  { key: "styling", label: "Styling" },
  { key: "formatting", label: "Formatting" },
  { key: "translation", label: "Translation" },
  { key: "fact_check", label: "Fact Check" },
  { key: "image", label: "Image" },
]

const STEP_ICON: Record<string, LucideIcon> = {
  synthesis: Sparkles,
  styling: Wand2,
  formatting: Type,
  translation: Languages,
  fact_check: ShieldCheck,
  image: ImageIcon,
}

/** Compact icon-only step dots connected by arrows (Content Pipeline column). */
export function ProgressDots({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-center gap-[3px]">
      {steps.map((s) => {
        const Icon: LucideIcon = s.state === "done" ? Check : (STEP_ICON[s.key] ?? Check)
        return (
          <span
            key={s.key}
            title={s.label}
            className={cn(
              "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full",
              s.state === "done" && "bg-emerald-100 text-emerald-600",
              s.state === "active" && "bg-violet-100 text-violet-600",
              s.state === "pending" && "bg-zinc-100 text-zinc-400",
              s.state === "failed" && "bg-rose-100 text-rose-600"
            )}
          >
            {s.state === "active" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Icon className="h-2.5 w-2.5" />}
          </span>
        )
      })}
    </div>
  )
}

export function ProgressSteps({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium",
              s.state === "done" && "bg-emerald-100 text-emerald-700",
              s.state === "active" && "bg-violet-100 text-violet-700",
              s.state === "pending" && "bg-zinc-100 text-zinc-400",
              s.state === "failed" && "bg-rose-100 text-rose-700"
            )}
          >
            {s.state === "done" && <Check className="h-3 w-3" />}
            {s.state === "active" && <Loader2 className="h-3 w-3 animate-spin" />}
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-zinc-300">→</span>}
        </div>
      ))}
    </div>
  )
}

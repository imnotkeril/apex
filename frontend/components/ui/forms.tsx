"use client"

import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react"

const fieldBase =
  "w-full rounded-card border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-lavender-text focus:ring-2 focus:ring-lavender/50"

/** Labelled field wrapper. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink/50">{hint}</span> : null}
    </label>
  )
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "min-h-[88px] resize-y", className)} {...props} />
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "cursor-pointer appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    )
  }
)

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, placeholder = "Search…", ...props }, ref) {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input ref={ref} placeholder={placeholder} className={cn(fieldBase, "pl-8", className)} {...props} />
      </div>
    )
  }
)

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 cursor-pointer rounded-[3px] accent-lavender-text", className)}
      {...props}
    />
  )
}

export function Radio({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="radio" className={cn("h-4 w-4 cursor-pointer accent-lavender-text", className)} {...props} />
}

/** A labelled control row used across Settings/Profile. */
export function SettingRow({
  icon,
  label,
  desc,
  children,
}: {
  icon?: React.ReactNode
  label: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 text-ink/50">{icon}</span> : null}
        <div>
          <div className="text-sm font-bold text-ink">{label}</div>
          {desc ? <div className="text-xs text-ink/55">{desc}</div> : null}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

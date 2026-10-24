"use client"

import { cn } from "@/lib/utils"

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:opacity-50",
        checked ? "bg-lavender-text" : "bg-line"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

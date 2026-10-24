import { cn } from "@/lib/utils"
import { forwardRef, type InputHTMLAttributes } from "react"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-card border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-lavender-text focus:ring-2 focus:ring-lavender/50",
          className
        )}
        {...props}
      />
    )
  }
)

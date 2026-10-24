import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md"

// Warm editorial buttons from the Dashboard reference: lavender primary w/ ink
// text, taupe-outline secondary, blush-soft danger — all near-square (rounded-card).
const variants: Record<Variant, string> = {
  primary: "bg-lavender text-ink hover:brightness-95",
  secondary: "border border-line bg-white text-ink hover:bg-canvas",
  ghost: "text-ink hover:bg-line-soft",
  danger: "bg-blush-dismiss text-ink hover:brightness-95",
}
const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-card font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-text/60 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}

"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useEffect } from "react"

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100",
        className
      )}
    >
      {children}
    </select>
  )
}

export function Textarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
    />
  )
}

"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export function DetailDrawer({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <>
      {/* mobile overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/20 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-[360px] max-w-[90vw] flex-col border-l border-zinc-200 bg-white shadow-drawer",
          "lg:static lg:z-0 lg:shadow-none",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  )
}

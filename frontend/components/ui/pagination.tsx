"use client"

import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function Pagination({
  page,
  pageCount,
  onPage,
  perPage,
  onPerPage,
  total,
}: {
  page: number
  pageCount: number
  onPage: (p: number) => void
  perPage?: number
  onPerPage?: (n: number) => void
  total?: number
}) {
  const pages = pageRange(page, pageCount)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
      <div className="flex items-center gap-2">
        {onPerPage ? (
          <>
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => onPerPage(Number(e.target.value))}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-700"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>per page</span>
          </>
        ) : (
          typeof total === "number" && <span>{total} results</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <PagBtn disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </PagBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-2 text-zinc-400">
              …
            </span>
          ) : (
            <PagBtn key={p} active={p === page} onClick={() => onPage(p as number)}>
              {p}
            </PagBtn>
          )
        )}
        <PagBtn disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </PagBtn>
      </div>
    </div>
  )
}

function PagBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm transition disabled:opacity-40",
        active ? "bg-violet-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
      )}
    >
      {children}
    </button>
  )
}

function pageRange(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, "…", count]
  if (page >= count - 3) return [1, "…", count - 4, count - 3, count - 2, count - 1, count]
  return [1, "…", page - 1, page, page + 1, "…", count]
}

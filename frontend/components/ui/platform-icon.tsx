import { cn } from "@/lib/utils"
import { FileText, Globe, Mail, PlayCircle, Rss, Send } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Maps source_type / platform string → icon + accent color.
const map: Record<string, { icon: LucideIcon; className: string; label: string }> = {
  telegram: { icon: Send, className: "text-sky-500", label: "Telegram" },
  twitter: { icon: Globe, className: "text-zinc-900", label: "Twitter/X" },
  x: { icon: Globe, className: "text-zinc-900", label: "Twitter/X" },
  linkedin: { icon: Globe, className: "text-blue-600", label: "LinkedIn" },
  rss: { icon: Rss, className: "text-orange-500", label: "RSS" },
  youtube: { icon: PlayCircle, className: "text-red-500", label: "YouTube" },
  email: { icon: Mail, className: "text-zinc-500", label: "Email" },
  web: { icon: Globe, className: "text-zinc-500", label: "Web" },
  pdf: { icon: FileText, className: "text-rose-500", label: "PDF" },
  internal: { icon: FileText, className: "text-zinc-400", label: "Internal" },
}

export function PlatformIcon({ type, className }: { type: string; className?: string }) {
  const entry = map[type?.toLowerCase()] ?? map.web
  const Icon = entry.icon
  return <Icon className={cn("h-4 w-4", entry.className, className)} aria-label={entry.label} />
}

export function platformLabel(type: string) {
  return map[type?.toLowerCase()]?.label ?? type
}

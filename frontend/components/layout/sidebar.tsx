"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useMe } from "@/lib/api/hooks"
import { userDisplay } from "@/lib/user"
import {
  LayoutGrid,
  ClipboardCheck,
  Boxes,
  PenLine,
  Calendar,
  Share2,
  Send,
  Database,
  Palette,
  Tags,
  Image as ImageIcon,
  Bot,
  Settings,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Main",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutGrid },
      { href: "/content/raw-posts", label: "Raw Posts", icon: ClipboardCheck },
      { href: "/content/clusters", label: "Topic Clusters", icon: Boxes },
      { href: "/content/drafts", label: "Drafts", icon: PenLine },
      { href: "/content/calendar", label: "Calendar", icon: Calendar },
      { href: "/content/graph", label: "Knowledge Graph", icon: Share2 },
    ],
  },
  {
    title: "Content",
    items: [{ href: "/content/published", label: "Published Posts", icon: Send }],
  },
  {
    title: "Settings",
    items: [
      { href: "/content/sources", label: "Sources", icon: Database },
      { href: "/content/styles", label: "Styles & Presets", icon: Palette },
      { href: "/content/tags", label: "Tags", icon: Tags },
      { href: "/content/image-styles", label: "Image Styles", icon: ImageIcon },
      { href: "/content/auto-mode", label: "Auto Mode", icon: Bot },
      { href: "/content/settings", label: "Settings", icon: Settings },
    ],
  },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: me } = useMe()
  const { name, initials, role } = userDisplay(me)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-[#111719] text-white transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-[238px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-4 pb-6 pt-6", collapsed ? "justify-center px-0" : "px-6")}>
        <span
          className={cn(
            "grid place-items-center rounded-[4px] bg-[#d8c2ff] font-medium text-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]",
            collapsed ? "h-[44px] w-[44px] text-[24px]" : "h-[66px] w-[66px] text-[38px]"
          )}
        >
          A
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[26px] font-medium tracking-[0.26em] text-white">APEX</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Content Engine
            </div>
          </div>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden pb-4", collapsed ? "px-2" : "px-[14px]")}>
        {groups.map((group) => (
          <div
            key={group.title}
            className="border-t border-white/10 pb-3 pt-5 first:border-t-0 first:pt-0"
          >
            {!collapsed && (
              <div className="px-3 pb-3 text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">
                {group.title}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-[47px] items-center rounded-[3px] text-[14px] font-semibold transition",
                      collapsed ? "justify-center px-0" : "gap-4 px-3",
                      active
                        ? "bg-[#d7c1ff] text-[#111719]"
                        : "text-white/92 hover:bg-white/8 hover:text-white"
                    )}
                  >
                    <Icon className="h-[21px] w-[21px] shrink-0 stroke-[2.2]" />
                    {!collapsed && item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <Link
        href="/profile"
        title={collapsed ? name : undefined}
        className={cn(
          "mb-4 flex items-center rounded-[4px] border border-white/20 bg-white/[0.03] transition hover:bg-white/[0.07]",
          collapsed ? "mx-2 justify-center px-0 py-3" : "mx-[18px] gap-3 px-4 py-5 text-left"
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-[#ff9caf] font-semibold text-black",
            collapsed ? "h-[40px] w-[40px] text-[14px]" : "h-[52px] w-[52px] text-[17px]"
          )}
        >
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[15px] font-bold text-white">{name}</span>
              <span className="mt-1 block text-[13px] text-white/75">{role}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/80" />
          </>
        )}
      </Link>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mb-8 flex h-8 items-center text-[15px] text-white/85 transition hover:text-white",
          collapsed ? "justify-center px-0" : "gap-4 px-7"
        )}
      >
        {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  )
}

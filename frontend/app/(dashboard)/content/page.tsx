import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card } from "@/components/ui/card"

const links = [
  { href: "/content/sources", label: "Sources" },
  { href: "/content/raw-posts", label: "Raw Posts" },
  { href: "/content/clusters", label: "Topic Clusters" },
  { href: "/content/drafts", label: "Drafts" },
  { href: "/content/calendar", label: "Calendar" },
  { href: "/content/published", label: "Published Posts" },
]

export default function ContentHubPage() {
  return (
    <div>
      <PageHeader title="Content Engine" subtitle="Module 4 — sources, clustering, drafts, publishing" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="transition hover:border-violet-300 hover:shadow-md">
              <span className="text-sm font-medium text-zinc-800">{l.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

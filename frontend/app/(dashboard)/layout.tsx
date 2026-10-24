import { Sidebar } from "@/components/layout/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f8f7f5]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}

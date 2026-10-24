import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "APEX — Content Engine",
  description: "AI content automation: collect, cluster, synthesize, publish.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

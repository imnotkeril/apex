import { getSession } from "@/lib/auth"

export const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || ""

// Dev-auth (no backend) mode: failed GETs resolve to null so pages fall back to
// an empty state instead of "Failed to fetch" (no placeholder data is ever substituted).
const DEV_NO_BACKEND = process.env.NEXT_PUBLIC_DEV_AUTH === "true"

// FastAPI errors arrive as {"detail": "..."} — surface the human message, not raw JSON.
function errorMessage(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed?.detail === "string") return parsed.detail
    if (parsed?.detail) return JSON.stringify(parsed.detail)
  } catch {
    /* not JSON */
  }
  return text || fallback
}

export async function contentFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const session = await getSession()
  const token = session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const method = init.method || "GET"
  if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  let res: Response
  try {
    res = await fetch(`${baseUrl()}/api/v1/content${path}`, { ...init, headers, cache: "no-store" })
  } catch (e) {
    if (DEV_NO_BACKEND && method === "GET") return null
    throw e
  }
  if (!res.ok) {
    if (DEV_NO_BACKEND && method === "GET") return null
    const text = await res.text()
    throw new Error(errorMessage(text, res.statusText))
  }
  if (res.status === 204) return null
  const ct = res.headers.get("content-type")
  if (ct?.includes("application/json")) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

// Downloads a /api/v1/content/* endpoint as a file (e.g. JSON export) and
// triggers a browser save, reusing the same auth header attachment as contentFetch.
export async function contentDownload(path: string, filename: string): Promise<void> {
  const session = await getSession()
  const token = session?.access_token
  const headers = new Headers()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const res = await fetch(`${baseUrl()}/api/v1/content${path}`, { headers, cache: "no-store" })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(errorMessage(text, res.statusText))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Generic /api/v1/* fetch (auth, users, orgs — outside the content module).
export async function apiV1Fetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const session = await getSession()
  const token = session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const method = init.method || "GET"
  if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(`${baseUrl()}/api/v1${path}`, { ...init, headers, cache: "no-store" })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(errorMessage(text, res.statusText))
  }
  if (res.status === 204) return null
  const ct = res.headers.get("content-type")
  if (ct?.includes("application/json")) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

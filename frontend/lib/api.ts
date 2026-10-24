const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export async function apiFetch(path: string, init: RequestInit & { accessToken?: string } = {}) {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (init.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`)
  }
  const { accessToken: _a, ...rest } = init
  return fetch(`${base}${path}`, { ...rest, headers })
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ getSession: async () => ({ access_token: "tok" }) }))

import { contentDownload, contentFetch } from "@/lib/api/content"

const fetchMock = vi.fn()
beforeEach(() => vi.stubGlobal("fetch", fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init })

describe("contentFetch", () => {
  it("sends the bearer token and parses JSON", async () => {
    fetchMock.mockResolvedValue(json([{ id: 1 }]))
    const out = await contentFetch("/sources")
    expect(out).toEqual([{ id: 1 }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/v1/content/sources")
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok")
  })

  it("sets JSON content type on writes only", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }))
    await contentFetch("/drafts", { method: "POST", body: "{}" })
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Content-Type")).toBe("application/json")
  })

  it("surfaces the FastAPI detail message on errors", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Pipeline is already running" }, { status: 409 }))
    await expect(contentFetch("/drafts/1/regenerate", { method: "POST" })).rejects.toThrow("Pipeline is already running")
  })

  it("returns null for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    expect(await contentFetch("/x", { method: "DELETE" })).toBeNull()
  })
})

describe("contentDownload", () => {
  it("throws the server message when the export fails", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Draft has no text for this language yet" }, { status: 409 }))
    await expect(contentDownload("/drafts/1/pdf", "d.pdf")).rejects.toThrow("no text")
  })
})

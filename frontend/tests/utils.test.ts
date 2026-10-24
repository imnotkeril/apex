import { describe, expect, it, vi, afterEach } from "vitest"
import { cn, hoursAgo, timeAgo } from "@/lib/utils"

afterEach(() => vi.useRealTimers())

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4")
  })
})

describe("timeAgo", () => {
  it("handles empty and invalid input", () => {
    expect(timeAgo(null)).toBe("—")
    expect(timeAgo("not a date")).toBe("—")
  })
  it("buckets minutes, hours and days", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"))
    expect(timeAgo("2026-10-24T11:59:30Z")).toBe("just now")
    expect(timeAgo("2026-10-24T11:15:00Z")).toBe("45m ago")
    expect(timeAgo("2026-10-24T07:00:00Z")).toBe("5h ago")
    expect(timeAgo("2026-10-21T12:00:00Z")).toBe("3d ago")
  })
})

describe("hoursAgo", () => {
  it("formats freshness hours", () => {
    expect(hoursAgo(null)).toBe("—")
    expect(hoursAgo(0.5)).toBe("30m ago")
    expect(hoursAgo(5)).toBe("5h ago")
    expect(hoursAgo(48)).toBe("2d ago")
  })
})

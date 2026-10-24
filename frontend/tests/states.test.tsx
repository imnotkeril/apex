import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmptyState, ErrorState } from "@/components/ui/states"

describe("states", () => {
  it("EmptyState shows title and hint", () => {
    render(<EmptyState title="No sources yet" hint="Add a source to start collecting posts." />)
    expect(screen.getByText("No sources yet")).toBeTruthy()
    expect(screen.getByText("Add a source to start collecting posts.")).toBeTruthy()
  })

  it("ErrorState shows the error message, with a default", () => {
    const { rerender } = render(<ErrorState error={new Error("boom")} />)
    expect(screen.getByText("boom")).toBeTruthy()
    rerender(<ErrorState />)
    expect(screen.getByText("Failed to load data")).toBeTruthy()
  })
})

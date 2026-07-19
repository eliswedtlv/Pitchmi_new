import { describe, it, expect } from "vitest"
import { recorderConstraints } from "../recorderConstraints"

describe("recorderConstraints", () => {
  it("returns portrait dimensions for portrait viewports", () => {
    const c = recorderConstraints(true)
    expect(c.width).toEqual({ ideal: 720 })
    expect(c.height).toEqual({ ideal: 1280 })
    // aspectRatio is width/height — must be < 1 for portrait
    expect((c.aspectRatio as { ideal: number }).ideal).toBeCloseTo(720 / 1280, 4)
    expect((c.aspectRatio as { ideal: number }).ideal).toBeLessThan(1)
  })

  it("returns landscape 16:9 dimensions for desktop", () => {
    const c = recorderConstraints(false)
    expect(c.width).toEqual({ ideal: 1280 })
    expect(c.height).toEqual({ ideal: 720 })
    expect((c.aspectRatio as { ideal: number }).ideal).toBeCloseTo(1280 / 720, 4)
    expect((c.aspectRatio as { ideal: number }).ideal).toBeGreaterThan(1)
  })

  it("keeps the user-facing camera in both orientations", () => {
    expect(recorderConstraints(true).facingMode).toBe("user")
    expect(recorderConstraints(false).facingMode).toBe("user")
  })
})

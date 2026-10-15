import { describe, it, expect } from "vitest"
import { recorderConstraints, frameOrientation, streamOrientation } from "../recorderConstraints"

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

describe("frameOrientation / streamOrientation (KP-F)", () => {
  const stream = (settings: MediaTrackSettings) =>
    ({ getVideoTracks: () => [{ getSettings: () => settings }] }) as unknown as MediaStream

  it("classifies frame sizes", () => {
    expect(frameOrientation(720, 1280)).toBe("portrait")
    expect(frameOrientation(1280, 720)).toBe("landscape")
    expect(frameOrientation(0, 0)).toBe("unknown")
    expect(frameOrientation(undefined, 720)).toBe("unknown")
  })

  it("prefers the preview's decoded frames over track settings", () => {
    const video = { videoWidth: 720, videoHeight: 1280 }
    expect(streamOrientation(video, stream({ width: 1280, height: 720 }))).toBe("portrait")
  })

  it("falls back to track settings before the preview has frames", () => {
    expect(streamOrientation({ videoWidth: 0, videoHeight: 0 }, stream({ width: 1280, height: 720 }))).toBe("landscape")
    expect(streamOrientation(null, stream({}))).toBe("unknown")
  })
})

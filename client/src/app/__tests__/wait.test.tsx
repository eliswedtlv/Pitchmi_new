import { render, screen, act, fireEvent } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Shared mocks (hoisted so the vi.mock factories can reference them).
const h = vi.hoisted(() => ({
  push: vi.fn(),
  getAd: vi.fn(),
  getRhythm: vi.fn(),
  setPathResult: vi.fn(),
  setTakeRhythm: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({ getAd: h.getAd, getRhythm: h.getRhythm }))
vi.mock("@/store/session", () => ({
  useSession: () => ({
    project: { id: "p1" },
    script: "hello",
    takeBlob: new Blob(["take"]),
    setPathResult: h.setPathResult,
    setTakeRhythm: h.setTakeRhythm,
  }),
}))

import WaitPage from "../wait/page"

const NO_MATCH = { path: null, coverage: 0.2, language: "en", rhythms_left_today: 5 }

// jsdom doesn't implement media playback; AdSlot calls video.play().catch().
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  h.getAd.mockResolvedValue({ type: "demo", url: "/ads/demo.mp4", skippable_after_s: 5 })
})

describe("WaitPage — Skip Ad never aborts the pending upload", () => {
  it("keeps the rhythm promise alive after Skip Ad, then routes to results when it resolves", async () => {
    vi.useFakeTimers()

    // A deferred we resolve by hand — stands in for the 60–120s server call.
    let resolveRhythm: (v: unknown) => void = () => {}
    h.getRhythm.mockImplementation(
      () => new Promise((res) => { resolveRhythm = res }),
    )

    render(<WaitPage />)

    // Flush getAd's microtask so the ad (and its Skip countdown) mounts.
    await act(async () => { await Promise.resolve() })

    // Upload kicked off exactly once.
    expect(h.getRhythm).toHaveBeenCalledTimes(1)
    expect(h.getRhythm.mock.calls[0][1]).toBe("p1")

    // Advance past the 5s skippable window so "Skip Ad" appears.
    await act(async () => { vi.advanceTimersByTime(5000) })
    const skip = screen.getByRole("button", { name: /skip ad/i })

    // Tapping Skip only hides the ad — it must not abort or re-issue the eval,
    // and must not navigate away.
    await act(async () => { fireEvent.click(skip) })

    expect(h.getRhythm).toHaveBeenCalledTimes(1) // not re-called / not aborted
    expect(h.push).not.toHaveBeenCalled() // still waiting on the pending request
    expect(screen.queryByRole("button", { name: /skip ad/i })).toBeNull() // ad hidden

    // The still-pending request now resolves — flow completes normally.
    await act(async () => {
      resolveRhythm(NO_MATCH)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(h.setTakeRhythm).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/results")

    vi.useRealTimers()
  })
})

describe("WaitPage — transport outcomes route correctly (never an eternal spinner)", () => {
  it("a resolved upload routes to /results", async () => {
    h.getRhythm.mockResolvedValue(NO_MATCH)
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(h.setTakeRhythm).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/results")
  })

  it("a network error shows the error screen and does not navigate", async () => {
    h.getRhythm.mockRejectedValue(Object.assign(new Error("Network error"), { status: 0 }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/network error/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /back to home/i })).toBeTruthy()
    expect(h.push).not.toHaveBeenCalledWith("/results")
  })

  it("a timeout shows the error screen (no infinite wait)", async () => {
    h.getRhythm.mockRejectedValue(Object.assign(new Error("Upload timed out"), { status: 0 }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/timed out/i)).toBeTruthy()
    expect(h.push).not.toHaveBeenCalledWith("/results")
  })

  it("a 429 shows the daily-limit message", async () => {
    h.getRhythm.mockRejectedValue(Object.assign(new Error("limit"), { status: 429, body: { error: "daily_limit", limit: 25 } }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/daily limit reached \(25\/day\)/i)).toBeTruthy()
  })

  it("a 503 says we're busy", async () => {
    h.getRhythm.mockRejectedValue(Object.assign(new Error("busy"), { status: 503, body: { error: "busy" } }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/busy right now/i)).toBeTruthy()
  })
})

// KP-B: every unlocked take that matches the script becomes the rhythm. The
// wait screen is where it arrives, and it has to be adopted before "Try again"
// sends the user back to /karaoke.
describe("WaitPage — adopting the take's rhythm", () => {
  const RETIMED = {
    words: [{ w: "hello", t_start: 0.4, t_end: 0.9, line: 0 }],
    lines: [{ index: 0, text: "hello", t_start: 0.4, t_end: 0.9 }],
    total_s: 0.9,
  }

  it("stores a returned path so the next take follows the measured pace", async () => {
    h.getRhythm.mockResolvedValue({ path: RETIMED, coverage: 0.9, language: "en", rhythms_left_today: 4 })
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(h.setPathResult).toHaveBeenCalledWith({
      path: RETIMED,
      fits: true,
      est_duration_s: 0.9,
    })
    expect(h.setTakeRhythm).toHaveBeenCalledWith("new")
    expect(h.push).toHaveBeenCalledWith("/results")
  })

  it("a null path keeps the old rhythm and says so", async () => {
    h.getRhythm.mockResolvedValue(NO_MATCH)
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(h.setPathResult).not.toHaveBeenCalled()
    expect(h.setTakeRhythm).toHaveBeenCalledWith("unchanged")
    expect(h.push).toHaveBeenCalledWith("/results")
  })
})

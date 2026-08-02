import { render, screen, act, fireEvent } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Shared mocks (hoisted so the vi.mock factories can reference them).
const h = vi.hoisted(() => ({
  push: vi.fn(),
  getAd: vi.fn(),
  evaluateVideo: vi.fn(),
  setEvalResult: vi.fn(),
  setPathResult: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({ getAd: h.getAd, evaluateVideo: h.evaluateVideo }))
vi.mock("@/store/session", () => ({
  useSession: () => ({
    project: { id: "p1" },
    takeBlob: new Blob(["take"]),
    setEvalResult: h.setEvalResult,
    setPathResult: h.setPathResult,
  }),
}))

import WaitPage from "../wait/page"

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

describe("WaitPage — Skip Ad never aborts the pending evaluation", () => {
  it("keeps the eval promise alive after Skip Ad, then routes to results when it resolves", async () => {
    vi.useFakeTimers()

    // A deferred we resolve by hand — stands in for the 60–120s server call.
    let resolveEval: (v: unknown) => void = () => {}
    h.evaluateVideo.mockImplementation(
      () => new Promise((res) => { resolveEval = res }),
    )

    render(<WaitPage />)

    // Flush getAd's microtask so the ad (and its Skip countdown) mounts.
    await act(async () => { await Promise.resolve() })

    // Evaluation kicked off exactly once.
    expect(h.evaluateVideo).toHaveBeenCalledTimes(1)
    expect(h.evaluateVideo.mock.calls[0][1]).toBe("p1")

    // Advance past the 5s skippable window so "Skip Ad" appears.
    await act(async () => { vi.advanceTimersByTime(5000) })
    const skip = screen.getByRole("button", { name: /skip ad/i })

    // Tapping Skip only hides the ad — it must not abort or re-issue the eval,
    // and must not navigate away.
    await act(async () => { fireEvent.click(skip) })

    expect(h.evaluateVideo).toHaveBeenCalledTimes(1) // not re-called / not aborted
    expect(h.push).not.toHaveBeenCalled() // still waiting on the pending request
    expect(screen.queryByRole("button", { name: /skip ad/i })).toBeNull() // ad hidden

    // The still-pending request now resolves — flow completes normally.
    await act(async () => {
      resolveEval({ overall: 88, dimensions: {}, comments: [], flags: [], evals_left_today: 5 })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(h.setEvalResult).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/results")

    vi.useRealTimers()
  })
})

describe("WaitPage — transport outcomes route correctly (never an eternal spinner)", () => {
  it("a resolved eval routes to /results", async () => {
    h.evaluateVideo.mockResolvedValue({
      overall: 90, dimensions: {}, comments: [], flags: [], evals_left_today: 4,
    })
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(h.setEvalResult).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/results")
  })

  it("a network error shows the error screen and does not navigate", async () => {
    h.evaluateVideo.mockRejectedValue(Object.assign(new Error("Network error"), { status: 0 }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/network error/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /back to home/i })).toBeTruthy()
    expect(h.push).not.toHaveBeenCalledWith("/results")
  })

  it("a timeout shows the error screen (no infinite wait)", async () => {
    h.evaluateVideo.mockRejectedValue(Object.assign(new Error("Evaluation timed out"), { status: 0 }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/timed out/i)).toBeTruthy()
    expect(h.push).not.toHaveBeenCalledWith("/results")
  })

  it("a 504 upstream timeout shows the friendly retry message, not raw JSON", async () => {
    h.evaluateVideo.mockRejectedValue(
      Object.assign(new Error("eval_upstream_timeout"), {
        status: 504,
        body: { error: "eval_upstream_timeout" },
      }),
    )
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/took too long/i)).toBeTruthy()
    expect(screen.queryByText(/eval_upstream_timeout/)).toBeNull()
    expect(h.push).not.toHaveBeenCalledWith("/results")
  })

  it("a 429 shows the daily-limit message", async () => {
    h.evaluateVideo.mockRejectedValue(Object.assign(new Error("limit"), { status: 429, body: { limit: 25 } }))
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText(/daily evaluation limit/i)).toBeTruthy()
  })
})

// T-10018: every take teaches the prompter the user's real pace. The wait
// screen is where that re-timed path arrives, and it has to be adopted before
// "Try again" sends the user back to /karaoke.
describe("WaitPage — adopting the re-timed prompter path", () => {
  const RETIMED = {
    words: [{ w: "hello", t_start: 0.4, t_end: 0.9, line: 0 }],
    lines: [{ index: 0, text: "hello", t_start: 0.4, t_end: 0.9 }],
    total_s: 0.9,
  }

  it("stores a returned path so the next take follows the measured pace", async () => {
    h.evaluateVideo.mockResolvedValue({
      overall: 90, dimensions: {}, comments: [], flags: [], evals_left_today: 4, path: RETIMED,
    })
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(h.setPathResult).toHaveBeenCalledWith({
      path: RETIMED,
      fits: true,
      est_duration_s: 0.9,
    })
    expect(h.push).toHaveBeenCalledWith("/results")
  })

  it("leaves the current path alone when the take drifted too far to re-time", async () => {
    h.evaluateVideo.mockResolvedValue({
      overall: 60, dimensions: {}, comments: [], flags: [], evals_left_today: 4,
    })
    render(<WaitPage />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(h.setPathResult).not.toHaveBeenCalled()
    expect(h.push).toHaveBeenCalledWith("/results")
  })
})

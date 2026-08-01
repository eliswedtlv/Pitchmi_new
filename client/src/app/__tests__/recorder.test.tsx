import { render, screen, cleanup, act } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Capture the recorder's onStop so the test can drive the post-take flow, and
// stub transcribe + router. The session store is REAL so we can assert it.
type StopReason = "user" | "limit"

const h = vi.hoisted(() => ({
  push: vi.fn(),
  transcribeVideo: vi.fn(),
  start: vi.fn(),
  onStop: undefined as undefined | ((blob: Blob, reason: "user" | "limit") => Promise<void> | void),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({ transcribeVideo: h.transcribeVideo }))
vi.mock("@/hooks/useWakeLock", () => ({ useWakeLock: () => {} }))
vi.mock("@/hooks/useRecorder", () => ({
  useRecorder: (opts: { onStop: (b: Blob, r: StopReason) => Promise<void> | void }) => {
    h.onStop = opts.onStop
    return {
      state: "idle",
      countdown: 0,
      elapsed: 0,
      videoRef: { current: null },
      start: h.start,
      stop: vi.fn(),
      error: null,
      stopReason: null,
    }
  },
}))

import RecorderPage from "../recorder/page"
import { useSession } from "@/store/session"

// jsdom has no object-URL support; setTakeBlob creates one for the preview.
beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:test" })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} })
})

beforeEach(() => {
  vi.clearAllMocks()
  useSession.getState().reset()
})

afterEach(cleanup)

function seedProject() {
  useSession.getState().setProject({
    id: "p1",
    user_id: "u1",
    title: "t",
    use_case: "pitch",
    speed: 1,
    created_at: "",
    updated_at: "",
  })
}

const PATH = {
  words: [{ w: "hi", t_start: 0, t_end: 0.4, line: 0 }],
  lines: [{ index: 0, text: "hi", t_start: 0, t_end: 0.4 }],
  total_s: 0.4,
}

describe("RecorderPage — zero-edit flow (T-1169)", () => {
  it("stores the subtitle structure + language and goes straight to /karaoke (no editor)", async () => {
    // A project created before transcribe: no language yet.
    seedProject()
    expect(useSession.getState().project?.language).toBeUndefined()

    const path = {
      words: [
        { w: "שלום", t_start: 0, t_end: 0.4, line: 0 },
        { w: "עולם", t_start: 0.5, t_end: 1.0, line: 0 },
      ],
      lines: [{ index: 0, text: "שלום עולם", t_start: 0, t_end: 1.0 }],
      total_s: 1.0,
    }
    h.transcribeVideo.mockResolvedValue({
      script: "שלום עולם",
      language: "he",
      path,
      duration_s: 1,
    })

    render(<RecorderPage />)

    await act(async () => {
      await h.onStop?.(new Blob(["take"]), "user")
    })

    expect(h.transcribeVideo).toHaveBeenCalledWith(expect.any(Blob), "p1")
    expect(useSession.getState().project?.language).toBe("he")
    // Subtitle structure is stored for karaoke to consume.
    expect(useSession.getState().pathResult?.path).toEqual(path)
    // Next stop is karaoke — the editor route is gone.
    expect(h.push).toHaveBeenCalledWith("/karaoke")
    expect(h.push).not.toHaveBeenCalledWith("/editor")
  })
})

describe("RecorderPage — 30s hard-cap interstitial (T-1172)", () => {
  it("a timer-stopped take is held back: interstitial shown, nothing transcribed yet", async () => {
    seedProject()
    render(<RecorderPage />)

    await act(async () => {
      await h.onStop?.(new Blob(["cut-off"]), "limit")
    })

    expect(screen.getByText(/Time's up — 30 seconds\./)).toBeTruthy()
    expect(screen.getByRole("button", { name: /record again/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /use this take/i })).toBeTruthy()
    // The severed take must NOT reach /api/transcribe until the user chooses.
    expect(h.transcribeVideo).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalled()
  })

  it("a user-stopped take transcribes immediately, with no interstitial", async () => {
    seedProject()
    h.transcribeVideo.mockResolvedValue({ script: "hi", language: "en", path: PATH, duration_s: 0.4 })
    render(<RecorderPage />)

    await act(async () => {
      await h.onStop?.(new Blob(["take"]), "user")
    })

    expect(screen.queryByText(/Time's up/)).toBeNull()
    expect(h.transcribeVideo).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/karaoke")
  })

  it('"Use this take" runs the normal transcribe path on the held-back blob', async () => {
    seedProject()
    h.transcribeVideo.mockResolvedValue({ script: "hi", language: "en", path: PATH, duration_s: 0.4 })
    render(<RecorderPage />)

    await act(async () => {
      await h.onStop?.(new Blob(["cut-off"]), "limit")
    })
    await act(async () => {
      screen.getByRole("button", { name: /use this take/i }).click()
    })

    expect(h.transcribeVideo).toHaveBeenCalledWith(expect.any(Blob), "p1")
    expect(h.push).toHaveBeenCalledWith("/karaoke")
  })

  it('"Record again" restarts the recorder and never transcribes the cut-off take', async () => {
    seedProject()
    render(<RecorderPage />)

    await act(async () => {
      await h.onStop?.(new Blob(["cut-off"]), "limit")
    })
    await act(async () => {
      screen.getByRole("button", { name: /record again/i }).click()
    })

    expect(h.start).toHaveBeenCalled()
    expect(screen.queryByText(/Time's up/)).toBeNull()
    expect(h.transcribeVideo).not.toHaveBeenCalled()
  })
})

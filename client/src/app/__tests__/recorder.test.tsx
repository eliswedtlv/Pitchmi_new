import { render, act } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Capture the recorder's onStop so the test can drive the post-take flow, and
// stub transcribe + router. The session store is REAL so we can assert it.
const h = vi.hoisted(() => ({
  push: vi.fn(),
  transcribeVideo: vi.fn(),
  onStop: undefined as undefined | ((blob: Blob) => Promise<void> | void),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({ transcribeVideo: h.transcribeVideo }))
vi.mock("@/hooks/useWakeLock", () => ({ useWakeLock: () => {} }))
vi.mock("@/hooks/useRecorder", () => ({
  useRecorder: (opts: { onStop: (b: Blob) => Promise<void> | void }) => {
    h.onStop = opts.onStop
    return {
      state: "idle",
      countdown: 0,
      elapsed: 0,
      videoRef: { current: null },
      start: vi.fn(),
      stop: vi.fn(),
      error: null,
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

describe("RecorderPage — zero-edit flow (T-1169)", () => {
  it("stores the subtitle structure + language and goes straight to /karaoke (no editor)", async () => {
    // A project created before transcribe: no language yet.
    useSession.getState().setProject({
      id: "p1",
      user_id: "u1",
      title: "t",
      use_case: "pitch",
      speed: 1,
      created_at: "",
      updated_at: "",
    })
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
      await h.onStop?.(new Blob(["take"]))
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

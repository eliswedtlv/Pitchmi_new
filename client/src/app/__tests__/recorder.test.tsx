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

describe("RecorderPage — persists the detected language after transcribe (T-1164)", () => {
  it("writes result.language onto the project so downstream dir resolution works", async () => {
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

    h.transcribeVideo.mockResolvedValue({
      text: "היי\nשלום עולם",
      language: "he",
      words: [],
      duration_s: 2,
    })

    render(<RecorderPage />)

    await act(async () => {
      await h.onStop?.(new Blob(["take"]))
    })

    expect(h.transcribeVideo).toHaveBeenCalledWith(expect.any(Blob), "p1")
    expect(useSession.getState().project?.language).toBe("he")
    expect(useSession.getState().editedScript).toBe("היי\nשלום עולם")
    expect(h.push).toHaveBeenCalledWith("/editor")
  })
})

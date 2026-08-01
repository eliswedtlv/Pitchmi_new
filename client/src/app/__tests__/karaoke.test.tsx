import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// T-10010: the karaoke screen used to read only { state, countdown, videoRef,
// start, stop } and render nothing for state === "error". Denying camera on the
// rehearsal take — or a device still busy right after take 1 — left a black
// fixed-inset div with no message and no way out but editing the URL.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  recorder: {
    state: "error",
    countdown: 0,
    elapsed: 0,
    videoRef: { current: null },
    start: vi.fn(),
    stop: vi.fn(),
    error: null as string | null,
    stopReason: null,
  },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/hooks/useWakeLock", () => ({ useWakeLock: () => {} }))
vi.mock("@/hooks/useKaraokeClock", () => ({ useKaraokeClock: () => 0 }))
vi.mock("@/hooks/useRecorder", () => ({ useRecorder: () => h.recorder }))

import KaraokePage from "../karaoke/page"
import { useSession } from "@/store/session"

const PATH = {
  words: [{ w: "hi", t_start: 0, t_end: 0.4, line: 0 }],
  lines: [{ index: 0, text: "hi", t_start: 0, t_end: 0.4 }],
  total_s: 0.4,
}

beforeEach(() => {
  vi.clearAllMocks()
  useSession.getState().reset()
  useSession.getState().setProject({
    id: "p1",
    user_id: "u1",
    title: "t",
    use_case: "pitch",
    speed: 1,
    created_at: "",
    updated_at: "",
  })
  useSession.getState().setPathResult({ path: PATH, fits: true, est_duration_s: 0.4 })
  h.recorder.state = "error"
  h.recorder.error = null
})

afterEach(cleanup)

describe("KaraokePage — recorder error state (T-10010)", () => {
  it("shows the recorder's message and a way back home", async () => {
    h.recorder.error = "Camera access denied. Please allow camera and microphone access."
    render(<KaraokePage />)

    expect(screen.getByText(/Camera access denied/)).toBeTruthy()
    const back = screen.getByRole("button", { name: /go back/i })
    back.click()
    expect(h.push).toHaveBeenCalledWith("/")
  })

  it("renders nothing extra while recording normally", () => {
    h.recorder.state = "recording"
    h.recorder.error = null
    render(<KaraokePage />)

    expect(screen.queryByRole("button", { name: /go back/i })).toBeNull()
    expect(screen.getByRole("button", { name: /stop recording/i })).toBeTruthy()
  })
})

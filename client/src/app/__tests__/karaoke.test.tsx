import { act, render, screen, cleanup, fireEvent } from "@testing-library/react"
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
  recorderOpts: null as null | { maxDurationS?: number; onStop?: (blob: Blob) => void },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/hooks/useWakeLock", () => ({ useWakeLock: () => {} }))
vi.mock("@/hooks/useKaraokeClock", () => ({ useKaraokeClock: () => 0 }))
vi.mock("@/hooks/useRecorder", () => ({
  useRecorder: (opts: typeof h.recorderOpts) => {
    h.recorderOpts = opts
    return h.recorder
  },
}))

import KaraokePage from "../karaoke/page"
import { useSession } from "@/store/session"
import { resetUiLangForTests, setUiLang } from "@/hooks/useUiLang"

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

describe("KaraokePage — take 1 is a teleprompter (KP-B)", () => {
  const SCRIPT = "We build tools. Founders pitch better with them every day"

  beforeEach(() => {
    useSession.getState().setPathResult(null)
    useSession.getState().setScript(SCRIPT)
    h.recorder.state = "recording"
  })

  it("shows the script in the prompter with no rhythm, capped at 5 minutes", () => {
    render(<KaraokePage />)
    expect(screen.getByTestId("prompter-advance")).toBeTruthy()
    expect(screen.getByTestId("take1-explainer").textContent).toMatch(/Take 1 learns your pace/)
    expect(screen.getByTestId("active-line").textContent).toBe("We build tools.")
    expect(h.recorderOpts?.maxDurationS).toBe(300)
  })

  it("manual advance (tap, keys) moves the active line", () => {
    render(<KaraokePage />)
    fireEvent.click(screen.getByTestId("prompter-advance"))
    expect(screen.getByTestId("active-line").textContent).toMatch(/^Founders pitch/)

    fireEvent.keyDown(window, { key: "ArrowUp" })
    expect(screen.getByTestId("active-line").textContent).toBe("We build tools.")

    fireEvent.keyDown(window, { key: " " })
    expect(screen.getByTestId("active-line").textContent).toMatch(/^Founders pitch/)
  })

  it("mirrors the live preview", () => {
    render(<KaraokePage />)
    expect(document.querySelector("video")?.className).toMatch(/scale-x-\[-1\]/)
  })

  it("an unlocked take goes to /wait to learn its rhythm", () => {
    render(<KaraokePage />)
    h.recorderOpts?.onStop?.(new Blob(["t"]))
    expect(h.push).toHaveBeenCalledWith("/wait")
  })
})

describe("KaraokePage — karaoke from take 2 and the rhythm lock (KP-B)", () => {
  beforeEach(() => {
    h.recorder.state = "recording"
  })

  // Eli 2026-10-15: a karaoke take no longer stops 3 s after the rhythm —
  // a slower reading was cut off mid-sentence. Only the speaker or the cap stop it.
  it("follows the rhythm and runs until the speaker stops (only the 5-minute cap)", () => {
    render(<KaraokePage />)
    expect(screen.getByText("Recording")).toBeTruthy()
    expect(screen.queryByTestId("prompter-advance")).toBeNull()
    expect(screen.queryByTestId("take1-explainer")).toBeNull()
    expect(h.recorderOpts?.maxDurationS).toBe(300)
  })

  it("never lets a long rhythm exceed the 5-minute cap", () => {
    useSession.getState().setPathResult({ path: { ...PATH, total_s: 299 }, fits: true, est_duration_s: 299 })
    render(<KaraokePage />)
    expect(h.recorderOpts?.maxDurationS).toBe(300)
  })

  it("a locked rhythm skips the upload and goes straight to results", () => {
    useSession.getState().setRhythmLocked(true)
    render(<KaraokePage />)
    h.recorderOpts?.onStop?.(new Blob(["t"]))
    expect(h.push).toHaveBeenCalledWith("/results")
    expect(h.push).not.toHaveBeenCalledWith("/wait")
    expect(useSession.getState().takeRhythm).toBe("locked")
    expect(useSession.getState().pathResult?.path).toBe(PATH)
  })
})

describe("KaraokePage — script direction ignores the UI language (KP-D)", () => {
  afterEach(() => {
    window.localStorage.clear()
    act(() => resetUiLangForTests())
  })

  it("an English script in the Hebrew UI keeps the prompter LTR", () => {
    act(() => setUiLang("he"))
    useSession.getState().setPathResult(null)
    useSession.getState().setScript("We build tools. Founders pitch better with them every day")
    h.recorder.state = "recording"
    render(<KaraokePage />)

    expect(document.documentElement.dir).toBe("rtl")
    expect(screen.getByTestId("prompter").getAttribute("dir")).toBe("ltr")
    expect(screen.getByTestId("active-line").getAttribute("dir")).toBe("ltr")
    // The chrome is Hebrew.
    expect(screen.getByRole("button", { name: "עצירת ההקלטה" })).toBeTruthy()
  })

  it("a Hebrew script in the English UI keeps the prompter RTL", () => {
    act(() => setUiLang("en"))
    useSession.getState().setPathResult(null)
    useSession.getState().setScript("אנחנו בונים כלים. מייסדים מציגים טוב יותר")
    h.recorder.state = "recording"
    render(<KaraokePage />)

    expect(document.documentElement.dir).toBe("ltr")
    expect(screen.getByTestId("prompter").getAttribute("dir")).toBe("rtl")
  })
})

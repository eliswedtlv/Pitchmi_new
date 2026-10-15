import { act, render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Results-screen actions (T-1170 §B): Try again (green primary), New video,
// Share. Download and Save-to-cloud are gone; Share uses the OS share sheet and
// falls back to a direct download when files can't be shared (most desktop
// browsers). T-10018 adds Edit text alongside them, without changing the
// hierarchy — Try again is still the primary. KP-B removes the score entirely
// and adds "Keep this rhythm".

const PATH = {
  words: [{ w: "hi", t_start: 0, t_end: 0.4, line: 0 }],
  lines: [{ index: 0, text: "hi", t_start: 0, t_end: 0.4 }],
  total_s: 0.4,
}

const baseSession = () => ({
  project: { id: "p1", language: "en" },
  takeBlob: new Blob(["take"], { type: "video/webm" }),
  takeBlobUrl: "blob:take",
  pathResult: { path: PATH, fits: true, est_duration_s: 0.4 } as unknown,
  rhythmLocked: false,
  takeRhythm: "new" as string | null,
  setRhythmLocked: vi.fn(),
  reset: vi.fn(),
})

const h = vi.hoisted(() => ({
  push: vi.fn(),
  session: {} as ReturnType<typeof baseSession>,
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/store/session", () => ({ useSession: () => h.session }))

import ResultsPage from "../results/page"
import { resetUiLangForTests, setUiLang } from "@/hooks/useUiLang"

// jsdom has neither share nor canShare; define them per-test on the real
// navigator rather than replacing it wholesale.
function stubShare(canShare: boolean, share = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "canShare", {
    value: vi.fn().mockReturnValue(canShare),
    configurable: true,
  })
  Object.defineProperty(navigator, "share", { value: share, configurable: true })
  return share
}

beforeEach(() => {
  vi.clearAllMocks()
  h.session = baseSession()
})

afterEach(() => {
  cleanup()
  delete (navigator as { canShare?: unknown }).canShare
  delete (navigator as { share?: unknown }).share
})

describe("ResultsPage actions", () => {
  // Rewritten twice, deliberately, and never dropped. It originally pinned the
  // literal `bg-green-600`; T-10022 moved it to `bg-primary` because green means
  // "scored >= 80" and nothing else; T-10024 moves it to `bg-accent` because the
  // one filled action is now where the brand accent is spent. The thing under
  // test has not changed across any of the three: Try again is unmistakably THE
  // primary action, because it is the only filled button on the screen.
  it("shows Try again as the one filled (primary) button", () => {
    render(<ResultsPage />)
    const btn = screen.getByRole("button", { name: /try again/i })
    expect(btn.className).toMatch(/bg-accent/)

    const filled = screen
      .getAllByRole("button")
      .filter((b) => /bg-accent|bg-primary/.test(b.className))
    expect(filled).toHaveLength(1)

    fireEvent.click(btn)
    expect(h.push).toHaveBeenCalledWith("/karaoke")
  })

  it("renders only Try again / Share / Keep this rhythm / Edit text / New video", () => {
    render(<ResultsPage />)
    const names = screen
      .getAllByRole("button")
      // T-10024: the take player contributes its own controls (play, mute and
      // the click-anywhere overlay on the picture). This assertion is about the
      // screen's ACTIONS, so it reads the action row rather than every button
      // in the document.
      .filter((b) => (b.textContent ?? "").trim().length > 0)
      // KP-D: the EN / עב header toggle is chrome, not an action.
      .filter((b) => !b.closest('[role="group"]'))
      .map((b) => b.textContent?.trim())
    // KP-G: Try again + Share sit directly under the take; the lock and the
    // quieter Edit text / New video follow.
    expect(names).toEqual(["Try again", "Share", "Keep this rhythm", "Edit text", "New video"])
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /save to cloud/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /my videos/i })).toBeNull()
  })

  // T-10024: the native `<video controls>` chrome was the largest object on the
  // screen users show other people. It is gone; `playsInline` is not, because
  // without it iOS Safari takes the take fullscreen and the user leaves.
  it("plays the take in the custom player, not the browser's chrome", () => {
    render(<ResultsPage />)
    const video = document.querySelector("video") as HTMLVideoElement

    expect(video).toBeTruthy()
    expect(video.hasAttribute("controls")).toBe(false)
    expect(video.hasAttribute("playsinline")).toBe(true)
    expect(screen.getAllByRole("button", { name: "Play" }).length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Seek")).toBeTruthy()
  })

  // T-10018: the way back to the words. The script must survive the trip, so
  // this button must NOT reset the session the way "New video" does — saving
  // the edited text re-seeds the path server-side and the next take rehearses
  // against the new words.
  it("Edit text goes home WITHOUT clearing the session script", () => {
    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /edit text/i }))

    expect(h.push).toHaveBeenCalledWith("/")
    expect(h.session.reset).not.toHaveBeenCalled()
  })

  it("New video still clears the session before going home", () => {
    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /new video/i }))

    expect(h.session.reset).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/")
  })

  it("Share calls navigator.share with the video file when files are supported", async () => {
    const share = stubShare(true)

    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /share/i }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const arg = share.mock.calls[0][0]
    expect(arg.files).toHaveLength(1)
    expect(arg.files[0].name).toBe("killerpitch-take.webm")
  })

  it("Share falls back to a direct download when files can't be shared", async () => {
    const share = stubShare(false)
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /share/i }))

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(share).not.toHaveBeenCalled()
    const a = click.mock.contexts[0] as HTMLAnchorElement
    expect(a.download).toBe("killerpitch-take.webm")
    click.mockRestore()
  })
})

describe("ResultsPage — no score, rhythm status (KP-B)", () => {
  it("shows no score, dimensions, coach notes or evaluations left", () => {
    render(<ResultsPage />)
    for (const text of [/overall score/i, /coach notes/i, /evaluations left/i, /voice/i, /accuracy/i]) {
      expect(screen.queryByText(text)).toBeNull()
    }
  })

  it("mirrors the take playback", () => {
    render(<ResultsPage />)
    expect(document.querySelector("video")?.className).toMatch(/scale-x-\[-1\]/)
  })

  it("Keep this rhythm locks the rhythm for the next takes", () => {
    render(<ResultsPage />)
    expect(screen.getByTestId("rhythm-note").textContent).toMatch(/rhythm you just set/)
    fireEvent.click(screen.getByRole("button", { name: /keep this rhythm/i }))
    expect(h.session.setRhythmLocked).toHaveBeenCalledWith(true)
  })

  it("while locked: says so, and Unlock releases it", () => {
    h.session.rhythmLocked = true
    h.session.takeRhythm = "locked"
    render(<ResultsPage />)
    expect(screen.getByTestId("rhythm-locked-note").textContent).toBe(
      "Rhythm locked — your next takes follow this take’s pace.",
    )
    expect(screen.getByTestId("rhythm-note").textContent).toMatch(/locked rhythm/)
    expect(screen.queryByRole("button", { name: /keep this rhythm/i })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }))
    expect(h.session.setRhythmLocked).toHaveBeenCalledWith(false)
  })

  it("a take that didn't match keeps the old rhythm and says so quietly", () => {
    h.session.takeRhythm = "unchanged"
    render(<ResultsPage />)
    expect(screen.getByTestId("rhythm-kept-note").textContent).toBe(
      "This take didn’t match your script closely, so your rhythm stayed the same.",
    )
    expect(screen.getByTestId("rhythm-note").textContent).toMatch(/earlier rhythm/)
  })

  it("with no rhythm yet, the next take is a teleprompter take and there is nothing to lock", () => {
    h.session.takeRhythm = "unchanged"
    h.session.pathResult = null
    render(<ResultsPage />)
    expect(screen.getByTestId("rhythm-note").textContent).toMatch(/teleprompter/)
    expect(screen.queryByRole("button", { name: /keep/i })).toBeNull()
  })
})

describe("ResultsPage — clear next step (KP-G)", () => {
  afterEach(() => {
    window.localStorage.clear()
    resetUiLangForTests()
  })

  it("says there is no score, and Try again comes right after it with Share next to it", () => {
    render(<ResultsPage />)
    const note = screen.getByTestId("no-score-note")
    expect(note.textContent).toMatch(/^No score here/)
    const tryAgain = screen.getByRole("button", { name: "Try again" })
    const share = screen.getByRole("button", { name: "Share" })
    // Same row, directly under the no-score line.
    expect(tryAgain.parentElement).toBe(share.parentElement)
    expect(note.nextElementSibling).toBe(tryAgain.parentElement)
  })

  it("explains the rhythm lock right under the button", () => {
    render(<ResultsPage />)
    const help = screen.getByTestId("keep-rhythm-help")
    expect(help.textContent).toBe(
      "Your next takes follow this take’s pace instead of updating each time.",
    )
    const btn = screen.getByRole("button", { name: /keep this rhythm/i })
    expect(btn.getAttribute("aria-describedby")).toBe(help.id)
  })

  it("Edit text and New video are quieter, secondary actions", () => {
    render(<ResultsPage />)
    for (const name of ["Edit text", "New video"]) {
      expect(screen.getByRole("button", { name }).className).not.toMatch(/bg-accent/)
    }
  })

  it("Hebrew: no-score line, primary Try again and lock helper are translated", () => {
    act(() => setUiLang("he"))
    render(<ResultsPage />)
    expect(screen.getByTestId("no-score-note").textContent).toMatch(/^אין כאן ציון/)
    expect(screen.getByRole("button", { name: "עוד טייק" }).className).toMatch(/bg-accent/)
    expect(screen.getByTestId("keep-rhythm-help").textContent).toBe(
      "הטייקים הבאים ילכו לפי הקצב של הטייק הזה, במקום להתעדכן בכל פעם.",
    )
    expect(screen.getByTestId("rhythm-note").textContent).toMatch(/^בטייק הבא:/)
  })

  it("Hebrew: locked state says so and offers Unlock", () => {
    act(() => setUiLang("he"))
    h.session.rhythmLocked = true
    h.session.takeRhythm = "locked"
    render(<ResultsPage />)
    expect(screen.getByTestId("rhythm-locked-note").textContent).toBe(
      "הקצב נעול — הטייקים הבאים ילכו לפי הקצב של הטייק הזה.",
    )
    expect(screen.getByRole("button", { name: /שחרור/ })).toBeTruthy()
  })
})

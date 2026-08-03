import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// T-10018: the entry point is TEXT. The user types or pastes a script, the
// server seeds a karaoke path from it, and the first take is recorded straight
// away — no improvise-first take, no upload-a-video path.
//
// T-1170 §B4: with Save-to-cloud removed nothing writes to storage, so the
// "My saved videos" entry point stays hidden.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  createProject: vi.fn(),
  saveScript: vi.fn(),
  setProject: vi.fn(),
  setScript: vi.fn(),
  setPathResult: vi.fn(),
  script: "",
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({
  createProject: h.createProject,
  saveScript: h.saveScript,
}))
vi.mock("@/store/session", () => ({
  useSession: () => ({
    script: h.script,
    setProject: h.setProject,
    setScript: h.setScript,
    setPathResult: h.setPathResult,
  }),
}))

import HomePage from "../page"

const SEED = {
  path: { words: [{ w: "hi", t_start: 0, t_end: 0.4, line: 0 }], lines: [], total_s: 6.2 },
  word_count: 12,
  est_duration_s: 6.2,
}

const textarea = () => screen.getByLabelText("Your script") as HTMLTextAreaElement
const recordButton = () => screen.getByRole("button", { name: /record it/i })

beforeEach(() => {
  vi.clearAllMocks()
  h.script = ""
  h.createProject.mockResolvedValue({ id: "p1" })
  h.saveScript.mockResolvedValue(SEED)
})

afterEach(cleanup)

describe("HomePage — the script screen", () => {
  it("renders a script textarea and none of the old record/upload entry points", () => {
    render(<HomePage />)

    expect(textarea()).toBeTruthy()
    expect(screen.queryByRole("button", { name: /record a take/i })).toBeNull()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    expect(screen.queryByText(/drag & drop/i)).toBeNull()
    expect(screen.queryByText(/drag &amp; drop/i)).toBeNull()
  })

  it("has no use-case picker", () => {
    render(<HomePage />)
    for (const label of ["Pitch", "Intro", "Sales", "Social", "Custom"]) {
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.queryByText(/what are you recording/i)).toBeNull()
    expect(screen.queryByPlaceholderText(/describe your video/i)).toBeNull()
  })

  it("shows the 30-second slogan and not the old one", () => {
    render(<HomePage />)
    expect(screen.getByText(/if you can’t say it in 30 seconds/i)).toBeTruthy()
    expect(screen.queryByText(/perfect your spoken video in minutes/i)).toBeNull()
  })

  it("does not link to My saved videos", () => {
    render(<HomePage />)
    expect(screen.queryByText(/my saved videos/i)).toBeNull()
    expect(document.querySelector('a[href="/videos"]')).toBeNull()
  })

  it("keeps the button disabled until something is typed", () => {
    render(<HomePage />)
    expect(recordButton()).toHaveProperty("disabled", true)

    fireEvent.change(textarea(), { target: { value: "   \n  " } })
    expect(recordButton()).toHaveProperty("disabled", true)

    fireEvent.change(textarea(), { target: { value: "ship it now" } })
    expect(recordButton()).toHaveProperty("disabled", false)
  })

  it("creates the project, saves the script, stores the seed path and goes to karaoke", async () => {
    render(<HomePage />)
    fireEvent.change(textarea(), { target: { value: "we are building a tool for founders" } })
    fireEvent.click(recordButton())

    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/karaoke"))
    expect(h.createProject).toHaveBeenCalledWith()
    expect(h.saveScript).toHaveBeenCalledWith("p1", "we are building a tool for founders")
    expect(h.setScript).toHaveBeenCalledWith("we are building a tool for founders")
    expect(h.setPathResult).toHaveBeenCalledWith({
      path: SEED.path,
      fits: true,
      est_duration_s: 6.2,
    })
  })

  it("surfaces a server rejection instead of navigating", async () => {
    h.saveScript.mockRejectedValue(new Error("Write at least a few words before you record."))

    render(<HomePage />)
    fireEvent.change(textarea(), { target: { value: "ship it" } })
    fireEvent.click(recordButton())

    await waitFor(() => expect(screen.getByText(/at least a few words/i)).toBeTruthy())
    expect(h.push).not.toHaveBeenCalled()
  })

  it("pre-fills the textarea from the session script (Edit text round-trip)", () => {
    h.script = "the script I wrote earlier"
    render(<HomePage />)
    expect(textarea().value).toBe("the script I wrote earlier")
  })

  it("right-aligns Hebrew as it is typed", () => {
    render(<HomePage />)
    expect(textarea().getAttribute("dir")).toBe("ltr")

    fireEvent.change(textarea(), { target: { value: "שלום קוראים לי אלי" } })
    expect(textarea().getAttribute("dir")).toBe("rtl")
  })
})

describe("HomePage — length estimate and over-length flag", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ")

  it("shows a rough estimate for a short script and flags nothing", () => {
    render(<HomePage />)
    // 40 words at 150 wpm = 16s.
    fireEvent.change(textarea(), { target: { value: words(40) } })

    expect(screen.getByText("~16s")).toBeTruthy()
    expect(screen.queryByText(/seconds over/i)).toBeNull()
    expect(screen.queryByTestId("over-length-tail")).toBeNull()
  })

  it("flags an over-length script in amber, dims the tail, and still allows recording", () => {
    render(<HomePage />)
    // 120 words at 150 wpm = 48s, i.e. 18s over the 30s cap.
    fireEvent.change(textarea(), { target: { value: words(120) } })

    // T-10022: was `/amber/`, i.e. a raw Tailwind palette step — the exact thing
    // the token pass removes. Same behaviour, asserted on the semantic token.
    const flag = screen.getByText(/18 seconds over/i)
    expect(flag.className).toMatch(/text-warn-fg/)

    // The tail past the 30-second point is marked, and it is exactly the words
    // after the 75th (30s x 150wpm / 60).
    const tail = screen.getByTestId("over-length-tail")
    expect(tail.textContent?.trim().startsWith("word75")).toBe(true)
    expect(tail.textContent?.trim().split(/\s+/)).toHaveLength(45)

    // Eli's ruling: flag it, the user cuts. Never block, never rewrite.
    expect(recordButton()).toHaveProperty("disabled", false)
  })

  it("says plainly that the estimate is only a hint", () => {
    render(<HomePage />)
    fireEvent.change(textarea(), { target: { value: words(10) } })
    expect(screen.getByText(/rough estimate/i)).toBeTruthy()
  })

  it("offers no AI rewrite, shorten or trim action", () => {
    render(<HomePage />)
    fireEvent.change(textarea(), { target: { value: words(120) } })

    for (const name of [/rewrite/i, /shorten/i, /trim it for me/i, /fix it/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })
})

import { render, screen, cleanup } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Prompter } from "../Prompter"
import type { KaraokeWord } from "@/lib/clock"

// A Hebrew line with a mixed Latin/number token — the §6 path output shape.
const words: KaraokeWord[] = [
  { w: "שלום", t_start: 0, t_end: 0.5, line: 0 },
  { w: "PitchMi", t_start: 0.5, t_end: 1, line: 0 },
  { w: "2026", t_start: 1, t_end: 1.5, line: 0 },
]
const lines = [{ index: 0, text: "שלום PitchMi 2026" }]

// A three-line script for window / scroll behaviour.
const multiWords: KaraokeWord[] = [
  { w: "one", t_start: 0, t_end: 1, line: 0 },
  { w: "two", t_start: 1, t_end: 2, line: 1 },
  { w: "three", t_start: 2, t_end: 3, line: 2 },
  { w: "four", t_start: 3, t_end: 4, line: 3 },
]
const multiLines = [
  { index: 0, text: "one" },
  { index: 1, text: "two" },
  { index: 2, text: "three" },
  { index: 3, text: "four" },
]

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe("Prompter RTL rendering", () => {
  it("renders the overlay with dir set for a Hebrew script", () => {
    render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" lang="he" />)
    const overlay = screen.getByTestId("prompter")
    expect(overlay.getAttribute("dir")).toBe("rtl")
    expect(overlay.querySelectorAll("[dir='rtl']").length).toBeGreaterThanOrEqual(1)
  })

  it("wraps every word in a <bdi> so per-word highlight cannot scramble RTL order", () => {
    const { container } = render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />)
    const bdis = container.querySelectorAll("bdi")
    expect(bdis.length).toBe(words.length)
    expect(Array.from(bdis).map((b) => b.textContent)).toEqual(["שלום", "PitchMi", "2026"])
  })

  it("tints the current word (brand green) within the active line", () => {
    const { container } = render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />)
    const bdis = container.querySelectorAll("bdi")
    expect(bdis[1].className).toMatch(/text-green-400/)
  })

  it("aligns lines to the right for RTL and left for LTR", () => {
    const { rerender } = render(<Prompter words={words} lines={lines} activeIdx={0} dir="rtl" />)
    expect(screen.getByTestId("active-line").className).toMatch(/text-right/)
    rerender(<Prompter words={words} lines={lines} activeIdx={0} dir="ltr" />)
    expect(screen.getByTestId("active-line").className).toMatch(/text-left/)
  })
})

describe("Prompter three-line window", () => {
  it("marks exactly one active line, with a visible previous and next", () => {
    render(<Prompter words={multiWords} lines={multiLines} activeIdx={1} dir="ltr" />)
    // active word is on line 1 -> line 1 active, line 0 previous, line 2 next.
    expect(screen.getAllByTestId("active-line")).toHaveLength(1)
    const active = screen.getByTestId("active-line")
    expect(active.getAttribute("data-role")).toBe("active")
    const roles = Array.from(document.querySelectorAll("[data-role]")).map((el) =>
      el.getAttribute("data-role"),
    )
    expect(roles).toContain("previous")
    expect(roles).toContain("next")
    // the far line (3) is outside the 3-line window -> hidden.
    expect(roles).toContain("hidden")
  })

  it("gives the active line the large fixed-reading-line type", () => {
    render(<Prompter words={multiWords} lines={multiLines} activeIdx={1} dir="ltr" />)
    const activeWord = screen.getByTestId("active-line").querySelector("bdi")
    expect(activeWord?.className).toMatch(/clamp\(26px,8vw,44px\)/)
  })
})

describe("Prompter first-use hint", () => {
  it("shows the localized hint once, then never again", () => {
    // First use: hint visible during countdown.
    const first = render(<Prompter words={words} lines={lines} activeIdx={-1} dir="rtl" lang="he" phase="countdown" />)
    expect(screen.getByTestId("prompter-hint").textContent).toMatch(/מודגשת/)
    // Countdown ends -> recording marks the hint as seen.
    first.rerender(<Prompter words={words} lines={lines} activeIdx={0} dir="rtl" lang="he" phase="recording" />)
    expect(screen.queryByTestId("prompter-hint")).toBeNull()
    cleanup()
    // A brand new session: hint stays dismissed.
    render(<Prompter words={words} lines={lines} activeIdx={-1} dir="rtl" lang="he" phase="countdown" />)
    expect(screen.queryByTestId("prompter-hint")).toBeNull()
  })

  it("falls back to English for non-Hebrew languages", () => {
    render(<Prompter words={words} lines={lines} activeIdx={-1} dir="ltr" lang="en" phase="countdown" />)
    expect(screen.getByTestId("prompter-hint").textContent).toMatch(/Follow the highlighted word/)
  })
})

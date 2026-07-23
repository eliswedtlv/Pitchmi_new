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

  it("renders each word as an inline element in one continuous text run (no layout boxes)", () => {
    const { container } = render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />)
    const wordEls = Array.from(container.querySelectorAll("[data-widx]"))
    expect(wordEls.map((el) => el.textContent)).toEqual(["שלום", "PitchMi", "2026"])
    // Nothing that would make a word its own layout box and pin it in DOM order.
    for (const el of wordEls) {
      expect(el.className).not.toMatch(/inline-block|flex|grid|absolute|float/)
    }
  })

  it("isolates ONLY tokens whose script opposes the line (Latin inside Hebrew)", () => {
    const { container } = render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />)
    // The Hebrew word and the pure-number token stay plain <span>s; only the
    // Latin brand name is wrapped in a <bdi> isolate.
    expect(Array.from(container.querySelectorAll("bdi")).map((b) => b.textContent)).toEqual(["PitchMi"])
    expect(container.querySelector("[data-widx='0']")?.tagName.toLowerCase()).toBe("span")
    expect(container.querySelector("[data-widx='2']")?.tagName.toLowerCase()).toBe("span")
  })

  it("tints the current word (brand green) within the active line", () => {
    const { container } = render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />)
    expect(container.querySelector("[data-widx='1']")?.className).toMatch(/text-green-400/)
  })

  it("gives the active line's text run text-align:start and the line's dir", () => {
    const { rerender } = render(<Prompter words={words} lines={lines} activeIdx={0} dir="rtl" />)
    const rtlRun = screen.getByTestId("active-line")
    expect(rtlRun.style.textAlign).toBe("start")
    expect(rtlRun.getAttribute("dir")).toBe("rtl")
    rerender(<Prompter words={words} lines={lines} activeIdx={0} dir="ltr" />)
    expect(screen.getByTestId("active-line").getAttribute("dir")).toBe("ltr")
  })
})

describe("Prompter majority-flip guard (T-1164)", () => {
  // An all-Hebrew line rendered with the WRONG dir (language was missing
  // upstream, so dir defaulted to "ltr"). Without the guard every word would be
  // bidi-isolated and the line would reverse.
  const heWords: KaraokeWord[] = [
    { w: "שלום", t_start: 0, t_end: 0.5, line: 0 },
    { w: "עולם", t_start: 0.5, t_end: 1, line: 0 },
    { w: "זה", t_start: 1, t_end: 1.5, line: 0 },
  ]
  const heLines = [{ index: 0, text: "שלום עולם זה" }]

  it("flips a line's dir to rtl when most tokens oppose the passed ltr dir", () => {
    const { container } = render(<Prompter words={heWords} lines={heLines} activeIdx={0} dir="ltr" />)
    const run = screen.getByTestId("active-line")
    expect(run.getAttribute("dir")).toBe("rtl")
    // Flipped line => nothing opposes rtl => no per-word bidi isolation.
    expect(container.querySelectorAll("bdi").length).toBe(0)
    expect(container.querySelector("[data-role='active']")?.getAttribute("dir")).toBe("rtl")
  })

  it("leaves a correctly-directed line untouched (no flip, no isolation)", () => {
    const { container } = render(<Prompter words={heWords} lines={heLines} activeIdx={0} dir="rtl" />)
    expect(screen.getByTestId("active-line").getAttribute("dir")).toBe("rtl")
    expect(container.querySelectorAll("bdi").length).toBe(0)
  })
})

describe("Prompter position (T-1167 §B)", () => {
  it("carries portrait-centered classes and a center-band scrim, keeping top on landscape", () => {
    render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" lang="he" />)
    const overlay = screen.getByTestId("prompter")
    // Portrait phones: vertically centered.
    expect(overlay.className).toMatch(/portrait:top-1\/2/)
    expect(overlay.className).toMatch(/portrait:-translate-y-1\/2/)
    // Soft center band (transparent top/bottom) instead of the top scrim.
    expect(overlay.className).toMatch(/portrait:from-transparent/)
    // Landscape/desktop keeps the top position.
    expect(overlay.className).toMatch(/(^|\s)top-0(\s|$)/)
  })
})

describe("Prompter three-line window", () => {
  it("marks exactly one active line, with a visible previous and next", () => {
    render(<Prompter words={multiWords} lines={multiLines} activeIdx={1} dir="ltr" />)
    // active word is on line 1 -> line 1 active, line 0 previous, line 2 next.
    expect(screen.getAllByTestId("active-line")).toHaveLength(1)
    const roles = Array.from(document.querySelectorAll("[data-role]")).map((el) =>
      el.getAttribute("data-role"),
    )
    expect(roles).toContain("active")
    expect(roles).toContain("previous")
    expect(roles).toContain("next")
    // the far line (3) is outside the 3-line window -> hidden.
    expect(roles).toContain("hidden")
  })

  it("gives the active line the large fixed-reading-line type", () => {
    render(<Prompter words={multiWords} lines={multiLines} activeIdx={1} dir="ltr" />)
    expect(screen.getByTestId("active-line").className).toMatch(/clamp\(26px,8vw,44px\)/)
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

import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Prompter } from "../Prompter"
import type { KaraokeWord } from "@/lib/clock"

// A Hebrew line with a mixed Latin/number token — the §6 path output shape.
const words: KaraokeWord[] = [
  { w: "שלום", t_start: 0, t_end: 0.5, line: 0 },
  { w: "PitchMi", t_start: 0.5, t_end: 1, line: 0 },
  { w: "2026", t_start: 1, t_end: 1.5, line: 0 },
]
const lines = [{ index: 0, text: "שלום PitchMi 2026" }]

describe("Prompter RTL rendering", () => {
  it("renders the overlay and line with dir set for a Hebrew script", () => {
    render(<Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />)
    const overlay = screen.getByTestId("prompter")
    expect(overlay.getAttribute("dir")).toBe("rtl")
    // the line element also carries dir so logical order is preserved
    expect(overlay.querySelectorAll("[dir='rtl']").length).toBeGreaterThanOrEqual(1)
  })

  it("wraps every word in a <bdi> so per-word highlight cannot scramble RTL order", () => {
    const { container } = render(
      <Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />,
    )
    const bdis = container.querySelectorAll("bdi")
    expect(bdis.length).toBe(words.length)
    // mixed tokens are isolated too
    expect(Array.from(bdis).map((b) => b.textContent)).toEqual(["שלום", "PitchMi", "2026"])
  })

  it("marks the active word distinctly", () => {
    const { container } = render(
      <Prompter words={words} lines={lines} activeIdx={1} dir="rtl" />,
    )
    const bdis = container.querySelectorAll("bdi")
    expect(bdis[1].className).toMatch(/font-bold/)
  })
})

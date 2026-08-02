import { describe, expect, it } from "vitest"
import { WORDS_PER_MINUTE, countWords, estimateSeconds, splitAtSeconds } from "../estimate"

// T-10018 — a hint, never a gate. The split has to be exact because the two
// halves are re-rendered on top of the textarea to tint the over-length tail.

describe("countWords / estimateSeconds", () => {
  it("counts whitespace-separated words, ignoring padding", () => {
    expect(countWords("")).toBe(0)
    expect(countWords("   \n\t ")).toBe(0)
    expect(countWords("ship it now")).toBe(3)
    expect(countWords("  ship\n it   now \n")).toBe(3)
  })

  it("estimates at the documented rate", () => {
    expect(WORDS_PER_MINUTE).toBe(150)
    expect(estimateSeconds("")).toBe(0)
    // 150 words = 60s, so 75 words = 30s.
    expect(estimateSeconds(Array(75).fill("word").join(" "))).toBe(30)
  })

  it("counts Hebrew words the same way", () => {
    expect(countWords("שלום קוראים לי אלי")).toBe(4)
  })
})

describe("splitAtSeconds", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ")

  it("returns everything as head when the text fits", () => {
    const text = words(40)
    expect(splitAtSeconds(text, 30)).toEqual({ head: text, tail: "" })
  })

  it("splits at the word that crosses the limit", () => {
    // 30s at 150wpm = 75 words, so w75 (the 76th) opens the tail.
    const { head, tail } = splitAtSeconds(words(100), 30)
    expect(head.trim().split(" ")).toHaveLength(75)
    expect(tail.trim().split(" ")).toHaveLength(25)
    expect(tail.trim().startsWith("w75")).toBe(true)
  })

  it("head + tail always reconstructs the input exactly, whitespace included", () => {
    for (const text of [
      words(100),
      "  " + words(100) + "   ",
      words(50) + "\n\n" + words(50),
      "one two three",
      "",
      "   ",
    ]) {
      const { head, tail } = splitAtSeconds(text, 30)
      expect(head + tail).toBe(text)
    }
  })

  it("a zero or negative limit puts everything in the tail", () => {
    expect(splitAtSeconds("ship it now", 0)).toEqual({ head: "", tail: "ship it now" })
  })
})

import { describe, expect, it } from "vitest"
import {
  buildTeleprompter,
  firstWordOfLine,
  matchForward,
  recognitionLang,
  wordsMatch,
} from "../teleprompter"

describe("buildTeleprompter", () => {
  it("splits into short lines and breaks after a sentence", () => {
    const { words, lines } = buildTeleprompter(
      "Hi there. We are building a tool that helps every founder pitch better",
    )
    expect(lines[0].text).toBe("Hi there.")
    for (const l of lines) {
      expect(l.text.split(" ").length).toBeLessThanOrEqual(6)
    }
    expect(words.map((w) => w.w).join(" ")).toBe(
      "Hi there. We are building a tool that helps every founder pitch better",
    )
    expect(words.every((w) => lines[w.line].text.split(" ").includes(w.w))).toBe(true)
  })

  it("breaks at newlines", () => {
    const { lines } = buildTeleprompter("one two\nthree four")
    expect(lines.map((l) => l.text)).toEqual(["one two", "three four"])
  })
})

describe("matchForward", () => {
  const script = ["we", "are", "building", "a", "tool", "for", "founders"]

  it("follows the reader word by word", () => {
    expect(matchForward(script, -1, ["we", "are"])).toBe(1)
  })

  it("allows skipped words", () => {
    expect(matchForward(script, -1, ["we", "building", "tool"])).toBe(4)
  })

  it("never moves backwards", () => {
    expect(matchForward(script, 4, ["we", "are"])).toBe(4)
  })

  it("is tolerant to recogniser spelling and punctuation", () => {
    expect(wordsMatch("founders.", "founder")).toBe(true)
    expect(wordsMatch("building", "bilding")).toBe(true)
    expect(wordsMatch("שָׁלוֹם", "שלום")).toBe(true)
    expect(wordsMatch("tool", "cat")).toBe(false)
  })

  it("ignores words that aren't in the script nearby", () => {
    expect(matchForward(script, 0, ["um", "uh"])).toBe(0)
  })
})

describe("helpers", () => {
  it("finds the first word of a line", () => {
    const { words } = buildTeleprompter("one two\nthree four")
    expect(firstWordOfLine(words, 1)).toBe(2)
    expect(firstWordOfLine(words, 5)).toBe(-1)
  })

  it("picks Hebrew for RTL, else the browser language", () => {
    expect(recognitionLang("rtl", "en-US")).toBe("he-IL")
    expect(recognitionLang("ltr", "en-GB")).toBe("en-GB")
    expect(recognitionLang("ltr", "he-IL")).toBe("en-US")
    expect(recognitionLang("ltr")).toBe("en-US")
  })
})

import { describe, it, expect } from "vitest"
import { estimateDuration, fitMeter } from "../fit"

const SEC_PER_CHAR = 0.0727

describe("estimateDuration", () => {
  it("returns 0 for empty string", () => {
    expect(estimateDuration("", 1.0)).toBe(0)
  })

  it("counts only letters and numbers", () => {
    // "Hello" = 5 chars
    const dur = estimateDuration("Hello", 1.0)
    expect(dur).toBeCloseTo(5 * SEC_PER_CHAR, 4)
  })

  it("excludes punctuation and whitespace", () => {
    // "Hi!" same as "Hi" — only 2 chars
    expect(estimateDuration("Hi!", 1.0)).toBeCloseTo(estimateDuration("Hi", 1.0), 4)
  })

  it("scales inversely with speed", () => {
    const base = estimateDuration("hello world", 1.0)
    expect(estimateDuration("hello world", 2.0)).toBeCloseTo(base / 2, 4)
    expect(estimateDuration("hello world", 0.5)).toBeCloseTo(base * 2, 4)
  })

  it("handles 60s boundary text at speed 1 with custom secPerChar", () => {
    // craft a text that produces exactly 60s
    // chars needed = 60 / SEC_PER_CHAR
    const charsNeeded = Math.round(60 / SEC_PER_CHAR)
    const text = "a".repeat(charsNeeded)
    const dur = estimateDuration(text, 1.0)
    // should be approximately 60
    expect(dur).toBeCloseTo(60, 0)
  })

  it("uses custom secPerChar when provided", () => {
    expect(estimateDuration("abc", 1.0, 1.0)).toBeCloseTo(3, 4)
    expect(estimateDuration("abc", 2.0, 1.0)).toBeCloseTo(1.5, 4)
  })

  it("handles speed at extremes (0.75 and 1.25)", () => {
    const text = "the quick brown fox"
    const at75 = estimateDuration(text, 0.75)
    const at125 = estimateDuration(text, 1.25)
    const at100 = estimateDuration(text, 1.0)
    // slower speed → longer duration
    expect(at75).toBeGreaterThan(at100)
    expect(at125).toBeLessThan(at100)
  })
})

describe("fitMeter", () => {
  it("returns fits=true when duration <= max", () => {
    const result = fitMeter(45, 60)
    expect(result.fits).toBe(true)
    expect(result.over).toBe(0)
    expect(result.remaining).toBeCloseTo(15, 4)
    expect(result.ratio).toBeCloseTo(45 / 60, 4)
  })

  it("returns fits=true at exactly 60s", () => {
    const result = fitMeter(60, 60)
    expect(result.fits).toBe(true)
    expect(result.over).toBe(0)
    expect(result.remaining).toBe(0)
    expect(result.ratio).toBe(1)
  })

  it("returns fits=false when duration > max", () => {
    const result = fitMeter(75, 60)
    expect(result.fits).toBe(false)
    expect(result.over).toBeCloseTo(15, 4)
    expect(result.remaining).toBe(0)
    expect(result.ratio).toBeCloseTo(75 / 60, 4)
  })

  it("works with default max of 60", () => {
    expect(fitMeter(30).fits).toBe(true)
    expect(fitMeter(90).fits).toBe(false)
  })

  it("ratio > 1 when over", () => {
    expect(fitMeter(120, 60).ratio).toBe(2)
  })

  it("ratio is 0 for 0 duration", () => {
    expect(fitMeter(0, 60).ratio).toBe(0)
    expect(fitMeter(0, 60).fits).toBe(true)
    expect(fitMeter(0, 60).remaining).toBe(60)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { activeWordIndex, type KaraokeWord } from "../clock"

const WORDS: KaraokeWord[] = [
  { w: "Hello", t_start: 0.0, t_end: 0.5, line: 0 },
  { w: "world", t_start: 0.6, t_end: 1.1, line: 0 },
  { w: "this", t_start: 1.3, t_end: 1.6, line: 1 },
  { w: "is", t_start: 1.7, t_end: 1.9, line: 1 },
  { w: "PitchMi", t_start: 2.0, t_end: 2.8, line: 1 },
]

describe("activeWordIndex (pure function)", () => {
  it("returns -1 before first word", () => {
    expect(activeWordIndex(WORDS, -0.1)).toBe(-1)
    expect(activeWordIndex(WORDS, 0 - 0.001)).toBe(-1)
  })

  it("returns 0 at exactly t_start of first word", () => {
    expect(activeWordIndex(WORDS, 0.0)).toBe(0)
  })

  it("returns 0 while inside first word", () => {
    expect(activeWordIndex(WORDS, 0.3)).toBe(0)
  })

  it("returns 1 when second word starts", () => {
    expect(activeWordIndex(WORDS, 0.6)).toBe(1)
  })

  it("returns 1 during gap between second and third word", () => {
    expect(activeWordIndex(WORDS, 1.2)).toBe(1)
  })

  it("returns 2 at start of third word", () => {
    expect(activeWordIndex(WORDS, 1.3)).toBe(2)
  })

  it("returns last word index past end of all words", () => {
    expect(activeWordIndex(WORDS, 100)).toBe(WORDS.length - 1)
  })

  it("returns -1 for empty words array", () => {
    expect(activeWordIndex([], 1.0)).toBe(-1)
  })

  it("returns 0 for single-word array when t >= t_start", () => {
    const single: KaraokeWord[] = [{ w: "go", t_start: 1.0, t_end: 1.5, line: 0 }]
    expect(activeWordIndex(single, 0.9)).toBe(-1)
    expect(activeWordIndex(single, 1.0)).toBe(0)
    expect(activeWordIndex(single, 5.0)).toBe(0)
  })
})

// ── Hook test with fake timers ─────────────────────────────────────────────

import { renderHook, act } from "@testing-library/react"
import { useKaraokeClock } from "../../hooks/useKaraokeClock"

describe("useKaraokeClock hook (fake timers)", () => {
  let mockNow = 0
  let rafCallbacks: FrameRequestCallback[] = []

  beforeEach(() => {
    mockNow = 0
    rafCallbacks = []

    vi.spyOn(performance, "now").mockImplementation(() => mockNow)

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })

    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRaf() {
    const callbacks = [...rafCallbacks]
    rafCallbacks = []
    for (const cb of callbacks) cb(mockNow)
  }

  it("returns -1 when not running", () => {
    const { result } = renderHook(() => useKaraokeClock(WORDS, false))
    expect(result.current).toBe(-1)
  })

  it("returns -1 at t=0 before any word starts (t_start=0 means 0 is active → index 0)", () => {
    const { result } = renderHook(() => useKaraokeClock(WORDS, true))
    act(() => {
      mockNow = 0
      flushRaf()
    })
    // At t=0, first word (t_start=0) is active → index 0
    expect(result.current).toBe(0)
  })

  it("advances to word 1 when elapsed >= 0.6s", () => {
    const { result } = renderHook(() => useKaraokeClock(WORDS, true))
    act(() => {
      mockNow = 600  // 600ms = 0.6s
      flushRaf()
    })
    expect(result.current).toBe(1)
  })

  it("advances to word 2 when elapsed >= 1.3s", () => {
    const { result } = renderHook(() => useKaraokeClock(WORDS, true))
    act(() => {
      mockNow = 1300
      flushRaf()
    })
    expect(result.current).toBe(2)
  })

  it("reaches last word at t=2.0s", () => {
    const { result } = renderHook(() => useKaraokeClock(WORDS, true))
    act(() => {
      mockNow = 2000
      flushRaf()
    })
    expect(result.current).toBe(4)
  })

  it("resets to -1 when running goes false", () => {
    const { result, rerender } = renderHook(
      ({ running }) => useKaraokeClock(WORDS, running),
      { initialProps: { running: true } },
    )

    act(() => {
      mockNow = 1000
      flushRaf()
    })
    expect(result.current).toBeGreaterThan(-1)

    rerender({ running: false })
    expect(result.current).toBe(-1)
  })

  it("progresses through multiple words in sequence", () => {
    const { result } = renderHook(() => useKaraokeClock(WORDS, true))

    // t=0ms → word 0
    act(() => { mockNow = 0; flushRaf() })
    expect(result.current).toBe(0)

    // t=600ms → word 1
    act(() => { mockNow = 600; flushRaf() })
    expect(result.current).toBe(1)

    // t=1300ms → word 2
    act(() => { mockNow = 1300; flushRaf() })
    expect(result.current).toBe(2)

    // t=1700ms → word 3
    act(() => { mockNow = 1700; flushRaf() })
    expect(result.current).toBe(3)

    // t=2000ms → word 4 (PitchMi)
    act(() => { mockNow = 2000; flushRaf() })
    expect(result.current).toBe(4)
  })
})

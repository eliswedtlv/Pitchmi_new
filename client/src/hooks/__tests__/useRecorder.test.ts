import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRecorder } from "@/hooks/useRecorder"
import { MAX_TAKE_S } from "@/lib/limits"

// T-1172: the caller must be able to tell "the user tapped Stop" from "the hard
// cap fired". Take 1 defines the subtitle path, so an involuntary stop has to be
// announced rather than transcribed silently.

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  static isTypeSupported = () => true
  state: "inactive" | "recording" = "inactive"
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor() {
    FakeMediaRecorder.instances.push(this)
  }
  start() {
    this.state = "recording"
  }
  stop() {
    this.state = "inactive"
    this.onstop?.()
  }
}

const track = { stop: vi.fn() }

beforeEach(() => {
  vi.useFakeTimers()
  FakeMediaRecorder.instances = []
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) },
  })
  vi.stubGlobal("requestAnimationFrame", () => 0)
  vi.stubGlobal("cancelAnimationFrame", () => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// Drives start() through the 3-2-1 pre-roll until MediaRecorder is recording.
async function startRecording(start: () => Promise<void>) {
  await act(async () => {
    await start()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
}

describe("useRecorder — stopReason (T-1172)", () => {
  it("defaults maxDurationS to the shared 30s cap", () => {
    const { result } = renderHook(() => useRecorder())
    expect(MAX_TAKE_S).toBe(30)
    expect(result.current.stopReason).toBeNull()
  })

  it('reports "user" and passes it to onStop when the user taps Stop', async () => {
    const onStop = vi.fn()
    const { result } = renderHook(() => useRecorder({ onStop }))

    await startRecording(result.current.start)
    await act(async () => {
      result.current.stop()
    })

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][1]).toBe("user")
    expect(result.current.stopReason).toBe("user")
  })

  it('reports "limit" when the auto-stop timer fires at the cap', async () => {
    const onStop = vi.fn()
    const { result } = renderHook(() => useRecorder({ onStop }))

    await startRecording(result.current.start)
    expect(onStop).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_TAKE_S * 1000)
    })

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][1]).toBe("limit")
    expect(result.current.stopReason).toBe("limit")
  })

  it("a late tap after the cap fired does not relabel the stop as user-initiated", async () => {
    const onStop = vi.fn()
    const { result } = renderHook(() => useRecorder({ onStop }))

    await startRecording(result.current.start)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_TAKE_S * 1000)
    })
    await act(async () => {
      result.current.stop() // finger was already on the button
    })

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(result.current.stopReason).toBe("limit")
  })

  it("start() clears a previous reason so a re-record begins clean", async () => {
    const { result } = renderHook(() => useRecorder({ onStop: vi.fn() }))

    await startRecording(result.current.start)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_TAKE_S * 1000)
    })
    expect(result.current.stopReason).toBe("limit")

    await act(async () => {
      result.current.start()
    })
    expect(result.current.stopReason).toBeNull()
  })
})

// T-10010: the pre-roll used to chain bare setTimeout(tick, 1000) calls whose
// handles were never stored, so cleanup() — which stops every track — could not
// cancel them. Navigating away mid-countdown still constructed a MediaRecorder
// over dead tracks, inside a timer, with nothing to catch the throw.
describe("useRecorder — countdown cancellation and recorder failures (T-10010)", () => {
  it("unmounting during the countdown never constructs a MediaRecorder", async () => {
    const onStop = vi.fn()
    const { result, unmount } = renderHook(() => useRecorder({ onStop }))

    await act(async () => {
      await result.current.start()
    })
    // One second in: still counting, nothing recording yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(FakeMediaRecorder.instances).toHaveLength(0)

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(FakeMediaRecorder.instances).toHaveLength(0)
    expect(onStop).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it("a MediaRecorder constructor that throws surfaces as the error state", async () => {
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported = () => true
        constructor() {
          throw new Error("MediaRecorder is not supported")
        }
      },
    )

    const { result } = renderHook(() => useRecorder({ onStop: vi.fn() }))
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.state).toBe("error")
    expect(result.current.error).toMatch(/supported on this browser/i)
    // The camera is released rather than left on behind a dead screen.
    expect(track.stop).toHaveBeenCalled()
  })

  it("a denied camera sets the error state and never starts a countdown", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn(async () => { throw new Error("NotAllowedError") }) },
    })

    const { result } = renderHook(() => useRecorder({ onStop: vi.fn() }))
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe("error")
    expect(result.current.error).toMatch(/camera/i)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(FakeMediaRecorder.instances).toHaveLength(0)
  })
})

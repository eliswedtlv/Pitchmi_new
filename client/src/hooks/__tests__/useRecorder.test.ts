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

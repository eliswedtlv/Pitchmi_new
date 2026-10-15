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
  options: MediaRecorderOptions | undefined
  constructor(_stream: unknown, options?: MediaRecorderOptions) {
    this.options = options
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
  it("defaults maxDurationS to the shared 5-minute cap", () => {
    const { result } = renderHook(() => useRecorder())
    expect(MAX_TAKE_S).toBe(300)
    expect(result.current.stopReason).toBeNull()
  })

  // KP-B: a 5-minute take must stay well under the 200 MB upload cap.
  it("records at a capped bitrate", async () => {
    const { result } = renderHook(() => useRecorder({ onStop: vi.fn() }))
    await startRecording(result.current.start)
    expect(FakeMediaRecorder.instances[0].options).toMatchObject({
      videoBitsPerSecond: 1_500_000,
      audioBitsPerSecond: 64_000,
    })
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

// KP-F: iOS Safari can hand a portrait phone a landscape track right after the
// permission prompt. The hook must wait for it to settle during the countdown,
// re-request once if it never does, and never wait on desktop.
describe("useRecorder — first-take orientation (KP-F)", () => {
  type FakeVideo = EventTarget & {
    videoWidth: number
    videoHeight: number
    srcObject: unknown
    muted: boolean
    play: () => Promise<void>
  }

  function fakeVideo(width: number, height: number): FakeVideo {
    return Object.assign(new EventTarget(), {
      videoWidth: width,
      videoHeight: height,
      srcObject: null as unknown,
      muted: false,
      play: async () => {},
    })
  }

  function fakeStream() {
    const t = { stop: vi.fn() }
    return { getTracks: () => [t], getVideoTracks: () => [], track: t }
  }

  function setViewport(width: number, height: number) {
    vi.stubGlobal("innerWidth", width)
    vi.stubGlobal("innerHeight", height)
  }

  async function begin(video: FakeVideo, onStop = vi.fn()) {
    const hook = renderHook(() => useRecorder({ onStop }))
    hook.result.current.videoRef.current = video as unknown as HTMLVideoElement
    await act(async () => {
      await hook.result.current.start()
    })
    return hook
  }

  it("a landscape track that turns portrait settles without a re-request", async () => {
    setViewport(390, 844)
    const first = fakeStream()
    const gum = vi.fn(async () => first)
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: gum } })
    const video = fakeVideo(1280, 720)

    await begin(video)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    video.videoWidth = 720
    video.videoHeight = 1280
    video.dispatchEvent(new Event("resize"))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(gum).toHaveBeenCalledTimes(1)
    expect(first.track.stop).not.toHaveBeenCalled()
    expect(FakeMediaRecorder.instances).toHaveLength(1)
  })

  it("a stuck landscape track triggers exactly one re-request, then records", async () => {
    setViewport(390, 844)
    const first = fakeStream()
    const second = fakeStream()
    const gum = vi.fn().mockResolvedValueOnce(first).mockResolvedValue(second)
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: gum } })
    const video = fakeVideo(1280, 720) // never settles

    const { result } = await begin(video)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(gum).toHaveBeenCalledTimes(2)
    expect(gum.mock.calls[1][0]).toEqual(gum.mock.calls[0][0])
    expect(first.track.stop).toHaveBeenCalled()
    expect(video.srcObject).toBe(second)
    // Recording proceeds regardless — never blocked forever.
    expect(FakeMediaRecorder.instances).toHaveLength(1)
    expect(result.current.state).toBe("recording")
  })

  it("an already-portrait stream records right at the end of the countdown", async () => {
    setViewport(390, 844)
    const gum = vi.fn(async () => fakeStream())
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: gum } })

    await begin(fakeVideo(720, 1280))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(gum).toHaveBeenCalledTimes(1)
    expect(FakeMediaRecorder.instances).toHaveLength(1)
  })

  it("desktop (landscape viewport) never waits or re-requests", async () => {
    setViewport(1440, 900)
    const gum = vi.fn(async () => fakeStream())
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: gum } })
    const video = fakeVideo(1280, 720)
    const listen = vi.spyOn(video, "addEventListener")

    await begin(video)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(listen).not.toHaveBeenCalled()
    expect(gum).toHaveBeenCalledTimes(1)
    expect(FakeMediaRecorder.instances).toHaveLength(1)
  })
})

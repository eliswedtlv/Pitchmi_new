import { afterEach, describe, expect, it, vi } from "vitest"
import type { KaraokePath } from "@/lib/api"
import { activeLineAt, burnInKaraoke, burnInSupported, captionWordsAt, markRect, wrapWords } from "../burnIn"

const path: KaraokePath = {
  words: [
    { w: "First", t_start: 1, t_end: 1.5, line: 3 },
    { w: "line", t_start: 1.5, t_end: 2, line: 3 },
    { w: "שלום", t_start: 3, t_end: 4, line: 8 },
  ],
  lines: [
    { index: 3, text: "First line", t_start: 1, t_end: 2 },
    { index: 8, text: "שלום", t_start: 3, t_end: 4 },
  ],
  total_s: 4,
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("activeLineAt", () => {
  it("has no caption before the first line or with a null/empty path", () => {
    expect(activeLineAt(path, 0)).toBeNull()
    expect(activeLineAt(null, 2)).toBeNull()
    expect(activeLineAt({ words: [], lines: [], total_s: 0 }, 2)).toBeNull()
    expect(captionWordsAt(null, 2)).toEqual([])
    expect(captionWordsAt(path, 0)).toEqual([])
  })
  it("uses inclusive timing and holds the most recent line through gaps and after the end", () => {
    for (const t of [1, 2, 2.5]) expect(activeLineAt(path, t)?.index).toBe(3)
    for (const t of [3, 4, 10]) expect(activeLineAt(path, t)?.index).toBe(8)
  })
  it("chooses the most recent by time even with unsorted input", () => {
    expect(activeLineAt({ ...path, lines: [...path.lines].reverse() }, 10)?.index).toBe(8)
  })
  it("splits spoken and upcoming words at the exact start, using line IDs", () => {
    expect(captionWordsAt(path, 1).map(word => word.spoken)).toEqual([true, false])
    expect(captionWordsAt(path, 1.5).map(word => word.spoken)).toEqual([true, true])
    expect(captionWordsAt(path, 3).map(word => word.w)).toEqual(["שלום"])
  })
})

describe("wrapWords", () => {
  const words = "one two three four five six".split(" ").map(w => ({ w }))
  it("wraps on measured width including spaces", () => {
    const rows = wrapWords(words.slice(0, 3), 7, text => text.length)
    expect(rows.map(row => row.map(word => word.w))).toEqual([["one", "two"], ["three"]])
  })
  it("retains all words in at most two rows, even for long lines or tokens", () => {
    for (const width of [0, 1, 7, 100]) {
      const rows = wrapWords(words, width, text => text.length)
      expect(rows.length).toBeLessThanOrEqual(2)
      expect(rows.flat()).toEqual(words)
    }
    expect(wrapWords([{ w: "unbreakable" }], 1, text => text.length)).toHaveLength(1)
  })
  it("returns no rows for no words", () => {
    expect(wrapWords([], 100, text => text.length)).toEqual([])
  })
})

describe("markRect", () => {
  it("uses the shorter dimension and mirrors only the position for RTL", () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920]]) {
      const ltr = markRect(w, h)
      const rtl = markRect(w, h, "rtl")
      expect(ltr.size).toBeCloseTo(64.8)
      expect(rtl.size).toBe(ltr.size)
      expect(rtl.y).toBe(ltr.y)
      expect(rtl.x + rtl.size).toBeCloseTo(w - ltr.x)
    }
  })
})

describe("export lifecycle", () => {
  it("requires both captureStream and MediaRecorder", async () => {
    vi.stubGlobal("MediaRecorder", undefined)
    expect(burnInSupported()).toBe(false)
    await expect(burnInKaraoke(new Blob(), null)).rejects.toThrow("not supported")
    vi.stubGlobal("MediaRecorder", class {})
    vi.stubGlobal("HTMLCanvasElement", class {})
    expect(burnInSupported()).toBe(false)
  })
})


describe("recording pipeline", () => {
  function setup(playbackFails = false) {
    const video = document.createElement("video")
    const stopAudio = vi.fn()
    const stopVideo = vi.fn()
    const track = { stop: stopAudio }
    const stream = { getTracks: () => [{ stop: stopVideo }], addTrack: vi.fn() }
    const ctx = {
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
      drawImage: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(),
      stroke: vi.fn(), fillText: vi.fn(), measureText: (s: string) => ({ width: s.length * 10 }),
    }
    const canvas = { width: 0, height: 0, getContext: () => ctx, captureStream: () => stream }
    Object.assign(ctx, { canvas })
    Object.defineProperties(video, {
      videoWidth: { value: 640 }, videoHeight: { value: 480 },
      duration: { value: 4 },
      src: { set: () => queueMicrotask(() => video.dispatchEvent(new Event("loadedmetadata"))) },
    })
    const close = vi.fn().mockResolvedValue(undefined)
    const disconnect = vi.fn()
    const connect = vi.fn()
    vi.stubGlobal("AudioContext", class {
      state = "running"
      resume = vi.fn().mockResolvedValue(undefined)
      close = close
      createMediaElementSource = () => ({ connect, disconnect })
      createMediaStreamDestination = () => ({ stream: { getAudioTracks: () => [track], getTracks: () => [track] } })
    })
    vi.stubGlobal("HTMLCanvasElement", class { captureStream() {} })
    vi.stubGlobal("Path2D", class {})
    const requests: string[] = []
    vi.stubGlobal("MediaRecorder", class {
      static isTypeSupported(type: string) { requests.push(type); return type === "video/mp4" }
      state = "inactive"
      mimeType = "video/mp4"
      ondataavailable?: (event: { data: Blob }) => void
      onstop?: () => void
      start() { this.state = "recording" }
      stop() {
        this.state = "inactive"
        this.ondataavailable?.({ data: new Blob(["encoded take"]) })
        this.onstop?.()
      }
    })
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => tag === "video" ? video : canvas) as typeof document.createElement)
    vi.spyOn(video, "play").mockImplementation(async () => {
      if (playbackFails) throw new Error("Playback denied")
      setTimeout(() => { video.currentTime = 4; video.dispatchEvent(new Event("ended")) }, 0)
    })
    vi.spyOn(video, "pause").mockImplementation(() => {})
    vi.spyOn(video, "load").mockImplementation(() => {})
    const revoke = vi.fn()
    vi.stubGlobal("URL", { createObjectURL: () => "blob:local", revokeObjectURL: revoke })
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    return { video, canvas, ctx, stream, track, stopAudio, stopVideo, close, disconnect, revoke, requests }
  }

  it("records native frames and audio, mirrors only the video, and releases resources", async () => {
    const env = setup()
    const progress = vi.fn()
    const blob = await burnInKaraoke(new Blob(["take"]), path, { mirror: true, dir: "rtl", onProgress: progress })
    expect(blob.type).toBe("video/mp4")
    expect(blob.size).toBeGreaterThan(0)
    expect(env.canvas.width).toBe(640)
    expect(env.canvas.height).toBe(480)
    expect(env.stream.addTrack).toHaveBeenCalledWith(env.track)
    expect(env.video.muted).toBe(false) // muted elements feed silence to Web Audio
    expect(env.ctx.scale).toHaveBeenCalledWith(-1, 1)
    expect(env.ctx.fillText).toHaveBeenCalledWith("killerpitch", expect.any(Number), expect.any(Number))
    expect(env.ctx.fillText).toHaveBeenCalledWith("שלום", expect.any(Number), expect.any(Number))
    expect(progress).toHaveBeenLastCalledWith(1)
    expect(env.stopAudio).toHaveBeenCalled()
    expect(env.stopVideo).toHaveBeenCalled()
    expect(env.close).toHaveBeenCalled()
    expect(env.disconnect).toHaveBeenCalled()
    expect(env.revoke).toHaveBeenCalledWith("blob:local")
    expect(env.requests).toEqual(["video/mp4"])
  })

  it("still draws the mark for a null path and rejects playback failures with cleanup", async () => {
    const env = setup(true)
    await expect(burnInKaraoke(new Blob(), null)).rejects.toThrow("Playback denied")
    expect(env.stopAudio).toHaveBeenCalled()
    expect(env.stopVideo).toHaveBeenCalled()
    expect(env.close).toHaveBeenCalled()
    expect(env.revoke).toHaveBeenCalled()
  })

  it("exports a null path without captions", async () => {
    const env = setup()
    await burnInKaraoke(new Blob(), null)
    expect(env.ctx.fillText.mock.calls.every(call => call[0] === "killerpitch")).toBe(true)
  })
})

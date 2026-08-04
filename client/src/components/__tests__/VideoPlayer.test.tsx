import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { VideoPlayer } from "@/components/ui/VideoPlayer"

// T-10024: the custom take player that replaces the browser's own
// `<video controls>` chrome on /results.
//
// The states worth testing here are the ones a real take actually produces and
// jsdom will not: a source that never decodes (the dev fixture blob), and a
// MediaRecorder WebM reporting `Infinity` until it is seeked. Both used to have
// no representation at all, because the native controls handled them.

// jsdom implements neither play() nor pause() — calling them throws
// "Not implemented". Stub them and drive the component through the events a
// real element would fire, which is what it actually listens to.
function stubMedia() {
  const play = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
    this.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })
  const pause = vi.fn().mockImplementation(function (this: HTMLVideoElement) {
    this.dispatchEvent(new Event("pause"))
  })
  Object.defineProperty(HTMLMediaElement.prototype, "play", { value: play, configurable: true })
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { value: pause, configurable: true })
  return { play, pause }
}

/** jsdom reports `paused: true` forever; make it follow the stubs. */
function stubPaused(paused: boolean) {
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    get: () => paused,
    configurable: true,
  })
}

/** Force a duration and announce it the way a real element would. */
function setDuration(video: HTMLVideoElement, value: number) {
  Object.defineProperty(video, "duration", { value, configurable: true })
  fireEvent(video, new Event("durationchange"))
  fireEvent(video, new Event("loadedmetadata"))
}

const player = () => document.querySelector("video") as HTMLVideoElement
const scrubber = () => screen.getByLabelText("Seek") as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  stubMedia()
  stubPaused(true)
})

afterEach(cleanup)

describe("VideoPlayer — the undecodable / unknown-duration states", () => {
  it("renders its full control layout with a source that never loads", () => {
    render(<VideoPlayer src="blob:never-decodes" />)

    // The whole point: with the dev fixture blob `loadedmetadata` never fires,
    // and the player still has to be a reviewable object in a screenshot.
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy()
    expect(scrubber()).toBeTruthy()
    expect(screen.getByText("0:00")).toBeTruthy()
  })

  it("shows 0:00 rather than NaN:NaN when duration is NaN", () => {
    render(<VideoPlayer src="blob:take" />)
    setDuration(player(), NaN)

    expect(screen.getByText("0:00")).toBeTruthy()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it("shows 0:00 rather than Infinity when a WebM reports an infinite duration", () => {
    render(<VideoPlayer src="blob:take" />)
    setDuration(player(), Infinity)

    expect(screen.getByText("0:00")).toBeTruthy()
    expect(screen.queryByText(/Infinity/)).toBeNull()
  })

  it("shows elapsed / total once a real duration arrives", () => {
    render(<VideoPlayer src="blob:take" />)
    const video = player()
    setDuration(video, 27.4)
    Object.defineProperty(video, "currentTime", { value: 5, configurable: true, writable: true })
    fireEvent(video, new Event("timeupdate"))

    expect(screen.getByText("0:05 / 0:27")).toBeTruthy()
  })

  it("does not throw when scrubbed before metadata, and does not move the video", () => {
    render(<VideoPlayer src="blob:never-decodes" />)
    const video = player()
    let assigned: number | null = null
    Object.defineProperty(video, "currentTime", {
      get: () => 0,
      set: (v: number) => {
        assigned = v
      },
      configurable: true,
    })

    expect(() => fireEvent.change(scrubber(), { target: { value: "12" } })).not.toThrow()
    expect(assigned).toBeNull()
  })

  it("seeks once a duration is known", () => {
    render(<VideoPlayer src="blob:take" />)
    const video = player()
    let assigned: number | null = null
    Object.defineProperty(video, "currentTime", {
      get: () => assigned ?? 0,
      set: (v: number) => {
        assigned = v
      },
      configurable: true,
    })
    setDuration(video, 30)

    fireEvent.change(scrubber(), { target: { value: "12" } })
    expect(assigned).toBe(12)
  })
})

describe("VideoPlayer — playback controls", () => {
  it("flips the play control's aria-label between Play and Pause", () => {
    render(<VideoPlayer src="blob:take" />)
    const video = player()

    // Two controls carry the label: the icon button and the click-anywhere
    // overlay on the picture. Both must tell the same story.
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(2)

    fireEvent(video, new Event("play"))
    expect(screen.getAllByRole("button", { name: "Pause" })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull()

    fireEvent(video, new Event("pause"))
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(2)
  })

  it("plays when the play control is pressed and pauses when it is pressed again", () => {
    const { play, pause } = stubMedia()
    render(<VideoPlayer src="blob:take" />)

    stubPaused(true)
    fireEvent.click(screen.getAllByRole("button", { name: "Play" })[0])
    expect(play).toHaveBeenCalledTimes(1)

    stubPaused(false)
    fireEvent.click(screen.getAllByRole("button", { name: "Pause" })[0])
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it("toggles playback on Space from anywhere inside the player", () => {
    const { play } = stubMedia()
    const { container } = render(<VideoPlayer src="blob:take" />)

    fireEvent.keyDown(container.firstElementChild!, { key: " " })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("leaves other keys alone so the scrubber keeps its arrow keys", () => {
    const { play, pause } = stubMedia()
    const { container } = render(<VideoPlayer src="blob:take" />)

    fireEvent.keyDown(container.firstElementChild!, { key: "ArrowRight" })
    expect(play).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
  })

  it("mutes and unmutes, and says which one it will do", () => {
    render(<VideoPlayer src="blob:take" />)
    const video = player()

    fireEvent.click(screen.getByRole("button", { name: "Mute" }))
    expect(video.muted).toBe(true)
    expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Unmute" }))
    expect(video.muted).toBe(false)
  })
})

describe("VideoPlayer — the attributes that are load-bearing on a phone", () => {
  it("keeps playsInline and drops the native controls", () => {
    render(<VideoPlayer src="blob:take" />)
    const video = player()

    // Without playsInline, iOS Safari opens the take in its own fullscreen
    // player and the user leaves /results entirely. No test would otherwise
    // catch its removal, so it is asserted on the element.
    expect(video.hasAttribute("playsinline")).toBe(true)
    expect(video.hasAttribute("controls")).toBe(false)
  })

  it("offers no fullscreen and no playback-rate control", () => {
    render(<VideoPlayer src="blob:take" />)
    for (const name of [/fullscreen/i, /speed/i, /playback rate/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })
})

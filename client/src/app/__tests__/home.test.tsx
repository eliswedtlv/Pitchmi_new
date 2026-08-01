import { render, screen, cleanup, act, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// T-1170 §B4: with Save-to-cloud removed nothing writes to storage, so the
// "My saved videos" entry point is hidden. The /videos screen itself stays.
// T-1172: the upload path gets a duration precheck before any project exists.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  createProject: vi.fn(),
  transcribeVideo: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({
  createProject: h.createProject,
  transcribeVideo: h.transcribeVideo,
}))
vi.mock("@/store/session", () => ({
  useSession: () => ({ setProject: vi.fn(), setTakeBlob: vi.fn(), setPathResult: vi.fn() }),
}))

import HomePage from "../page"

afterEach(cleanup)

describe("HomePage", () => {
  it("does not link to My saved videos", () => {
    render(<HomePage />)
    expect(screen.queryByText(/my saved videos/i)).toBeNull()
    expect(document.querySelector('a[href="/videos"]')).toBeNull()
  })

  it("advertises the 30-second limit", () => {
    render(<HomePage />)
    expect(screen.getByText(/≤ 30 seconds/)).toBeTruthy()
  })
})

describe("HomePage — upload duration precheck (T-1172)", () => {
  // jsdom never loads real media, so the detached <video> is stubbed: each test
  // decides what duration the browser "reports" (or that it fails to report).
  let reported: number | typeof NaN | null

  beforeEach(() => {
    vi.clearAllMocks()
    reported = null
    // jsdom ships no object-URL support at all, so these are defined, not spied.
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string, ...rest) => {
      const el = realCreate(tag, ...rest)
      if (tag !== "video") return el
      Object.defineProperty(el, "duration", { get: () => reported })
      // Fire the metadata (or error) callback as soon as a src is assigned.
      Object.defineProperty(el, "src", {
        set() {
          queueMicrotask(() => {
            if (reported === null) (el as HTMLVideoElement).onerror?.(new Event("error"))
            else (el as HTMLVideoElement).onloadedmetadata?.(new Event("loadedmetadata"))
          })
        },
      })
      return el
    })
  })

  afterEach(() => vi.restoreAllMocks())

  function upload(file: File) {
    render(<HomePage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, "files", { value: [file], configurable: true })
    return act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
  }

  const video = () => new File(["bytes"], "take.mp4", { type: "video/mp4" })

  it("rejects a >30s video before any project is created or byte uploaded", async () => {
    reported = 47
    await upload(video())

    await waitFor(() => expect(screen.getByText(/30 seconds or shorter/i)).toBeTruthy())
    expect(h.createProject).not.toHaveBeenCalled()
    expect(h.transcribeVideo).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it("accepts a 30s video", async () => {
    reported = 30
    h.createProject.mockResolvedValue({ id: "p1" })
    h.transcribeVideo.mockResolvedValue({
      script: "hi",
      language: "en",
      path: { words: [], lines: [], total_s: 0.4 },
      duration_s: 0.4,
    })
    await upload(video())

    await waitFor(() => expect(h.createProject).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/30 seconds or shorter/i)).toBeNull()
  })

  it("fails OPEN when the browser can't report a duration — the server is the gate", async () => {
    reported = NaN
    h.createProject.mockResolvedValue({ id: "p1" })
    h.transcribeVideo.mockResolvedValue({
      script: "hi",
      language: "en",
      path: { words: [], lines: [], total_s: 0.4 },
      duration_s: 0.4,
    })
    await upload(video())

    await waitFor(() => expect(h.createProject).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/30 seconds or shorter/i)).toBeNull()
  })

  it("fails OPEN when metadata never loads at all", async () => {
    reported = null // drives the <video> onerror path
    h.createProject.mockResolvedValue({ id: "p1" })
    h.transcribeVideo.mockResolvedValue({
      script: "hi",
      language: "en",
      path: { words: [], lines: [], total_s: 0.4 },
      duration_s: 0.4,
    })
    await upload(video())

    await waitFor(() => expect(h.createProject).toHaveBeenCalledTimes(1))
  })
})

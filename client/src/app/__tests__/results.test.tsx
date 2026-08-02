import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Results-screen actions (T-1170 §B): Try again (green primary), New video,
// Share. Download and Save-to-cloud are gone; Share uses the OS share sheet and
// falls back to a direct download when files can't be shared (most desktop
// browsers). T-10018 adds Edit text alongside them, without changing the
// hierarchy — Try again is still the primary.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  session: {
    project: { id: "p1", language: "en" },
    takeBlob: new Blob(["take"], { type: "video/webm" }),
    takeBlobUrl: "blob:take",
    evalResult: {
      overall: 88,
      dimensions: {},
      comments: [],
      flags: [],
      evals_left_today: 5,
    },
    reset: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/store/session", () => ({ useSession: () => h.session }))

import ResultsPage from "../results/page"

// jsdom has neither share nor canShare; define them per-test on the real
// navigator rather than replacing it wholesale.
function stubShare(canShare: boolean, share = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "canShare", {
    value: vi.fn().mockReturnValue(canShare),
    configurable: true,
  })
  Object.defineProperty(navigator, "share", { value: share, configurable: true })
  return share
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  delete (navigator as { canShare?: unknown }).canShare
  delete (navigator as { share?: unknown }).share
})

describe("ResultsPage actions", () => {
  it("shows Try again as the green primary button", () => {
    render(<ResultsPage />)
    const btn = screen.getByRole("button", { name: /try again/i })
    expect(btn.className).toMatch(/bg-green-600/)

    fireEvent.click(btn)
    expect(h.push).toHaveBeenCalledWith("/karaoke")
  })

  it("renders only Try again / Edit text / New video / Share", () => {
    render(<ResultsPage />)
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim())
    expect(names).toEqual(["Try again", "Edit text", "New video", "Share"])
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /save to cloud/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /my videos/i })).toBeNull()
  })

  // T-10018: the way back to the words. The script must survive the trip, so
  // this button must NOT reset the session the way "New video" does — saving
  // the edited text re-seeds the path server-side and the next take rehearses
  // against the new words.
  it("Edit text goes home WITHOUT clearing the session script", () => {
    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /edit text/i }))

    expect(h.push).toHaveBeenCalledWith("/")
    expect(h.session.reset).not.toHaveBeenCalled()
  })

  it("New video still clears the session before going home", () => {
    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /new video/i }))

    expect(h.session.reset).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledWith("/")
  })

  it("Share calls navigator.share with the video file when files are supported", async () => {
    const share = stubShare(true)

    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /share/i }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const arg = share.mock.calls[0][0]
    expect(arg.files).toHaveLength(1)
    expect(arg.files[0].name).toBe("pitchmi-take.webm")
  })

  it("Share falls back to a direct download when files can't be shared", async () => {
    const share = stubShare(false)
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    render(<ResultsPage />)
    fireEvent.click(screen.getByRole("button", { name: /share/i }))

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(share).not.toHaveBeenCalled()
    const a = click.mock.contexts[0] as HTMLAnchorElement
    expect(a.download).toBe("pitchmi-take.webm")
    click.mockRestore()
  })
})

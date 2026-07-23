import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Save-to-cloud feedback (T-1167 §C): a successful save flips the button to a
// disabled "Saved ✓", pops a toast with a "My videos" link, guards against
// duplicate saves, and surfaces failures as an error toast.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  saveTake: vi.fn(),
  session: {
    project: { id: "p1", language: "en" },
    takeBlob: new Blob(["take"]),
    takeBlobUrl: "blob:take",
    evalResult: {
      overall: 88,
      dimensions: {},
      comments: [],
      flags: [],
      evals_left_today: 5,
    },
  },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({ saveTake: h.saveTake }))
vi.mock("@/store/session", () => ({ useSession: () => h.session }))

import ResultsPage from "../results/page"

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

function clickSave() {
  fireEvent.click(screen.getByRole("button", { name: /save to cloud/i }))
}

describe("ResultsPage save-to-cloud feedback", () => {
  it("shows a success toast with a My videos link and a disabled Saved button", async () => {
    h.saveTake.mockResolvedValue({ take_id: "t1" })
    render(<ResultsPage />)

    clickSave()

    const toast = await screen.findByTestId("save-toast")
    expect(toast.getAttribute("data-variant")).toBe("success")
    expect(toast.textContent).toMatch(/Saved to your videos/)

    // Button switched to the disabled "Saved ✓" state.
    const savedBtn = screen.getByRole("button", { name: /saved/i })
    expect((savedBtn as HTMLButtonElement).disabled).toBe(true)

    // The inline "My videos" link navigates to /videos.
    fireEvent.click(screen.getByRole("button", { name: /my videos/i }))
    expect(h.push).toHaveBeenCalledWith("/videos")
  })

  it("does not save the same take twice", async () => {
    h.saveTake.mockResolvedValue({ take_id: "t1" })
    render(<ResultsPage />)

    clickSave()
    await screen.findByTestId("save-toast")
    // A second tap after success must be a no-op: the button is now the disabled
    // "Saved ✓" and clicking it does not re-issue the save.
    fireEvent.click(screen.getByRole("button", { name: /saved/i }))
    await waitFor(() => expect(h.saveTake).toHaveBeenCalledTimes(1))
  })

  it("shows an error toast when the save fails", async () => {
    h.saveTake.mockRejectedValue(new Error("Network error"))
    render(<ResultsPage />)

    clickSave()

    const toast = await screen.findByTestId("save-toast")
    expect(toast.getAttribute("data-variant")).toBe("error")
    expect(toast.textContent).toMatch(/network error/i)
    // No "My videos" link on failure; the button is still savable.
    expect(screen.queryByRole("button", { name: /my videos/i })).toBeNull()
    const btn = screen.getByRole("button", { name: /save to cloud/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })
})

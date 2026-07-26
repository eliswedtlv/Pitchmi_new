import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// T-1170 §B4: with Save-to-cloud removed nothing writes to storage, so the
// "My saved videos" entry point is hidden. The /videos screen itself stays.

const h = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock("@/lib/api", () => ({ createProject: vi.fn(), transcribeVideo: vi.fn() }))
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
})

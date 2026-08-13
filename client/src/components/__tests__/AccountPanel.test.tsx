import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  signOutCurrentDevice: vi.fn(),
  startGoogleSignIn: vi.fn(),
  startGoogleUpgrade: vi.fn(),
}))

vi.mock("@/lib/googleAuth", () => ({
  getCurrentAccount: h.getCurrentAccount,
  signOutCurrentDevice: h.signOutCurrentDevice,
  startGoogleSignIn: h.startGoogleSignIn,
  startGoogleUpgrade: h.startGoogleUpgrade,
}))

import { AccountPanel } from "../AccountPanel"

beforeEach(() => {
  vi.clearAllMocks()
  h.startGoogleSignIn.mockResolvedValue(undefined)
  h.startGoogleUpgrade.mockResolvedValue(undefined)
  h.signOutCurrentDevice.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe("AccountPanel", () => {
  it("offers an optional identity-preserving upgrade", async () => {
    h.getCurrentAccount.mockResolvedValue({ kind: "anonymous" })
    render(<AccountPanel />)

    const upgrade = await screen.findByRole("button", { name: "Save with Google" })
    expect(screen.getByText(/same KillerPitch identity/i)).toBeTruthy()
    fireEvent.click(upgrade)

    await waitFor(() => expect(h.startGoogleUpgrade).toHaveBeenCalledWith("/account"))
  })

  it("warns before replacing a temporary session with an existing account", async () => {
    h.getCurrentAccount.mockResolvedValue({ kind: "guest" })
    render(<AccountPanel />)

    fireEvent.click(await screen.findByRole("button", { name: /sign in instead/i }))
    expect(screen.getByText(/temporary identity stays separate/i)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Switch and sign in" }))
    await waitFor(() => expect(h.startGoogleSignIn).toHaveBeenCalledWith("/account"))
  })

  it("does not expose upstream authentication errors", async () => {
    h.getCurrentAccount.mockResolvedValue({ kind: "anonymous" })
    h.startGoogleUpgrade.mockRejectedValue(new Error("provider_secret_detail"))
    render(<AccountPanel />)

    fireEvent.click(await screen.findByRole("button", { name: "Save with Google" }))

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Google could not be connected. Try again.",
    )
    expect(screen.queryByText(/provider_secret_detail/i)).toBeNull()
  })

  it("shows the connected identity and signs out only this device", async () => {
    h.getCurrentAccount.mockResolvedValue({
      kind: "permanent",
      name: "Eli W",
      email: "eli@example.com",
    })
    render(<AccountPanel />)

    expect(await screen.findByText(/Connected as/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Sign out on this device" }))

    await waitFor(() => expect(h.signOutCurrentDevice).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole("button", { name: "Save with Google" })).toBeTruthy()
  })
})

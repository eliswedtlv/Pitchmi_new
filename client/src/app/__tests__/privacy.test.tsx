import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/DeleteMyData", () => ({
  DeleteMyData: () => <div>Delete my data</div>,
}))

import PrivacyPage from "../privacy/page"

afterEach(cleanup)

describe("PrivacyPage", () => {
  it("describes processors without naming suppliers", () => {
    render(<PrivacyPage />)

    expect(
      screen.getByText(/sent securely to U\.S\.-based service providers/i),
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(
      /ElevenLabs|OpenRouter|Google Gemini/i,
    )
  })
})

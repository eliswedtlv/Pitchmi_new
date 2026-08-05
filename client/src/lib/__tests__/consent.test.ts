import { beforeEach, describe, expect, it } from "vitest"
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  clearConsent,
  readConsent,
  storeConsent,
} from "../consent"

beforeEach(() => window.localStorage.clear())

describe("consent receipt", () => {
  it("stores a trimmed, versioned local acknowledgement", () => {
    const record = storeConsent("  E.W.  ")
    expect(record.version).toBe(CONSENT_VERSION)
    expect(record.acknowledgedAs).toBe("E.W.")
    expect(readConsent()).toEqual(record)
  })

  it("rejects stale, malformed and empty acknowledgements", () => {
    expect(() => storeConsent("   ")).toThrow(/name or initials/i)

    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: "old",
        acknowledgedAs: "E.W.",
        acceptedAt: new Date().toISOString(),
      }),
    )
    expect(readConsent()).toBeNull()

    window.localStorage.setItem(CONSENT_STORAGE_KEY, "not-json")
    expect(readConsent()).toBeNull()
  })

  it("can be withdrawn on the device", () => {
    storeConsent("E.W.")
    clearConsent()
    expect(readConsent()).toBeNull()
  })
})

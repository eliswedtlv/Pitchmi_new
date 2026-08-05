export const CONSENT_VERSION = "2026-08-05"
export const CONSENT_STORAGE_KEY = "pitchmi.consent"

export interface ConsentRecord {
  version: string
  acknowledgedAs: string
  acceptedAt: string
}

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<ConsentRecord>
    if (
      parsed.version !== CONSENT_VERSION ||
      typeof parsed.acknowledgedAs !== "string" ||
      !parsed.acknowledgedAs.trim() ||
      typeof parsed.acceptedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.acceptedAt))
    ) {
      return null
    }
    return parsed as ConsentRecord
  } catch {
    return null
  }
}

export function storeConsent(acknowledgedAs: string): ConsentRecord {
  const trimmed = acknowledgedAs.trim()
  if (!trimmed || trimmed.length > 80) {
    throw new Error("Enter your name or initials.")
  }
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    acknowledgedAs: trimmed,
    acceptedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  return record
}

export function clearConsent() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  }
}

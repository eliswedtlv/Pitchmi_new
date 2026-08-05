"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { LockKeyhole, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { recordConsent } from "@/lib/api"
import { CONSENT_VERSION, storeConsent } from "@/lib/consent"

interface ConsentFormProps {
  onAccepted: () => void | Promise<void>
  onCancel: () => void
}

export function ConsentForm({ onAccepted, onCancel }: ConsentFormProps) {
  const [acknowledgedAs, setAcknowledgedAs] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entry = acknowledgedAs.trim()
    if (!entry) {
      setError("Enter your name or initials.")
      return
    }
    if (!agreed) {
      setError("Confirm the consent statement to continue.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      // The server receipt contains only anonymous user id, timestamp and
      // version. The typed acknowledgement stays in this browser.
      await recordConsent(CONSENT_VERSION)
      storeConsent(entry)
      await onAccepted()
    } catch (cause) {
      setError((cause as Error).message || "Consent could not be recorded. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-control border border-line-strong bg-surface p-4 text-start"
      aria-label="Recording and AI processing consent"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-control bg-accent text-accent-fg">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-body font-semibold text-fg">Before the camera turns on</h2>
          <p className="mt-1 text-meta text-fg-muted">
            One acknowledgement, no account. You can delete your data whenever you want.
          </p>
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="consent-name" className="text-meta font-medium text-fg">
          Name or initials
        </label>
        <input
          id="consent-name"
          value={acknowledgedAs}
          onChange={(event) => setAcknowledgedAs(event.target.value)}
          maxLength={80}
          autoComplete="name"
          placeholder="Any name or initials"
          className="h-11 rounded-control border border-line-strong bg-canvas px-3 text-body text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <p className="flex items-center gap-1.5 text-micro text-fg-subtle">
          <LockKeyhole className="h-3 w-3" aria-hidden />
          This entry stays on this device and is never sent to PitchMi.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-control bg-raised/70 p-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="text-meta leading-relaxed text-fg-muted">
          I agree to the{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-fg underline decoration-line-strong underline-offset-2 hover:text-accent"
          >
            Privacy Notice
          </Link>
          {" "}and consent to processing my script, video and audio for transcription
          and delivery feedback. I am 18+ and have permission from everyone recorded.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-meta text-bad-fg">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Recording consent…" : "Agree & continue"}
        </Button>
      </div>
    </form>
  )
}

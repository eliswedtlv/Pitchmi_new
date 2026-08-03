"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { WaitView } from "@/components/WaitView"
import { useSession } from "@/store/session"
import { useWakeLock } from "@/hooks/useWakeLock"
import { getAd, evaluateVideo, type AdConfig } from "@/lib/api"
import { nextStage, type EvalStage } from "@/lib/evalStages"
import { evalTooLong } from "@/lib/strings"

export default function WaitPage() {
  const router = useRouter()
  const { project, takeBlob, setEvalResult, setPathResult } = useSession()
  const [ad, setAd] = useState<AdConfig | null>(null)
  const [adSkipped, setAdSkipped] = useState(false)
  const [stage, setStage] = useState<EvalStage>("uploading")
  const [error, setError] = useState<string | null>(null)

  // Hold the screen awake for the whole wait (survives visibility changes).
  useWakeLock(true)

  useEffect(() => {
    if (!project || !takeBlob) {
      router.push("/")
      return
    }

    // Load ad config (optional — failure just hides the ad).
    getAd().then(setAd).catch(() => setAdSkipped(true))

    // Kick off evaluation. This request must survive the whole wait — the ad and
    // "Skip Ad" never touch it (Skip only hides the ad element). The label only
    // advances on real events: "sent" (request in flight) → analyzing, then a
    // resolve/reject. Any failure or timeout surfaces the error screen.
    evaluateVideo(takeBlob, project.id, () => setStage((s) => nextStage(s, "sent")))
      .then((result) => {
        setEvalResult(result)
        // The take just re-timed the prompter (T-10018) — adopt it, so "Try
        // again" rehearses against the user's own measured pace instead of the
        // seed estimate. Absent when the take drifted too far from the script.
        if (result.path) {
          setPathResult({
            path: result.path,
            fits: true,
            est_duration_s: result.path.total_s,
          })
        }
        router.push("/results")
      })
      .catch((e: unknown) => {
        const err = e as { status?: number; body?: { error?: string; limit?: number } }
        if (err.status === 429) {
          setError(`Daily evaluation limit reached (${err.body?.limit ?? 25}/day). Come back tomorrow!`)
        } else if (err.status === 503) {
          setError("Service is temporarily paused. Please try again later.")
        } else if (err.status === 504 || err.body?.error === "eval_upstream_timeout") {
          setError(evalTooLong(project?.language))
        } else {
          setError((e as Error).message)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Markup lives in WaitView (T-10022) so the /dev/ui/wait fixture can shoot the
  // real screen without a live backend. Nothing above this line moved.
  return (
    <WaitView
      stage={stage}
      error={error}
      ad={adSkipped ? null : ad}
      onSkipAd={() => setAdSkipped(true)}
      onHome={() => router.push("/")}
    />
  )
}

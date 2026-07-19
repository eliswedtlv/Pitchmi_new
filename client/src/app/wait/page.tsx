"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdSlot } from "@/components/AdSlot"
import { useSession } from "@/store/session"
import { useWakeLock } from "@/hooks/useWakeLock"
import { getAd, evaluateVideo, type AdConfig } from "@/lib/api"
import { nextStage, STAGE_LABEL, type EvalStage } from "@/lib/evalStages"

// Widths reflect ONLY the two honest, state-driven stages. No timer ever
// advances the label past reality — the eval either resolves (→ results) or
// fails (→ error screen); it never sits on a fake "Scoring" step forever.
const STAGE_WIDTH: Record<EvalStage, string> = {
  uploading: "25%",
  analyzing: "70%",
  done: "100%",
  error: "100%",
}

export default function WaitPage() {
  const router = useRouter()
  const { project, takeBlob, setEvalResult } = useSession()
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
        router.push("/results")
      })
      .catch((e: unknown) => {
        const err = e as { status?: number; body?: { error?: string; limit?: number } }
        if (err.status === 429) {
          setError(`Daily evaluation limit reached (${err.body?.limit ?? 25}/day). Come back tomorrow!`)
        } else if (err.status === 503) {
          setError("Service is temporarily paused. Please try again later.")
        } else {
          setError((e as Error).message)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-4 text-center">
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-red-700">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-neutral-500 hover:text-neutral-700 underline"
          >
            Back to home
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center px-4 gap-8">
      {/* Ad — Skip only hides this element; it never affects the pending eval. */}
      {ad && !adSkipped && (
        <div className="w-full max-w-md">
          <AdSlot config={ad} onSkip={() => setAdSkipped(true)} />
        </div>
      )}

      {/* Progress */}
      <div className="w-full max-w-md space-y-4">
        <div className="h-1.5 rounded-full bg-neutral-700 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-700 ease-out"
            style={{ width: STAGE_WIDTH[stage] }}
          />
        </div>
        <p className="text-white text-center text-sm">{STAGE_LABEL[stage]}</p>
        <p className="text-neutral-400 text-center text-xs">
          This can take up to two minutes — keep this screen open.
        </p>
      </div>
    </main>
  )
}

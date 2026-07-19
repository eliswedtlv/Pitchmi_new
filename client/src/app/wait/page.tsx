"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AdSlot } from "@/components/AdSlot"
import { useSession } from "@/store/session"
import { useWakeLock } from "@/hooks/useWakeLock"
import { getAd, evaluateVideo, type AdConfig } from "@/lib/api"

// Honest staged progress. Stage 0 advances on real upload completion; the rest
// advance on a timer so a 1–2 min wait reads as intentional, not stuck.
const STAGES = [
  "Uploading your take…",
  "Transcribing…",
  "AI is watching your take…",
  "Scoring your delivery…",
]
const STAGE_WIDTHS = ["20%", "45%", "75%", "92%"]
// Seconds into server processing at which to advance to the next stage.
const STAGE_AT_S = [0, 18, 55]

export default function WaitPage() {
  const router = useRouter()
  const { project, takeBlob, setEvalResult } = useSession()
  const [ad, setAd] = useState<AdConfig | null>(null)
  const [adSkipped, setAdSkipped] = useState(false)
  const [stage, setStage] = useState(0)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const processingStart = useRef<number | null>(null)

  // Hold the screen awake for the whole wait (survives visibility changes).
  useWakeLock(true)

  useEffect(() => {
    if (!project || !takeBlob) {
      router.push("/")
      return
    }

    // Load ad config (optional — failure just hides the ad).
    getAd().then(setAd).catch(() => setAdSkipped(true))

    // Advance timed stages once the server is processing (upload done).
    const interval = setInterval(() => {
      const start = processingStart.current
      if (start == null) return
      const elapsed = (performance.now() - start) / 1000
      let next = 1
      for (let i = 0; i < STAGE_AT_S.length; i++) {
        if (elapsed >= STAGE_AT_S[i]) next = i + 1
      }
      setStage((s) => Math.max(s, Math.min(next, STAGES.length - 1)))
    }, 1000)

    // Kick off evaluation. This request must survive the whole wait — the ad and
    // "Skip Ad" never touch it (Skip only hides the ad element).
    evaluateVideo(takeBlob, project.id, (s, fraction) => {
      if (s === "uploading") {
        setStage((cur) => Math.max(cur, 0))
        if (fraction != null) setUploadPct(Math.round(fraction * 100))
      } else {
        if (processingStart.current == null) processingStart.current = performance.now()
        setStage((cur) => Math.max(cur, 1))
      }
    })
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

    return () => clearInterval(interval)
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

  const label =
    stage === 0 && uploadPct > 0 ? `${STAGES[0]} ${uploadPct}%` : STAGES[stage]

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
            style={{ width: STAGE_WIDTHS[stage] }}
          />
        </div>
        <p className="text-white text-center text-sm">{label}</p>
        <p className="text-neutral-400 text-center text-xs">
          This can take up to two minutes — keep this screen open.
        </p>
      </div>
    </main>
  )
}

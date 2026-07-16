"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdSlot } from "@/components/AdSlot"
import { useSession } from "@/store/session"
import { useWakeLock } from "@/hooks/useWakeLock"
import { getAd, evaluateVideo, type AdConfig } from "@/lib/api"

const MESSAGES = [
  "Analyzing your delivery…",
  "Checking eye contact and posture…",
  "Measuring pace and timing…",
  "Reviewing voice modulation…",
  "Generating coach feedback…",
]

export default function WaitPage() {
  const router = useRouter()
  const { project, takeBlob, setEvalResult } = useSession()
  const [ad, setAd] = useState<AdConfig | null>(null)
  const [adSkipped, setAdSkipped] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useWakeLock(true)

  useEffect(() => {
    if (!project || !takeBlob) {
      router.push("/")
      return
    }

    // Load ad config
    getAd().then(setAd).catch(() => setAdSkipped(true))

    // Rotate status messages
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2500)

    // Kick off evaluation
    evaluateVideo(takeBlob, project.id)
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

  return (
    <main className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center px-4 gap-8">
      {/* Ad */}
      {ad && !adSkipped && (
        <div className="w-full max-w-md">
          <AdSlot config={ad} onSkip={() => setAdSkipped(true)} />
        </div>
      )}

      {/* Progress */}
      <div className="w-full max-w-md space-y-4">
        <div className="h-1.5 rounded-full bg-neutral-700 overflow-hidden">
          <div className="h-full bg-white rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
        <p className="text-white text-center text-sm animate-pulse">{MESSAGES[msgIndex]}</p>
      </div>
    </main>
  )
}

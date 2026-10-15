"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { WaitView } from "@/components/WaitView"
import { useSession } from "@/store/session"
import { useWakeLock } from "@/hooks/useWakeLock"
import { getAd, getRhythm, type AdConfig } from "@/lib/api"
import { nextStage, type WaitStage } from "@/lib/waitStages"
import { useUiLang } from "@/hooks/useUiLang"
import { errorText, strings } from "@/lib/i18n"

export default function WaitPage() {
  const router = useRouter()
  const { lang } = useUiLang()
  const { project, takeBlob, setPathResult, setTakeRhythm } = useSession()
  const [ad, setAd] = useState<AdConfig | null>(null)
  const [adSkipped, setAdSkipped] = useState(false)
  const [stage, setStage] = useState<WaitStage>("uploading")
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

    // Upload the take to learn its rhythm. This request must survive the whole
    // wait — the ad and "Skip Ad" never touch it (Skip only hides the ad
    // element). The label only advances on real events.
    getRhythm(takeBlob, project.id, () => setStage((s) => nextStage(s, "sent")))
      .then((result) => {
        // A matching take becomes the rhythm the next take follows. A null
        // path (the take drifted from the script) keeps the previous rhythm —
        // or, with none yet, the next take is a teleprompter take again.
        if (result.path) {
          setPathResult({
            path: result.path,
            fits: true,
            est_duration_s: result.path.total_s,
          })
          setTakeRhythm("new")
        } else {
          setTakeRhythm("unchanged")
        }
        router.push("/results")
      })
      .catch((e: unknown) => {
        const err = e as { status?: number; body?: { error?: string; limit?: number } }
        if (err.status === 429) {
          setError(strings(lang).dailyLimit(err.body?.limit ?? 25))
        } else if (err.status === 503) {
          setError(strings(lang).busy)
        } else {
          setError(errorText(e, lang))
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Markup lives in WaitView (T-10022) so the /dev/ui/wait fixture can shoot the
  // real screen without a live backend.
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

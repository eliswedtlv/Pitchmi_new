"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Prompter } from "@/components/Prompter"
import { useKaraokeClock } from "@/hooks/useKaraokeClock"
import { useRecorder } from "@/hooks/useRecorder"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useSession } from "@/store/session"
import { resolveDir } from "@/lib/textDir"
import type { KaraokeWord } from "@/lib/clock"

export default function KaraokePage() {
  const router = useRouter()
  const { project, pathResult, setTakeBlob } = useSession()

  useEffect(() => {
    if (!project || !pathResult) router.push("/editor")
  }, [project, pathResult, router])

  const path = pathResult?.path
  const words: KaraokeWord[] = path?.words ?? []
  const lines = path?.lines ?? []
  const gracePeriod = 3

  const { state, countdown, videoRef, start, stop } = useRecorder({
    maxDurationS: (path?.total_s ?? 60) + gracePeriod,
    onStop: (blob) => {
      setTakeBlob(blob)
      router.push("/wait")
    },
  })

  useWakeLock(state === "recording" || state === "countdown")

  const isRunning = state === "recording"
  const activeIdx = useKaraokeClock(words, isRunning)

  // Language/direction: prefer the detected language, fall back to the path text
  // itself so a missing language never reverses Hebrew (T-1164).
  const lang = project?.language
  const dir = resolveDir(lang, lines.map((l) => l.text).join(" "))

  // Auto-start on mount
  useEffect(() => {
    if (!path) return
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!path) return null

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Full-screen camera preview */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Karaoke subtitles overlaid on the video (upper third, near camera) */}
      {(state === "recording" || state === "countdown") && (
        <Prompter
          words={words}
          lines={lines}
          activeIdx={activeIdx}
          dir={dir}
          lang={lang}
          phase={state === "recording" ? "recording" : "countdown"}
        />
      )}

      {/* Countdown overlaid on the video */}
      {state === "countdown" && countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="text-8xl font-bold text-white drop-shadow-lg">{countdown}</span>
        </div>
      )}

      {/* Stop button */}
      {state === "recording" && (
        <div className="absolute inset-x-0 flex justify-center safe-pos-4">
          <Button onClick={stop} variant="destructive" size="lg" className="gap-2 shadow-lg">
            <Square className="h-5 w-5 fill-current" />
            Stop recording
          </Button>
        </div>
      )}
    </div>
  )
}

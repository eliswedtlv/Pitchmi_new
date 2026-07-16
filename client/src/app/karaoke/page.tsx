"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useKaraokeClock } from "@/hooks/useKaraokeClock"
import { useRecorder } from "@/hooks/useRecorder"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useSession } from "@/store/session"
import type { KaraokeWord } from "@/lib/clock"

export default function KaraokePage() {
  const router = useRouter()
  const { project, pathResult, speed, setTakeBlob } = useSession()
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])

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

  // Scroll current line into view
  useEffect(() => {
    if (activeIdx < 0 || !words[activeIdx]) return
    const lineIndex = words[activeIdx].line
    const el = lineRefs.current[lineIndex]
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeIdx, words])

  // Language/direction from project
  const lang = project?.language
  const dir: "ltr" | "rtl" = lang && ["he", "ar", "fa", "ur"].includes(lang) ? "rtl" : "ltr"

  // Auto-start on mount
  useEffect(() => {
    if (!path) return
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!path) return null

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Camera preview (small, top) */}
      <div className="relative mx-auto mt-4 w-full max-w-sm aspect-video rounded-xl overflow-hidden bg-neutral-900">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {state === "countdown" && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl font-bold text-white">{countdown}</span>
          </div>
        )}
      </div>

      {/* Teleprompter */}
      <div
        dir={dir}
        className="flex-1 overflow-hidden relative px-6 py-8"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <div className="max-w-xl mx-auto space-y-6">
          {lines.map((line, li) => {
            const lineWords = words.filter((w) => w.line === li)
            return (
              <div
                key={li}
                ref={(el) => { lineRefs.current[li] = el }}
                className="text-center text-3xl font-medium leading-relaxed transition-all"
              >
                {lineWords.map((word, wi) => {
                  const wordIdx = words.findIndex((w) => w === word)
                  const isPast = wordIdx < activeIdx
                  const isActive = wordIdx === activeIdx

                  return (
                    <span
                      key={wi}
                      className={`inline-block mx-0.5 transition-all duration-100 ${
                        isActive
                          ? "text-white scale-110 font-bold"
                          : isPast
                          ? "text-neutral-600"
                          : "text-neutral-400"
                      }`}
                    >
                      {word.w}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stop button */}
      {state === "recording" && (
        <div className="flex justify-center pb-8">
          <Button onClick={stop} variant="destructive" size="lg" className="gap-2">
            <Square className="h-5 w-5 fill-current" />
            Stop recording
          </Button>
        </div>
      )}
    </div>
  )
}

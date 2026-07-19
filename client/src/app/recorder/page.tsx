"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRecorder } from "@/hooks/useRecorder"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useSession } from "@/store/session"
import { transcribeVideo } from "@/lib/api"
import { useState } from "react"

const MAX_S = 60

export default function RecorderPage() {
  const router = useRouter()
  const { project, setTakeBlob, setEditedScript } = useSession()
  const [transcribing, setTranscribing] = useState(false)
  const [transError, setTransError] = useState<string | null>(null)

  const { state, countdown, elapsed, videoRef, start, stop, error } = useRecorder({
    maxDurationS: MAX_S,
    onStop: async (blob) => {
      if (!project) return
      setTakeBlob(blob)
      setTranscribing(true)
      setTransError(null)
      try {
        const result = await transcribeVideo(blob, project.id)
        setEditedScript(result.text)
        router.push("/editor")
      } catch (e) {
        setTransError((e as Error).message)
      } finally {
        setTranscribing(false)
      }
    },
  })

  useWakeLock(state === "recording" || state === "countdown")

  // Auto-start on mount
  useEffect(() => {
    if (!project) {
      router.push("/")
      return
    }
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, MAX_S - elapsed)
  const pct = ((MAX_S - remaining) / MAX_S) * 100
  const circumference = 2 * Math.PI * 44 // r=44

  if (transcribing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white space-y-4">
          <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg">Transcribing your take…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden"
      onClick={state === "recording" ? stop : undefined}
    >
      {/* Full-screen camera preview (portrait on phones, landscape on desktop) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Countdown overlay */}
      {state === "countdown" && countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="text-9xl font-bold text-white drop-shadow-lg animate-ping">
            {countdown}
          </span>
        </div>
      )}

      {/* Recording ring timer */}
      {state === "recording" && (
        <div className="absolute top-4 right-4">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke={remaining < 10 ? "#ef4444" : "#ffffff"}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (pct / 100)}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 0.2s linear" }}
            />
            <text x="50" y="55" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
              {Math.ceil(remaining)}
            </text>
          </svg>
        </div>
      )}

      {/* Stop button */}
      {state === "recording" && (
        <div
          className="absolute inset-x-0 flex flex-col items-center gap-2 safe-pos-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Button onClick={stop} variant="destructive" size="lg" className="gap-2 shadow-lg">
            <Square className="h-5 w-5 fill-current" />
            Stop
          </Button>
          <p className="text-white/50 text-sm">Tap anywhere to stop</p>
        </div>
      )}

      {/* Errors */}
      {(error ?? transError) && (
        <div className="absolute inset-x-0 top-1/3 mx-auto max-w-sm w-full px-4" onClick={(e) => e.stopPropagation()}>
          <p className="rounded-md bg-red-900/80 px-4 py-3 text-sm text-red-200">
            {error ?? transError}
          </p>
          <Button className="mt-3 w-full" onClick={() => router.push("/")}>
            Go back
          </Button>
        </div>
      )}
    </div>
  )
}

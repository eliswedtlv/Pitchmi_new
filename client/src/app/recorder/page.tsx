"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRecorder } from "@/hooks/useRecorder"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useSession } from "@/store/session"
import { transcribeVideo } from "@/lib/api"
import { MAX_TAKE_S } from "@/lib/limits"
import { useState } from "react"

export default function RecorderPage() {
  const router = useRouter()
  const { project, setProject, setTakeBlob, setPathResult } = useSession()
  const [transcribing, setTranscribing] = useState(false)
  const [transError, setTransError] = useState<string | null>(null)
  // A take the hard cap cut off, held back from transcribe until the user
  // chooses (T-1172). Take 1 defines `projects.path`, so a severed script would
  // poison every rehearsal scored against it — never ship one silently.
  const [cutOffBlob, setCutOffBlob] = useState<Blob | null>(null)

  async function transcribeAndGo(blob: Blob) {
    if (!project) return
    setCutOffBlob(null)
    setTakeBlob(blob)
    setTranscribing(true)
    setTransError(null)
    try {
      const result = await transcribeVideo(blob, project.id)
      // Persist the detected language so karaoke resolves RTL correctly (T-1164)
      // — the project was created before transcribe ran.
      setProject({ ...project, language: result.language })
      // Zero-edit flow (T-1169): transcribe returns the subtitle structure at
      // the take's real pace — go straight to karaoke, no editor step.
      setPathResult({ path: result.path, fits: true, est_duration_s: result.path.total_s })
      router.push("/karaoke")
    } catch (e) {
      setTransError((e as Error).message)
    } finally {
      setTranscribing(false)
    }
  }

  const { state, countdown, elapsed, videoRef, start, stop, error } = useRecorder({
    maxDurationS: MAX_TAKE_S,
    onStop: async (blob, reason) => {
      if (!project) return
      if (reason === "limit") {
        setCutOffBlob(blob)
        return
      }
      await transcribeAndGo(blob)
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

  const remaining = Math.max(0, MAX_TAKE_S - elapsed)
  const pct = ((MAX_TAKE_S - remaining) / MAX_TAKE_S) * 100
  const circumference = 2 * Math.PI * 44 // r=44
  // Urgency rescaled for a 30s take (T-1172): at 60s "red under 10" was the
  // final sixth; at 30s the same threshold would be the final third and read as
  // permanent alarm. White → amber ≤10s → red ≤5s, pulse only in the last 3.
  const ringStroke = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f59e0b" : "#ffffff"

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
            <g className={remaining <= 3 ? "ring-pulse" : undefined}>
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="44"
                fill="none"
                stroke={ringStroke}
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
            </g>
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

      {/* Hard-cap interstitial (T-1172). Blocks the transcribe until the user
          decides — this does not extend recording by a millisecond, it just
          refuses to ship a half-finished script into projects.path. */}
      {cutOffBlob && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-w-sm w-full space-y-5 text-center text-white">
            <h2 className="text-2xl font-bold">Time&apos;s up — {MAX_TAKE_S} seconds.</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              If your pitch got cut off, record it again. Your subtitles are built from
              this take, so a half-finished take means a half-finished script.
            </p>
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                variant="success"
                onClick={() => {
                  setCutOffBlob(null)
                  start()
                }}
              >
                Record again
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="secondary"
                onClick={() => transcribeAndGo(cutOffBlob)}
              >
                Use this take
              </Button>
            </div>
          </div>
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

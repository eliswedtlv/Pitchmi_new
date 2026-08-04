"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Square } from "lucide-react"
import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"
import { Prompter } from "@/components/Prompter"
import { useKaraokeClock } from "@/hooks/useKaraokeClock"
import { useRecorder } from "@/hooks/useRecorder"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useSession } from "@/store/session"
import { MAX_TAKE_S } from "@/lib/limits"
import { resolveDir } from "@/lib/textDir"
import type { KaraokeWord } from "@/lib/clock"

export default function KaraokePage() {
  const router = useRouter()
  const { project, pathResult, setTakeBlob } = useSession()

  useEffect(() => {
    if (!project || !pathResult) router.push("/")
  }, [project, pathResult, router])

  const path = pathResult?.path
  const words: KaraokeWord[] = path?.words ?? []
  const lines = path?.lines ?? []
  const gracePeriod = 3

  const { state, countdown, videoRef, start, stop, error } = useRecorder({
    // Bounded by take 1's real length (itself capped at MAX_TAKE_S), plus the
    // grace that lets a rehearsal finish its last subtitle word. A rehearsal
    // hitting its ceiling is expected and harmless — it does not define the
    // script — so the stop reason is deliberately ignored here (T-1172).
    maxDurationS: (path?.total_s ?? MAX_TAKE_S) + gracePeriod,
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
    // `.scheme-dark` pins the dark token values on this subtree (T-10022). The
    // camera screens are dark in BOTH colour schemes — deliberately: this is a
    // full-bleed live preview, and light chrome over it is unreadable and washes
    // out the picture. That is why the chrome below can use the same tokens as
    // the rest of the app instead of ad-hoc blacks. Do not "fix" this to follow
    // the OS scheme. The Prompter itself is out of scope and untouched.
    <div className="scheme-dark fixed inset-0 bg-media overflow-hidden">
      {/* Full-screen camera preview */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Brand markOnly inverse />
        <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              state === "recording" ? "bg-bad ring-4 ring-bad/20" : "bg-white/45"
            }`}
          />
          {state === "recording" ? "Recording" : "Rehearsal"}
        </span>
      </div>

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

      {/* Countdown overlaid on the video. The one place `text-display` appears
          outside the score — it is the same job: one number, nothing else. */}
      {state === "countdown" && countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-media/40">
          <span className="nums text-[5rem] font-medium leading-none text-media-fg drop-shadow-lg">
            {countdown}
          </span>
        </div>
      )}

      {/* Stop button. One of only two places a shadow survives the no-shadow
          policy — it floats over live video, where a border alone would not
          separate it from whatever happens to be behind it. */}
      {state === "recording" && (
        <div className="absolute inset-x-0 flex justify-center safe-pos-4">
          <Button onClick={stop} variant="destructive" size="lg" className="gap-2 shadow-lg">
            <Square className="h-5 w-5 fill-current" />
            Stop recording
          </Button>
        </div>
      )}

      {/* Errors — mirrors the recorder screen. Without this a denied camera (or a
          device still busy after take 1) left a black screen with no message and
          no way out but editing the URL. */}
      {error && (
        <div className="absolute inset-x-0 top-1/3 mx-auto max-w-sm w-full px-4">
          {/* Opaque surface, not a soft tint: this sits over a live camera feed,
              and a 15%-alpha fill over moving video is unreadable. */}
          <p className="rounded-control border border-bad/40 bg-surface px-4 py-3 text-meta text-bad-fg">
            {error}
          </p>
          <Button className="mt-3 w-full" onClick={() => router.push("/")}>
            Go back
          </Button>
        </div>
      )}
    </div>
  )
}

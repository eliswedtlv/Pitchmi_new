"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Square } from "lucide-react"
import { Brand } from "@/components/Brand"
import { LangToggle } from "@/components/LangToggle"
import { useUiLang } from "@/hooks/useUiLang"
import { errorText } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Prompter } from "@/components/Prompter"
import { useKaraokeClock } from "@/hooks/useKaraokeClock"
import { useSpeechFollow } from "@/hooks/useSpeechFollow"
import { useRecorder } from "@/hooks/useRecorder"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useSession } from "@/store/session"
import { MAX_TAKE_S } from "@/lib/limits"
import { resolveDir } from "@/lib/textDir"
import { buildTeleprompter, recognitionLang } from "@/lib/teleprompter"
import type { KaraokeWord } from "@/lib/clock"

const NO_WORDS: KaraokeWord[] = []

export default function KaraokePage() {
  const router = useRouter()
  const { lang: uiLang, t } = useUiLang()
  const { project, script, pathResult, setTakeBlob } = useSession()

  useEffect(() => {
    if (!project) router.push("/")
  }, [project, router])

  // No rhythm yet (KP-B) = take 1 is a teleprompter take that follows the
  // reader. From the first take that matches the script on, it's karaoke on
  // that take's rhythm.
  const path = pathResult?.path
  const teleprompter = !path
  const prompterScript = useMemo(() => buildTeleprompter(script), [script])
  const words: KaraokeWord[] = path?.words ?? prompterScript.words
  const lines = path?.lines ?? prompterScript.lines
  const gracePeriod = 3

  const { state, countdown, videoRef, start, stop, error } = useRecorder({
    // A karaoke take is bounded by the rhythm's length plus the grace that
    // lets it finish its last word; a teleprompter take only by the cap. A
    // take hitting its ceiling is expected and harmless, so the stop reason is
    // deliberately ignored here (T-1172).
    maxDurationS: path ? Math.min(MAX_TAKE_S, path.total_s + gracePeriod) : MAX_TAKE_S,
    onStop: (blob) => {
      setTakeBlob(blob)
      // A locked rhythm needs nothing from this take: no upload, no
      // speech-to-text, straight to the results. Read the store directly —
      // this callback was captured when the recorder started.
      const session = useSession.getState()
      if (session.rhythmLocked && session.pathResult) {
        session.setTakeRhythm("locked")
        router.push("/results")
      } else {
        router.push("/wait")
      }
    },
  })

  useWakeLock(state === "recording" || state === "countdown")

  const isRunning = state === "recording"

  // Language/direction: prefer the detected language, fall back to the text
  // itself so a missing language never reverses Hebrew (T-1164).
  const lang = project?.language
  const dir = resolveDir(lang, lines.map((l) => l.text).join(" "))

  const clockIdx = useKaraokeClock(path ? words : NO_WORDS, isRunning && !teleprompter)
  const follow = useSpeechFollow(
    teleprompter ? words : NO_WORDS,
    isRunning && teleprompter,
    recognitionLang(dir, typeof navigator === "undefined" ? undefined : navigator.language),
  )
  const activeIdx = teleprompter ? follow.activeIdx : clockIdx

  // Manual advance on take 1: arrow/space/page keys. Never block recording.
  const { nextLine, prevLine } = follow
  useEffect(() => {
    if (!teleprompter || !isRunning) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("button, input, textarea")) return
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault()
        nextLine()
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault()
        prevLine()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [teleprompter, isRunning, nextLine, prevLine])

  // Swipe up / scroll down = next line; the reverse goes back a line.
  const touchY = useRef<number | null>(null)
  const lastWheel = useRef(0)
  function onWheel(e: React.WheelEvent) {
    const now = performance.now()
    if (Math.abs(e.deltaY) < 10 || now - lastWheel.current < 350) return
    lastWheel.current = now
    if (e.deltaY > 0) nextLine()
    else prevLine()
  }
  function onTouchEnd(e: React.TouchEvent) {
    const startY = touchY.current
    touchY.current = null
    if (startY === null) return
    // Handled here; stop the browser's follow-up click from moving again.
    e.preventDefault()
    const dy = e.changedTouches[0].clientY - startY
    if (dy < -40) nextLine()
    else if (dy > 40) prevLine()
    else nextLine() // a tap
  }

  // Auto-start on mount
  useEffect(() => {
    if (!project) return
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null

  return (
    // `.scheme-dark` pins the dark token values on this subtree (T-10022). The
    // camera screens are dark in BOTH colour schemes — deliberately: this is a
    // full-bleed live preview, and light chrome over it is unreadable and washes
    // out the picture. That is why the chrome below can use the same tokens as
    // the rest of the app instead of ad-hoc blacks. Do not "fix" this to follow
    // the OS scheme. The Prompter itself is out of scope and untouched.
    <div className="scheme-dark fixed inset-0 bg-media overflow-hidden">
      {/* Full-screen camera preview, mirrored like a mirror. The recorded file
          is not mirrored — this is CSS on the preview only. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />

      {/* Take 1: tap, swipe or scroll anywhere to move the teleprompter. Sits
          under the prompter (which ignores pointers) and the Stop button. */}
      {teleprompter && isRunning && (
        <div
          data-testid="prompter-advance"
          aria-label={t.nextLine}
          role="button"
          tabIndex={-1}
          className="absolute inset-0 z-10"
          onClick={nextLine}
          onWheel={onWheel}
          onTouchStart={(e) => {
            touchY.current = e.touches[0].clientY
          }}
          onTouchEnd={onTouchEnd}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Brand markOnly inverse />
        <div className="flex items-center gap-2">
          <LangToggle inverse className="pointer-events-auto" />
          <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                state === "recording" ? "bg-bad ring-4 ring-bad/20" : "bg-white/45"
              }`}
            />
            {state === "recording" ? t.statusRecording : teleprompter ? t.statusTeleprompter : t.statusRehearsal}
          </span>
        </div>
      </div>

      {/* Karaoke subtitles overlaid on the video (upper third, near camera) */}
      {(state === "recording" || state === "countdown") && (
        <Prompter
          words={words}
          lines={lines}
          activeIdx={activeIdx}
          dir={dir}
          lang={uiLang}
          phase={state === "recording" ? "recording" : "countdown"}
          mode={teleprompter ? "teleprompter" : "karaoke"}
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
        <div className="absolute inset-x-0 z-20 flex justify-center safe-pos-4">
          <Button onClick={stop} variant="destructive" size="lg" className="gap-2 shadow-lg">
            <Square className="h-5 w-5 fill-current" />
            {t.stopRecording}
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
            {errorText(error, uiLang)}
          </p>
          <Button className="mt-3 w-full" onClick={() => router.push("/")}>
            {t.goBack}
          </Button>
        </div>
      )}
    </div>
  )
}

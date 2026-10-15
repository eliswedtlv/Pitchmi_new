"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { recorderConstraints, isPortraitViewport, streamOrientation } from "@/lib/recorderConstraints"
import { MAX_TAKE_S } from "@/lib/limits"

export type RecorderState =
  | "idle"
  | "requesting"
  | "countdown"
  | "recording"
  | "stopped"
  | "error"

/** Why recording ended: the user tapped Stop, or the hard cap fired (T-1172). */
export type StopReason = "user" | "limit"

interface UseRecorderOptions {
  maxDurationS?: number
  onStop?: (blob: Blob, reason: StopReason) => void
  graceAfterS?: number  // extra grace time after maxDurationS (for karaoke mode)
}

interface UseRecorderReturn {
  state: RecorderState
  countdown: number
  elapsed: number
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: () => Promise<void>
  stop: () => void
  error: string | null
  stopReason: StopReason | null
}

const COUNTDOWN_FROM = 3
// KP-F: how long a portrait phone may deliver landscape frames before the
// stream is re-requested once.
export const ORIENTATION_SETTLE_MS = 1500
const ORIENTATION_POLL_MS = 100

/**
 * Resolves true once the stream delivers portrait frames, false if it is still
 * landscape after timeoutMs. Unknown dimensions (no frames, no settings) are not
 * proof of a bad stream, so they resolve true at the deadline. Re-checks on the
 * preview's loadedmetadata/resize, on each decoded frame where supported, and
 * on a short poll.
 */
function waitForPortrait(
  video: HTMLVideoElement | null,
  stream: MediaStream,
  timeoutMs: number,
  isCancelled: () => boolean,
): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    const deadline = setTimeout(() => {
      finish(streamOrientation(video, stream) !== "landscape")
    }, timeoutMs)

    function finish(ok: boolean) {
      if (done) return
      done = true
      clearTimeout(deadline)
      if (pollTimer) clearTimeout(pollTimer)
      video?.removeEventListener("loadedmetadata", check)
      video?.removeEventListener("resize", check)
      resolve(ok)
    }

    function check() {
      if (done) return
      if (isCancelled()) return finish(true)
      if (streamOrientation(video, stream) === "portrait") finish(true)
    }

    function poll() {
      check()
      if (!done) pollTimer = setTimeout(poll, ORIENTATION_POLL_MS)
    }

    video?.addEventListener("loadedmetadata", check)
    video?.addEventListener("resize", check)
    if (video && typeof video.requestVideoFrameCallback === "function") {
      const onFrame = () => {
        check()
        if (!done) video.requestVideoFrameCallback(onFrame)
      }
      video.requestVideoFrameCallback(onFrame)
    }
    poll()
  })
}

function getMimeType(): string {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t
  }
  return "video/webm"
}

export function useRecorder({
  maxDurationS = MAX_TAKE_S,
  onStop,
  graceAfterS = 0,
}: UseRecorderOptions = {}): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle")
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stopReason, setStopReason] = useState<StopReason | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The 3-2-1 pre-roll handle. Without it, navigating away mid-countdown still
  // fires beginRecording on tracks cleanup() has already stopped.
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The reason must be readable synchronously inside recorder.onstop, which
  // fires long before a setState would land — the ref is the source of truth
  // and the state is only its mirror for consumers.
  const stopReasonRef = useRef<StopReason | null>(null)
  // Bumped by start() and cleanup() so an in-flight orientation check or
  // re-request from an abandoned session never touches the current one.
  const sessionRef = useRef(0)

  const cleanup = useCallback(() => {
    sessionRef.current += 1
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current)
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current)
    if (recorderRef.current && recorderRef.current.state === "recording") {
      // First writer wins: if the cap already fired, this is a late tap on a
      // recorder that has stopped, and it must not relabel an involuntary stop.
      if (stopReasonRef.current === null) {
        stopReasonRef.current = "user"
        setStopReason("user")
      }
      recorderRef.current.stop()
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setElapsed(0)
    stopReasonRef.current = null
    setStopReason(null)
    chunksRef.current = []
    setState("requesting")
    const session = ++sessionRef.current
    const portrait = isPortraitViewport()
    const constraints = { video: recorderConstraints(portrait), audio: true }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (e) {
      setError("Camera access denied. Please allow camera and microphone access.")
      setState("error")
      return
    }

    const attach = (s: MediaStream) => {
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.muted = true
        videoRef.current.play().catch(() => {})
      }
    }
    attach(stream)

    // KP-F: right after the permission prompt iOS Safari can hand a portrait
    // phone a landscape track that settles a moment later; recording it bakes
    // a sideways first take. Check during the countdown (no added delay when
    // the stream is already right), give it time to settle, re-request once,
    // then record regardless. Landscape viewports never wait.
    const isCancelled = () => sessionRef.current !== session
    const ready: Promise<MediaStream | null> = !portrait
      ? Promise.resolve(stream)
      : (async () => {
          const ok = await waitForPortrait(videoRef.current, stream, ORIENTATION_SETTLE_MS, isCancelled)
          if (ok || isCancelled()) return stream
          stream.getTracks().forEach((t) => t.stop())
          let retry: MediaStream
          try {
            retry = await navigator.mediaDevices.getUserMedia(constraints)
          } catch {
            if (!isCancelled()) {
              setError("Camera access denied. Please allow camera and microphone access.")
              setState("error")
              cleanup()
            }
            return null
          }
          if (isCancelled()) {
            retry.getTracks().forEach((t) => t.stop())
            return null
          }
          attach(retry)
          await waitForPortrait(videoRef.current, retry, ORIENTATION_SETTLE_MS, isCancelled)
          return retry
        })()

    setState("countdown")
    setCountdown(COUNTDOWN_FROM)

    let count = COUNTDOWN_FROM
    const tick = () => {
      count -= 1
      setCountdown(count)
      if (count > 0) {
        countdownTimerRef.current = setTimeout(tick, 1000)
      } else {
        countdownTimerRef.current = null
        ready.then((s) => {
          if (s && !isCancelled()) beginRecording(s)
        })
      }
    }
    countdownTimerRef.current = setTimeout(tick, 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Runs from inside the countdown timer, so anything thrown here is invisible
  // to React's error boundaries — an unsupported MediaRecorder used to leave the
  // screen frozen on "0" forever. Failures become the error state instead.
  function beginRecording(stream: MediaStream) {
    try {
      const mimeType = getMimeType()
      // ~1.5 Mbps video + 64 kbps audio keeps a 5-minute take (~58 MB) well
      // under the server's 200 MB upload cap (KP-B).
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 64_000,
      })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: getMimeType() })
        setState("stopped")
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        onStop?.(blob, stopReasonRef.current ?? "user")
      }

      recorder.start(250)
      startTimeRef.current = performance.now()
      setState("recording")

      const updateElapsed = () => {
        const secs = (performance.now() - startTimeRef.current) / 1000
        setElapsed(secs)
        rafRef.current = requestAnimationFrame(updateElapsed)
      }
      rafRef.current = requestAnimationFrame(updateElapsed)

      autoStopTimerRef.current = setTimeout(
        () => {
          if (recorderRef.current?.state === "recording") {
            if (stopReasonRef.current === null) {
              stopReasonRef.current = "limit"
              setStopReason("limit")
            }
            recorderRef.current.stop()
          }
        },
        (maxDurationS + graceAfterS) * 1000,
      )
    } catch {
      setError("Recording isn't supported on this browser. Please try Chrome or Safari.")
      setState("error")
      cleanup()
    }
  }

  return { state, countdown, elapsed, videoRef, start, stop, error, stopReason }
}

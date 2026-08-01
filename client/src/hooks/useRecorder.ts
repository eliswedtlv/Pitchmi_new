"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { recorderConstraints, isPortraitViewport } from "@/lib/recorderConstraints"
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

  const cleanup = useCallback(() => {
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

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: recorderConstraints(isPortraitViewport()),
        audio: true,
      })
    } catch (e) {
      setError("Camera access denied. Please allow camera and microphone access.")
      setState("error")
      return
    }

    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.muted = true
      videoRef.current.play().catch(() => {})
    }

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
        beginRecording(stream)
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
      const recorder = new MediaRecorder(stream, { mimeType })
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

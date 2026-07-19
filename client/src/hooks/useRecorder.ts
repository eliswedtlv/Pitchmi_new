"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { recorderConstraints, isPortraitViewport } from "@/lib/recorderConstraints"

export type RecorderState =
  | "idle"
  | "requesting"
  | "countdown"
  | "recording"
  | "stopped"
  | "error"

interface UseRecorderOptions {
  maxDurationS?: number
  onStop?: (blob: Blob) => void
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
  maxDurationS = 60,
  onStop,
  graceAfterS = 0,
}: UseRecorderOptions = {}): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle")
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current)
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop()
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setElapsed(0)
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
        setTimeout(tick, 1000)
      } else {
        beginRecording(stream)
      }
    }
    setTimeout(tick, 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function beginRecording(stream: MediaStream) {
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
      onStop?.(blob)
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
          recorderRef.current.stop()
        }
      },
      (maxDurationS + graceAfterS) * 1000,
    )
  }

  return { state, countdown, elapsed, videoRef, start, stop, error }
}

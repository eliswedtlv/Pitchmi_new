"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { KaraokeWord } from "@/lib/clock"
import { firstWordOfLine, matchForward } from "@/lib/teleprompter"

// The Web Speech API is not in TypeScript's DOM lib. Only what we use.
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

// Errors after which recognition is not coming back this take: manual only.
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"])

/**
 * The recogniser, or null where we must not run it. On iOS and Android the
 * recogniser takes the microphone away from the MediaRecorder that is filming
 * the take (silent or broken audio), and the take matters more than the
 * follow — so there it's manual advance only.
 */
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios || /Android/i.test(ua)) return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function split(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/**
 * Take-1 teleprompter driver (KP-B). Returns the active word index (-1 = none
 * read yet) and manual line steps. While `running`, speech recognition (where
 * allowed) moves the active word forward as the script is read; it never
 * blocks or moves backwards, and any failure just leaves manual advance.
 */
export function useSpeechFollow(words: KaraokeWord[], running: boolean, lang: string) {
  const [activeIdx, setActiveIdx] = useState(-1)
  const activeRef = useRef(-1)
  // Where final (no longer revisable) results have taken us.
  const committedRef = useRef(-1)

  const moveTo = useCallback((idx: number) => {
    activeRef.current = idx
    committedRef.current = idx
    setActiveIdx(idx)
  }, [])

  useEffect(() => {
    const Ctor = running ? recognitionCtor() : null
    if (!Ctor) return

    const script = words.map((w) => w.w)
    let stopped = false
    let rec: Recognition
    try {
      rec = new Ctor()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
    } catch {
      return
    }

    rec.onresult = (e) => {
      let interim: string[] = []
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const heard = split(r[0].transcript)
        if (r.isFinal) {
          committedRef.current = Math.max(
            committedRef.current,
            matchForward(script, committedRef.current, heard),
          )
        } else {
          interim = interim.concat(heard)
        }
      }
      const next = Math.max(activeRef.current, matchForward(script, committedRef.current, interim))
      if (next !== activeRef.current) {
        activeRef.current = next
        setActiveIdx(next)
      }
    }
    rec.onerror = (e) => {
      if (FATAL_ERRORS.has(e.error)) stopped = true
    }
    // Chrome ends a "continuous" session on silence or after ~a minute.
    rec.onend = () => {
      if (stopped) return
      try {
        rec.start()
      } catch {
        stopped = true
      }
    }

    try {
      rec.start()
    } catch {
      return
    }

    return () => {
      stopped = true
      rec.onresult = null
      rec.onend = null
      try {
        rec.abort()
      } catch {
        /* already gone */
      }
    }
  }, [running, words, lang])

  const currentLine = () => (activeRef.current >= 0 ? words[activeRef.current]?.line ?? 0 : 0)

  const nextLine = useCallback(() => {
    const idx = firstWordOfLine(words, currentLine() + 1)
    if (idx >= 0) moveTo(idx)
  }, [words, moveTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevLine = useCallback(() => {
    const line = currentLine()
    moveTo(line > 0 ? firstWordOfLine(words, line - 1) : -1)
  }, [words, moveTo]) // eslint-disable-line react-hooks/exhaustive-deps

  return { activeIdx, nextLine, prevLine }
}

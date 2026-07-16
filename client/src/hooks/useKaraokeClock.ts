"use client"

import { useEffect, useRef, useState } from "react"
import { activeWordIndex, type KaraokeWord } from "@/lib/clock"

/**
 * Drives the active word index via requestAnimationFrame + performance.now().
 * NOT setInterval — no drift.
 *
 * @param words - the karaoke path words
 * @param running - true while the take is recording/playing
 * @returns the current active word index (-1 = not started)
 */
export function useKaraokeClock(words: KaraokeWord[], running: boolean): number {
  const [index, setIndex] = useState(-1)
  const startedAtRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) {
      startedAtRef.current = null
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setIndex(-1)
      return
    }

    startedAtRef.current = performance.now()

    const tick = () => {
      if (startedAtRef.current === null) return
      const elapsed = (performance.now() - startedAtRef.current) / 1000
      const newIndex = activeWordIndex(words, elapsed)
      setIndex(newIndex)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [running, words])

  return index
}

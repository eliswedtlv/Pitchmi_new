"use client"

import { useEffect, useState } from "react"
import type { KaraokeWord } from "@/lib/clock"
import { prompterHint } from "@/lib/strings"

interface PrompterLine {
  index: number
  text: string
}

interface PrompterProps {
  words: KaraokeWord[]
  lines: PrompterLine[]
  activeIdx: number
  dir: "ltr" | "rtl"
  lang?: string | null
  phase?: "countdown" | "recording"
}

// Uniform layout height per line (rem). The active line is enlarged *visually*
// only, so every row occupies the same vertical space — that keeps the reading
// position fixed while the column scrolls under it.
const LINE_H_REM = 4.5
const HINT_KEY = "pitchmi:prompterHintSeen"

function hintSeen(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(HINT_KEY) === "1"
  } catch {
    return false
  }
}
function markHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1")
  } catch {
    /* private mode — ignore */
  }
}

/**
 * Broadcast-style karaoke teleprompter (T-1162 §B), rendered as a scrim overlay
 * in the UPPER third of the frame so the reader's eyes stay near the front
 * camera. Exactly three lines are legible at a time — previous (dim), active
 * (large, pinned at a fixed reading line), next (medium). The whole column
 * translates smoothly under the fixed reading line, so the text moves while the
 * reading position never does.
 *
 * RTL correctness: the container and each line carry `dir`, and every word is a
 * `<bdi>` (bidi isolate) so per-word highlighting can never scramble logical
 * order — including mixed Latin/number tokens inside a Hebrew sentence.
 */
export function Prompter({ words, lines, activeIdx, dir, lang, phase = "countdown" }: PrompterProps) {
  const activeLine = activeIdx >= 0 && words[activeIdx] ? words[activeIdx].line : 0
  const align = dir === "rtl" ? "justify-end text-right" : "justify-start text-left"

  // One-time first-use hint, dismissed once recording begins.
  const [seenAtMount] = useState(hintSeen)
  useEffect(() => {
    if (phase !== "countdown") markHintSeen()
  }, [phase])
  const showHint = !seenAtMount && phase === "countdown"

  // Keep the active row at a fixed reading line (one row down from the top of
  // the viewport, so the previous line peeks above it).
  const offsetRem = LINE_H_REM - activeLine * LINE_H_REM

  return (
    <div
      dir={dir}
      data-testid="prompter"
      className="pointer-events-none absolute inset-x-0 top-0 pt-[max(env(safe-area-inset-top),1rem)] bg-gradient-to-b from-black/85 via-black/70 to-transparent"
    >
      <div className="relative overflow-hidden" style={{ height: `${LINE_H_REM * 3}rem` }}>
        <div
          className="absolute inset-x-0 transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: `translateY(${offsetRem}rem)` }}
        >
          {lines.map((line, li) => {
            const rel = li - activeLine
            const role = rel === 0 ? "active" : rel === -1 ? "previous" : rel === 1 ? "next" : "hidden"
            const opacity = rel === 0 ? 1 : rel === -1 ? 0.5 : rel === 1 ? 0.7 : 0
            const lineWords = words.filter((w) => w.line === li)
            return (
              <div
                key={li}
                dir={dir}
                data-role={role}
                data-testid={role === "active" ? "active-line" : undefined}
                style={{ height: `${LINE_H_REM}rem`, opacity }}
                className={`mx-auto flex max-w-[90%] flex-wrap items-center gap-x-2 leading-tight transition-opacity duration-300 ${align}`}
              >
                {lineWords.map((word) => {
                  const wordIdx = words.indexOf(word)
                  const isActiveWord = wordIdx === activeIdx
                  const isPast = wordIdx < activeIdx
                  const sizeClass =
                    role === "active"
                      ? "text-[clamp(26px,8vw,44px)] font-bold [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]"
                      : "text-xl sm:text-2xl font-semibold"
                  const colorClass =
                    role === "active"
                      ? isActiveWord
                        ? "text-green-400"
                        : isPast
                        ? "text-white/60"
                        : "text-white"
                      : "text-white"
                  return (
                    <bdi
                      key={wordIdx}
                      className={`inline-block transition-colors duration-100 ${sizeClass} ${colorClass}`}
                    >
                      {word.w}
                    </bdi>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {showHint && (
        <div
          data-testid="prompter-hint"
          className="pointer-events-none mx-auto mt-2 max-w-[90%] text-center text-sm font-medium text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]"
        >
          {prompterHint(lang)}
        </div>
      )}
    </div>
  )
}

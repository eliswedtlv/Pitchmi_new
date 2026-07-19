"use client"

import { useEffect, useRef } from "react"
import type { KaraokeWord } from "@/lib/clock"

interface PrompterLine {
  index: number
  text: string
}

interface PrompterProps {
  words: KaraokeWord[]
  lines: PrompterLine[]
  activeIdx: number
  dir: "ltr" | "rtl"
}

/**
 * Karaoke teleprompter rendered as a scrim OVERLAY on the camera preview
 * (bottom third of the frame). Large high-contrast text, current word
 * highlighted, ~3 lines visible with the active line auto-scrolled to center.
 *
 * RTL correctness: the container and each line carry `dir` so Hebrew/Arabic
 * lay out right-to-left, and every word is wrapped in a `<bdi>` (bidi isolate)
 * so per-word highlighting can never scramble logical order — including mixed
 * tokens (Latin brand names, numbers) inside a Hebrew sentence.
 */
export function Prompter({ words, lines, activeIdx, dir }: PrompterProps) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const align = dir === "rtl" ? "text-right" : "text-left"

  // Keep the active line centered in the overlay window.
  useEffect(() => {
    if (activeIdx < 0 || !words[activeIdx]) return
    const el = lineRefs.current[words[activeIdx].line]
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" })
  }, [activeIdx, words])

  return (
    <div
      dir={dir}
      data-testid="prompter"
      className="absolute inset-x-0 bottom-0 h-2/5 overflow-hidden bg-gradient-to-t from-black/85 via-black/70 to-transparent"
    >
      <div className={`h-full overflow-hidden px-6 py-8 flex flex-col justify-center gap-4 ${align}`}>
        {lines.map((line, li) => {
          const lineWords = words.filter((w) => w.line === li)
          return (
            <div
              key={li}
              dir={dir}
              ref={(el) => {
                lineRefs.current[li] = el
              }}
              className="text-2xl sm:text-3xl font-semibold leading-snug"
            >
              {lineWords.map((word, wi) => {
                const wordIdx = words.indexOf(word)
                const isPast = wordIdx < activeIdx
                const isActive = wordIdx === activeIdx
                return (
                  <bdi
                    key={wi}
                    className={`inline-block mx-0.5 transition-all duration-100 ${
                      isActive
                        ? "text-white scale-110 font-bold drop-shadow"
                        : isPast
                        ? "text-white/40"
                        : "text-white/75"
                    }`}
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
  )
}

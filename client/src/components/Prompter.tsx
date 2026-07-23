"use client"

import { Fragment, useEffect, useState } from "react"
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

// Strong-directional character ranges. A token is "opposite" to its line only
// when it carries a strong character of the other direction — a Latin brand name
// inside a Hebrew line, or a Hebrew word inside an English line. Those, and only
// those, get bidi isolation so their internal order (and trailing punctuation)
// can't leak into the surrounding run.
const RTL_STRONG = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_STRONG = /[A-Za-zÀ-ɏ]/

function opposesLine(text: string, dir: "ltr" | "rtl"): boolean {
  return dir === "rtl" ? LTR_STRONG.test(text) : RTL_STRONG.test(text)
}

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
 * Broadcast-style karaoke teleprompter (T-1162 §B), rendered as a scrim overlay.
 * On portrait phones it is vertically centered (reading line at screen centre);
 * on landscape/desktop, where the webcam sits above the screen, it stays in the
 * upper third so the reader's eyes stay near the camera (T-1167 §B). Exactly
 * three lines are legible at a time — previous (dim), active
 * (large, pinned at a fixed reading line), next (medium). The whole column
 * translates smoothly under the fixed reading line, so the text moves while the
 * reading position never does.
 *
 * RTL correctness (T-1163 §A): each line is ONE continuous inline text run —
 * plain `<span>`s separated by real spaces, `dir` + `text-align: start` on the
 * run — so the Unicode bidi algorithm reorders the whole line as text. Earlier
 * takes laid each word out as its own flex/inline-block box (and wrapped every
 * word in `<bdi>`), which pins boxes in DOM order regardless of `dir` and
 * scrambled Hebrew. Highlighting is colour-only, which never affects order. Only
 * tokens whose script opposes the line (Latin brand names inside Hebrew) get a
 * `<bdi>` isolate — nothing else.
 */
export function Prompter({ words, lines, activeIdx, dir, lang, phase = "countdown" }: PrompterProps) {
  const activeLine = activeIdx >= 0 && words[activeIdx] ? words[activeIdx].line : 0

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
      // Portrait phones: vertically centered so the reading line sits at screen
      // centre while the eyes stay near the front camera, with a soft center-band
      // scrim (transparent top and bottom) so the face shows above and below.
      // Landscape/desktop (webcam above the screen): keep it in the top third.
      className="pointer-events-none absolute inset-x-0 top-0 portrait:top-1/2 portrait:-translate-y-1/2 landscape:pt-[max(env(safe-area-inset-top),1rem)] portrait:py-6 bg-gradient-to-b from-black/85 portrait:from-transparent via-black/70 portrait:via-black/75 to-transparent"
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
            // Belt-and-suspenders (T-1164): if the passed dir is wrong for this
            // line (e.g. language missing upstream), most tokens would "oppose"
            // it and every word would get bidi-isolated — reversing the line.
            // When a majority oppose, flip the line's dir instead, which leaves
            // it as one clean continuous run with no per-word isolation.
            const opposeCount = lineWords.filter((w) => opposesLine(w.w, dir)).length
            const lineDir: "ltr" | "rtl" =
              lineWords.length > 0 && opposeCount > lineWords.length / 2
                ? dir === "rtl"
                  ? "ltr"
                  : "rtl"
                : dir
            // Type is a LINE-level property (never per word) so highlighting can't
            // change any word's layout box.
            const sizeClass =
              role === "active"
                ? "text-[clamp(26px,8vw,44px)] font-bold [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]"
                : "text-xl sm:text-2xl font-semibold"
            return (
              <div
                key={li}
                dir={lineDir}
                data-role={role}
                style={{ height: `${LINE_H_REM}rem`, opacity }}
                className="mx-auto flex max-w-[90%] items-center leading-tight transition-opacity duration-300"
              >
                {/* One continuous inline text run — the bidi algorithm reorders
                    the whole line. text-align:start = right for RTL, left for LTR. */}
                <p
                  dir={lineDir}
                  data-testid={role === "active" ? "active-line" : undefined}
                  className={`w-full ${sizeClass}`}
                  style={{ textAlign: "start" }}
                >
                  {lineWords.map((word, wi) => {
                    const wordIdx = words.indexOf(word)
                    const isActiveWord = wordIdx === activeIdx
                    const isPast = wordIdx < activeIdx
                    const colorClass =
                      role === "active"
                        ? isActiveWord
                          ? "text-green-400"
                          : isPast
                          ? "text-white/60"
                          : "text-white"
                        : "text-white"
                    const Tag = opposesLine(word.w, lineDir) ? "bdi" : "span"
                    return (
                      <Fragment key={wordIdx}>
                        {wi > 0 ? " " : null}
                        <Tag data-widx={wordIdx} className={`transition-colors duration-100 ${colorClass}`}>
                          {word.w}
                        </Tag>
                      </Fragment>
                    )
                  })}
                </p>
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

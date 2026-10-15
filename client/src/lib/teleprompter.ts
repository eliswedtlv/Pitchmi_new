/**
 * Take-1 teleprompter (KP-B). There is no rhythm yet, so the script is shown in
 * the prompter look and follows the reader: speech recognition matches heard
 * words forward against the script, and taps/swipes/keys move it by hand.
 * Pure logic; the hook lives in src/hooks/useSpeechFollow.ts.
 */

import type { KaraokeWord } from "@/lib/clock"

export interface TeleprompterScript {
  /** Timings are all 0 — nothing here is clocked. Only `w` and `line` matter. */
  words: KaraokeWord[]
  lines: { index: number; text: string }[]
}

// Same caps as the server's line grouper (subtitles.js), so take 1 reads in
// the same short broadcast lines as the karaoke takes after it.
const LINE_MAX_CHARS = 32
const LINE_MAX_WORDS = 6
const SENTENCE_END = /[.!?…。！？]["'”’)]*$/

/** Splits the typed script into short prompter lines. Breaks after a sentence
 *  end, at a newline, or at the char/word cap. */
export function buildTeleprompter(text: string): TeleprompterScript {
  const words: KaraokeWord[] = []
  const lines: { index: number; text: string }[] = []
  let current: string[] = []

  const flush = () => {
    if (!current.length) return
    const index = lines.length
    for (const w of current) words.push({ w, t_start: 0, t_end: 0, line: index })
    lines.push({ index, text: current.join(" ") })
    current = []
  }

  for (const paragraph of text.split(/\n+/)) {
    for (const w of paragraph.split(/\s+/).filter(Boolean)) {
      const chars = [...current, w].join(" ").length
      if (current.length && (chars > LINE_MAX_CHARS || current.length >= LINE_MAX_WORDS)) flush()
      current.push(w)
      if (SENTENCE_END.test(w)) flush()
    }
    flush()
  }
  return { words, lines }
}

/** Lowercase, strip punctuation and Hebrew niqqud/cantillation. */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-֑ͯ-ׇ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/** Tolerant match: recognisers mangle endings, prefixes and spelling. */
export function wordsMatch(scriptWord: string, heard: string): boolean {
  const a = normalizeWord(scriptWord)
  const b = normalizeWord(heard)
  if (!a || !b) return false
  if (a === b) return true
  const shorter = Math.min(a.length, b.length)
  if (shorter >= 3 && (a.startsWith(b) || b.startsWith(a))) return true
  const longer = Math.max(a.length, b.length)
  if (longer < 4) return false
  return editDistance(a, b) <= (longer >= 7 ? 2 : 1)
}

/** How far ahead of the current word a heard word may land (skipped words). */
export const LOOKAHEAD = 6

/**
 * Moves the active word forward through the heard words. `active` is the index
 * of the last word read (-1 = none yet). Each heard word is searched for in the
 * next {@link LOOKAHEAD} script words; a hit moves the active word there,
 * skipping anything in between. Never moves backwards; unmatched words are
 * ignored.
 */
export function matchForward(script: string[], active: number, heard: string[]): number {
  let pos = active
  for (const h of heard) {
    const end = Math.min(script.length, pos + 1 + LOOKAHEAD)
    for (let j = pos + 1; j < end; j++) {
      if (wordsMatch(script[j], h)) {
        pos = j
        break
      }
    }
  }
  return pos
}

/** Index of the first word on `line`, or -1 when the line doesn't exist. */
export function firstWordOfLine(words: KaraokeWord[], line: number): number {
  return words.findIndex((w) => w.line === line)
}

/** Speech-recognition locale for the script: Hebrew for RTL, else the browser's. */
export function recognitionLang(dir: "ltr" | "rtl", navigatorLang?: string): string {
  if (dir === "rtl") return "he-IL"
  if (navigatorLang && !/^(he|iw|ar|fa|ur)\b/i.test(navigatorLang)) return navigatorLang
  return "en-US"
}

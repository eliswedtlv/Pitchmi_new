/**
 * Karaoke clock — pure logic for word-index tracking.
 * The hook lives in src/hooks/useKaraokeClock.ts.
 */

export interface KaraokeWord {
  w: string
  t_start: number
  t_end: number
  line: number
}

/**
 * Returns the index of the current active word:
 * the last word whose t_start <= tSeconds.
 * Returns -1 if tSeconds is before the first word.
 */
export function activeWordIndex(words: KaraokeWord[], tSeconds: number): number {
  let result = -1
  for (let i = 0; i < words.length; i++) {
    if (words[i].t_start <= tSeconds) {
      result = i
    } else {
      break
    }
  }
  return result
}

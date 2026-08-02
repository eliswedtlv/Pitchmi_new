/**
 * Reading-length estimate for the script screen (T-10018).
 *
 * This is a HINT, nothing more. The real gate is the 30-second cap the server
 * enforces on the take that actually gets recorded — a fixed words-per-minute
 * figure cannot know how fast this particular person talks, and it is wrong by
 * construction for a language whose words are a different length. The screen
 * says so in as many words; nothing here ever blocks a recording.
 */

export const WORDS_PER_MINUTE = 150

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function estimateSeconds(text: string): number {
  return (countWords(text) / WORDS_PER_MINUTE) * 60
}

/**
 * Split the raw text at the point where the running estimate passes `maxS`, so
 * the tail can be visually marked as the part that probably has to go. Eli's
 * ruling: flag it, the user cuts — the app never rewrites their words.
 *
 * `head + tail` is always exactly the input, whitespace included, because the
 * two halves are re-rendered on top of the textarea and must line up with it
 * character for character.
 */
export function splitAtSeconds(text: string, maxS: number): { head: string; tail: string } {
  const maxWords = Math.floor((maxS * WORDS_PER_MINUTE) / 60)
  if (maxWords <= 0) return { head: "", tail: text }

  let seen = 0
  for (const match of text.matchAll(/\S+/g)) {
    seen += 1
    if (seen > maxWords && match.index !== undefined) {
      return { head: text.slice(0, match.index), tail: text.slice(match.index) }
    }
  }
  return { head: text, tail: "" }
}

'use strict'

// Subtitle construction (T-1169). The zero-edit MVP removed the transcript editor
// and the whole re-pacing engine: subtitles are simply the user's spoken words
// (fillers already stripped) shown at their EXACT recorded timestamps. There is
// no rate synthesis, no anchoring, no reflow — each surviving word keeps the
// start/end Scribe measured, and a dropped filler just becomes a wider gap
// between its neighbours.
//
//   buildSubtitles(words) -> { words: [{ w, t_start, t_end, line }], lines, total_s }
//
// `words` is the filler-stripped Scribe list: [{ w, start, end }]. Pure, no I/O.
// The only thing carried over from the old path.js is the broadcast-teleprompter
// line grouper below.

const { normalize, charLen, segmentWords } = require('./text')

// Broadcast-teleprompter line construction (T-1162 §B): short lines that break
// at natural phrase boundaries. Character-based caps so Hebrew/RTL behave; CJK
// counts by grapheme (charLen already does).
const LINE_MAX_CHARS = 32
const LINE_MAX_WORDS = 6

// Sentence- vs clause-level punctuation, detected on each word's TRAILING
// punctuation (Scribe attaches it to the word surface). Sentence enders break
// hardest; commas/semicolons/colons are clause breaks.
const SENTENCE_PUNCT = /[.!?…。！？]/
const CLAUSE_PUNCT = /[.,;:!?…，、！？]/
const TRAILING_PUNCT = /[.,;:!?…。，、！？]+$/u

// Clause conjunctions / prepositions we prefer to break *before* (they open a
// phrase, so they read better at the start of a line). EN + HE minimum.
const CONJUNCTIONS = new Set([
  'and', 'but', 'so', 'or', 'nor', 'yet', 'because', 'although', 'though',
  'while', 'whereas', 'if', 'unless', 'since', 'that', 'which', 'who', 'when',
  'אבל', 'כי', 'אז', 'אם', 'אך', 'אלא', 'כאשר', 'ש', 'ו'
])
const PREPOSITIONS = new Set([
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as', 'into',
  'onto', 'about', 'over', 'under', 'between', 'through', 'during', 'after',
  'before', 'על', 'אל', 'עם', 'של', 'את', 'מן', 'בין', 'אצל'
])

function isNumeric (w) {
  return /^[\p{N}.,:/-]+$/u.test(String(w)) && /\p{N}/u.test(String(w))
}

// A number must never be split from its following unit ("10 kg", "3 pm").
function gluedAfter (tokens, i) {
  return i + 1 < tokens.length && isNumeric(tokens[i].w) && !tokens[i].clauseBreak
}

// Priority of ending a line *after* token i. Higher = stronger phrase boundary:
// sentence punctuation > comma/clause punctuation > before a conjunction >
// before a preposition.
function breakAfterPriority (tokens, i) {
  if (tokens[i].sentenceEnd) return 4
  if (tokens[i].clauseBreak) return 3
  const next = tokens[i + 1]
  if (!next) return 0
  const nn = normalize(next.w)
  if (CONJUNCTIONS.has(nn)) return 2
  if (PREPOSITIONS.has(nn)) return 1
  return 0
}

// Pick the inclusive end index of the line starting at `start`. Greedy fill up
// to the char/word caps, but prefer to end at the strongest phrase boundary
// seen so far; a sentence end is taken immediately.
function chooseLineEnd (tokens, start, n) {
  let chars = 0
  let best = -1
  let bestPri = 0
  let i = start
  for (; i < n; i++) {
    chars += charLen(tokens[i].w) + (i > start ? 1 : 0)
    const words = i - start + 1
    if (i > start && (chars > LINE_MAX_CHARS || words > LINE_MAX_WORDS)) break
    if (tokens[i].sentenceEnd) return i
    const pri = breakAfterPriority(tokens, i)
    // >= so ties resolve to the later (fuller) line.
    if (pri >= bestPri && pri > 0 && !gluedAfter(tokens, i)) {
      best = i
      bestPri = pri
    }
  }
  if (best >= start) return best
  // No usable boundary — fall back to the cap, never splitting a number+unit.
  let end = Math.max(Math.min(i, n) - 1, start)
  while (end < n - 1 && gluedAfter(tokens, end)) end++
  return end
}

function breakIntoLines (tokens) {
  const n = tokens.length
  if (!n) return []
  const groups = []
  let start = 0
  while (start < n) {
    const end = chooseLineEnd(tokens, start, n)
    groups.push(tokens.slice(start, end + 1))
    start = end + 1
  }
  // Never leave a one-word orphan line — rebalance into a neighbour.
  for (let g = 0; g < groups.length && groups.length > 1; g++) {
    if (groups[g].length !== 1) continue
    if (g > 0) {
      groups[g - 1].push(...groups[g])
      groups.splice(g, 1)
      g -= 2
    } else {
      groups[1].unshift(...groups[0])
      groups.splice(0, 1)
      g -= 1
    }
  }
  const lines = []
  groups.forEach((grp, index) => {
    for (const t of grp) t.line = index
    lines.push({
      index,
      text: grp.map(t => t.w).join(' '),
      t_start: round3(grp[0].t_start),
      t_end: round3(grp[grp.length - 1].t_end)
    })
  })
  return lines
}

// Build the karaoke subtitle structure straight from the filler-stripped Scribe
// words. Each surviving word keeps its exact start/end — no rate synthesis, no
// reflow — and a dropped filler simply widens the gap to its neighbour.
function buildSubtitles (words) {
  const clean = (words || [])
    .map(w => ({
      raw: String(w && w.w != null ? w.w : ''),
      t_start: Number(w && w.start),
      t_end: Number(w && w.end)
    }))
    .filter(w => w.raw.trim() && Number.isFinite(w.t_start) && Number.isFinite(w.t_end))

  if (!clean.length) return { words: [], lines: [], total_s: 0 }

  const tokens = clean.map(w => {
    const trail = (w.raw.match(TRAILING_PUNCT) || [''])[0]
    const surface = w.raw.replace(TRAILING_PUNCT, '').trim() || w.raw.trim()
    return {
      w: surface,
      clauseBreak: CLAUSE_PUNCT.test(trail),
      sentenceEnd: SENTENCE_PUNCT.test(trail),
      t_start: w.t_start,
      t_end: w.t_end,
      line: 0
    }
  })

  const lines = breakIntoLines(tokens)
  const outWords = tokens.map(t => ({
    w: t.w,
    t_start: round3(t.t_start),
    t_end: round3(t.t_end),
    line: t.line
  }))
  const totalS = round1(outWords[outWords.length - 1].t_end)
  return { words: outWords, lines, total_s: totalS }
}

// Tokenize a TYPED script the way buildSubtitles tokenizes spoken words
// (T-10018): surface with trailing punctuation stripped, plus the clause /
// sentence flags the line grouper reads. `segmentWords` already reports those
// flags for typed text, so this only has to match buildSubtitles' surface
// handling — that is what keeps the seed path and the re-timed path grouped
// and worded identically, so the prompter text never reflows between takes.
function scriptTokens (text) {
  return segmentWords(text)
    .map(t => {
      const raw = String(t.w)
      return {
        w: raw.replace(TRAILING_PUNCT, '').trim() || raw.trim(),
        clauseBreak: !!t.clauseBreak,
        sentenceEnd: !!t.sentenceEnd
      }
    })
    .filter(t => t.w)
}

function round3 (n) {
  return Math.round(n * 1000) / 1000
}

function round1 (n) {
  return Math.round(n * 10) / 10
}

module.exports = { buildSubtitles, breakIntoLines, scriptTokens }

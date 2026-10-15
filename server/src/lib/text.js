'use strict'

// Language-aware text utilities shared by the path alignment algorithm.
// Everything here is pure and dependency-free so it is trivial to unit test.
// The filler list lives in ./fillers.js (single source of truth) — importing it
// here would be circular (fillers.js needs normalize), so consumers pull
// isFiller straight from ./fillers.

// Normalize a token for comparison: NFKC, lowercase, strip everything that is
// not a letter or number (punctuation, spaces). Returns '' for punctuation.
// Hebrew final letters fold to their regular form, so a speech-to-text
// spelling and the typed script compare equal (ך→כ, ם→מ, ן→נ, ף→פ, ץ→צ).
const HEBREW_FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' }

function normalize (token) {
  if (!token) return ''
  return token.normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/[ךםןףץ]/g, c => HEBREW_FINALS[c])
}

// Hebrew one-letter prefixes (and, the, in, to, from, that, as) that a
// transcript often attaches or drops differently from the typed script.
const HEBREW_PREFIX = /^[והבלמשכ]/

// Levenshtein distance with an early exit once it exceeds `max`.
function editDistance (a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// Two normalized tokens count as the same spoken word when they are equal, or
// close enough that the difference is spelling, not a different word: one edit
// for words of 4+ letters (two for 8+), or a single Hebrew prefix letter.
function similarWords (a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const len = Math.min(a.length, b.length)
  if (len >= 2 && HEBREW_PREFIX.test(a) && a.slice(1) === b) return true
  if (len >= 2 && HEBREW_PREFIX.test(b) && b.slice(1) === a) return true
  if (len < 4) return false
  return editDistance(a, b, len >= 8 ? 2 : 1) <= (len >= 8 ? 2 : 1)
}

// Number of Unicode code points (robust char count across scripts/emoji).
function charLen (token) {
  return [...String(token)].length
}

function hasCjk (text) {
  return /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/.test(text)
}

// Tokenize into surface word-forms, language-aware. Uses Intl.Segmenter word
// segmentation for spaced languages; for CJK / no-space scripts it falls back
// to grapheme clusters so each character becomes a token.
function tokenize (text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  const hasSpaces = /\s/.test(trimmed)
  if (hasCjk(trimmed) && !hasSpaces) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...seg.segment(trimmed)].map(s => s.segment).filter(g => /\S/.test(g))
  }
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' })
  return [...seg.segment(trimmed)].filter(s => s.isWordLike).map(s => s.segment)
}

// Like tokenize, but also records the punctuation that immediately follows each
// word (used for teleprompter line breaks). Returns
// [{ w, clauseBreak, sentenceEnd }] where sentenceEnd marks . ! ? … and
// clauseBreak marks any clause-level punctuation (sentence-enders + , ; :).
const SENTENCE_PUNCT = /[.!?…。！？\n]/
const CLAUSE_PUNCT = /[.,;:!?…。，、！？\n]/
function segmentWords (text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  const cjkNoSpace = hasCjk(trimmed) && !/\s/.test(trimmed)
  if (cjkNoSpace) {
    return tokenize(trimmed).map(w => ({ w, clauseBreak: false, sentenceEnd: false }))
  }
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' })
  const out = []
  for (const part of seg.segment(trimmed)) {
    if (part.isWordLike) {
      out.push({ w: part.segment, clauseBreak: false, sentenceEnd: false })
    } else if (out.length && CLAUSE_PUNCT.test(part.segment)) {
      const last = out[out.length - 1]
      last.clauseBreak = true
      if (SENTENCE_PUNCT.test(part.segment)) last.sentenceEnd = true
    }
  }
  return out
}

module.exports = { normalize, similarWords, charLen, tokenize, segmentWords, hasCjk }

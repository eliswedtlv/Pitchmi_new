'use strict'

// Language-aware text utilities shared by the path and score algorithms.
// Everything here is pure and dependency-free so it is trivial to unit test.

// Common filler sounds across a few languages. Fillers never count as a
// transcript match — they are always insertions (see score.js).
const FILLERS = new Set([
  'um', 'umm', 'uh', 'uhh', 'uhm', 'uhmm', 'er', 'err', 'erm', 'ah', 'ahh',
  'eh', 'ehm', 'hm', 'hmm', 'mm', 'mmm', 'like', 'you know',
  // Hebrew
  'אה', 'אהה', 'אמ', 'אמם', 'עמ', 'המ',
  // Spanish / others
  'este', 'pues', 'eee', 'euh'
])

// Normalize a token for comparison: NFKC, lowercase, strip everything that is
// not a letter or number (punctuation, spaces). Returns '' for punctuation.
function normalize (token) {
  if (!token) return ''
  return token.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

// Number of Unicode code points (robust char count across scripts/emoji).
function charLen (token) {
  return [...String(token)].length
}

function isFiller (token) {
  return FILLERS.has(normalize(token))
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

// Like tokenize, but also records whether each word is immediately followed by
// clause punctuation (used for teleprompter line breaks). Returns
// [{ w, clauseBreak }].
function segmentWords (text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  const cjkNoSpace = hasCjk(trimmed) && !/\s/.test(trimmed)
  if (cjkNoSpace) {
    return tokenize(trimmed).map(w => ({ w, clauseBreak: false }))
  }
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' })
  const out = []
  for (const part of seg.segment(trimmed)) {
    if (part.isWordLike) {
      out.push({ w: part.segment, clauseBreak: false })
    } else if (out.length && /[.,;:!?…。，、！？\n]/.test(part.segment)) {
      out[out.length - 1].clauseBreak = true
    }
  }
  return out
}

module.exports = { normalize, charLen, isFiller, tokenize, segmentWords, hasCjk, FILLERS }

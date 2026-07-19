'use strict'

// Single source of truth for disfluency / filler tokens (T-1162 §C).
// Used by BOTH the transcribe route (strip fillers from the editable script)
// and score.js (fillers never count as a transcript match — they are always
// insertions). Keep this list — nothing else — as the canonical filler set.
//
// Deliberately excludes real words like "like" / "you know": those are only
// treated as fillers when the STT provider explicitly tags them as
// disfluencies (see stripFillers), never by list — we must not strip real words.

const { normalize } = require('./text')

const FILLERS = new Set([
  // English / cross-language vocalised pauses
  'um', 'umm', 'uh', 'uhh', 'uhm', 'uhmm', 'er', 'err', 'erm',
  'eh', 'ehm', 'ah', 'ahh', 'hm', 'hmm', 'mm', 'mmm',
  // Hebrew
  'אה', 'אהה', 'אמ', 'אמם', 'אממ', 'אהם', 'עמ', 'המ',
  // Spanish / others
  'este', 'pues', 'eee', 'euh'
])

function isFiller (token) {
  return FILLERS.has(normalize(token))
}

// True when a Scribe word is an explicit disfluency per the STT provider's own
// tagging. We prefer this signal over the list when present.
function taggedDisfluency (word) {
  if (!word || typeof word !== 'object') return false
  if (word.disfluency === true) return true
  return word.type === 'disfluency'
}

// Strip fillers from a Scribe word array to build the clean editable script.
// The provider's disfluency tag wins when present; otherwise fall back to the
// list. Returns the joined non-filler text. The caller keeps the FULL word
// list (including fillers) as original_words — fillers stay valid pause
// evidence for the path algorithm, they are only excluded from the script text.
function stripFillers (words) {
  return (words || [])
    .filter(w => !taggedDisfluency(w) && !isFiller(w.w))
    .map(w => w.w)
    .join(' ')
}

module.exports = { FILLERS, isFiller, stripFillers, taggedDisfluency }

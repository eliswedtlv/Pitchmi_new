'use strict'

// Karaoke timings for a TYPED script (T-10018). Two functions, used in order:
//
//   buildSeedPath(scriptText)                  -> path            (take 0)
//   buildPathFromScript(scriptText, spoken)    -> { path, coverage, matched, total }
//
// The problem: karaoke needs a timestamp per word and typed text has none. Two
// earlier attempts to synthesize a whole pacing MODEL (T-1167, T-1168) were
// rejected as "too fast" / "not my rhythm", and T-1169 deleted that engine
// rather than tune it a third time. So the design here is deliberately not an
// engine — it is one throwaway estimate followed by measurement:
//
//   1. `buildSeedPath` gives the very first take something to follow: fixed
//      chars-per-second plus fixed punctuation pauses. No anchoring, no
//      stretching, no smoothing, no rate model. It survives exactly one take.
//   2. After every take, `buildPathFromScript` aligns what was actually said
//      against the typed script, and each typed word inherits the REAL moment
//      it was spoken. Words with no anchor (mis-heard, skipped, fumbled) are
//      interpolated between two real neighbours in proportion to their
//      character length — never laid out at a synthesized rate.
//
// So the pace the user rehearses against is their own from take 2 onward, and
// it is measured, never invented. Both functions emit exactly the shape
// buildSubtitles produces for a spoken take, so scoring and the client render
// them unchanged. Pure, no I/O.

const { normalize, charLen } = require('./text')
const { isFiller } = require('./fillers')
const { align } = require('./score')
const config = require('../config')
const { buildSubtitles, scriptTokens } = require('./subtitles')

// Seconds per character, used ONLY to extrapolate a leading/trailing run when
// the reading itself gave nothing to measure (a single anchor, or none). Every
// other path through this module measures the rate from the real reading.
const FALLBACK_RATE_S_PER_CHAR = 0.06

// Inter-word silences for the seed path, carried over verbatim from T-1168 —
// they are the one part of that work that measured well. Fixed, never scaled.
const WORD_GAP_S = 0.08
const CLAUSE_GAP_S = 0.15
const SENTENCE_PAUSE_S = 0.35

// A first, disposable guess at the timings for a script nobody has spoken yet.
// Rate is in CHARACTERS per second, not words per minute: word length varies
// hugely between English and Hebrew, so a WPM figure calibrated on one is
// wrong on the other. This is not a pacing engine and must not become one —
// the very first take replaces it with measured timings.
function buildSeedPath (scriptText) {
  const tokens = scriptTokens(scriptText)
  if (!tokens.length) return emptyPath()

  const cps = config.SEED_CHARS_PER_SECOND > 0 ? config.SEED_CHARS_PER_SECOND : 13
  let t = 0
  const words = tokens.map(token => {
    const start = t
    t += Math.max(1, charLen(token.w)) / cps
    const end = t
    t += token.sentenceEnd ? SENTENCE_PAUSE_S : token.clauseBreak ? CLAUSE_GAP_S : WORD_GAP_S
    return { w: token.w + punctuation(token), start, end }
  })

  return buildSubtitles(words)
}

function buildPathFromScript (scriptText, spokenWords) {
  const tokens = scriptTokens(scriptText)
  const total = tokens.length
  if (!total) return result(emptyPath(), 0, 0)

  // `end` matters here, so build our own spoken array — scoreTake's (score.js
  // :26-30) drops it. `align` itself never reads start/end.
  const spoken = (spokenWords || [])
    .map(s => ({
      norm: normalize(s && s.w),
      start: Number(s && s.start),
      end: Number(s && s.end),
      filler: isFiller(s && s.w)
    }))
    .filter(s => Number.isFinite(s.start) && Number.isFinite(s.end))

  // Silence: no anchors and no span to interpolate over. The caller turns an
  // empty path into 422 no_speech.
  if (!spoken.length) return result(emptyPath(), 0, total)

  const pathNorm = tokens.map(t => normalize(t.w))
  const { matches } = align(pathNorm, spoken)
  const matched = matches.length

  const starts = new Array(total)
  const ends = new Array(total)
  for (const { pi, si } of matches) {
    starts[pi] = spoken[si].start
    ends[pi] = spoken[si].end
  }

  const rate = meanRate(tokens, matches, spoken)
  const audioEnd = spoken[spoken.length - 1].end

  if (!matched) {
    // Nothing anchored — the user read something else entirely. Spreading the
    // script over the reading's real span keeps the path well-formed so the
    // caller can answer with the honest `low_coverage` error rather than
    // pretending the take was silent. Coverage is 0, so it never ships.
    fillRun(tokens, starts, ends, 0, total - 1, spoken[0].start, audioEnd)
  } else {
    const first = matches[0].pi
    const last = matches[matched - 1].pi

    // Leading run: back-extrapolate at the measured rate, floored at 0. Laying
    // it across ALL the leading silence instead would park the prompter on
    // word 1 until the first anchor.
    if (first > 0) {
      const desired = runChars(tokens, 0, first - 1) * rate
      fillRun(tokens, starts, ends, 0, first - 1, Math.max(0, starts[first] - desired), starts[first])
    }

    // Interior runs: real gap between two real anchors, shared out by length.
    for (let k = 1; k < matched; k++) {
      const p = matches[k - 1].pi
      const q = matches[k].pi
      if (q - p > 1) fillRun(tokens, starts, ends, p + 1, q - 1, ends[p], starts[q])
    }

    // Trailing run: prefer the audio that really is left after the last anchor
    // (those words were spoken, just not recognised); only when there is none
    // do we forward-extrapolate at the measured rate.
    if (last < total - 1) {
      const desired = runChars(tokens, last + 1, total - 1) * rate
      const span = Math.max(audioEnd - ends[last], desired)
      fillRun(tokens, starts, ends, last + 1, total - 1, ends[last], ends[last] + span)
    }
  }

  // Safety net for the one failure that is completely silent in production:
  // the karaoke clock (client/src/lib/clock.ts) scans for the last word whose
  // t_start <= elapsed and early-breaks, so a single backwards step kills
  // highlighting from there on with no error anywhere.
  enforceMonotonic(starts, ends)

  const path = buildSubtitles(tokens.map((t, i) => ({
    // Re-attach the punctuation segmentWords recorded as a flag: buildSubtitles
    // reads the line-break hints off each word's TRAILING punctuation and
    // strips it again for the surface, so this round-trips to `t.w`.
    w: t.w + punctuation(t),
    start: starts[i],
    end: ends[i]
  })))

  return result(path, matched, total)
}

// Lay tokens [from..to] across [t0, t1], each word taking a share of the span
// proportional to its character length. Every interpolated word's end IS the
// next word's start, so the prompter never shows a dead zone mid-run.
function fillRun (tokens, starts, ends, from, to, t0, t1) {
  const span = Math.max(0, t1 - t0)
  const chars = runChars(tokens, from, to)
  let cursor = t0
  for (let i = from; i <= to; i++) {
    starts[i] = cursor
    cursor += span * (Math.max(1, charLen(tokens[i].w)) / chars)
    ends[i] = cursor
  }
  ends[to] = t1
}

function runChars (tokens, from, to) {
  let c = 0
  for (let i = from; i <= to; i++) c += Math.max(1, charLen(tokens[i].w))
  return c
}

// Seconds per character over the matched region — the user's own measured
// reading rate. Falls back to the whole reading, then to a constant, only when
// there is literally nothing to measure.
function meanRate (tokens, matches, spoken) {
  if (matches.length >= 2) {
    const first = matches[0]
    const last = matches[matches.length - 1]
    const span = spoken[last.si].end - spoken[first.si].start
    const chars = runChars(tokens, first.pi, last.pi)
    if (span > 0 && chars > 0) return span / chars
  }
  const span = spoken[spoken.length - 1].end - spoken[0].start
  let chars = 0
  for (const s of spoken) chars += Math.max(1, charLen(s.norm))
  if (span > 0 && chars > 0) return span / chars
  return FALLBACK_RATE_S_PER_CHAR
}

function enforceMonotonic (starts, ends) {
  let prev = 0
  for (let i = 0; i < starts.length; i++) {
    const s = Number.isFinite(starts[i]) ? Math.max(starts[i], prev, 0) : prev
    const e = Number.isFinite(ends[i]) ? Math.max(ends[i], s) : s
    starts[i] = s
    ends[i] = e
    prev = s
  }
}

function punctuation (t) {
  if (t.sentenceEnd) return '.'
  if (t.clauseBreak) return ','
  return ''
}

function emptyPath () {
  return { words: [], lines: [], total_s: 0 }
}

function result (path, matched, total) {
  return { path, coverage: total ? matched / total : 0, matched, total }
}

module.exports = { buildSeedPath, buildPathFromScript }

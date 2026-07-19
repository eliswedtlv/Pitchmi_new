'use strict'

// Take comparison — accuracy + timing (v1 spec §7). Compares a new take's
// spoken words (from Scribe) against the karaoke path and returns objective
// accuracy/timing scores plus machine-generated flags. Pure function.
//
//   scoreTake(spokenWords, path) -> {
//     accuracy, timing, matched, path_word_count,
//     mean_abs_offset, drift, flags: [{ type, line? }]
//   }

const { normalize } = require('./text')
const { isFiller } = require('./fillers')

// Timing score is 100 at <=0.3s mean absolute offset, linear to 0 at >=3.0s.
const TIMING_TIGHT_S = 0.3
const TIMING_LOOSE_S = 3.0

function scoreTake (spokenWords, path) {
  const pathWords = (path && path.words) || []
  const n = pathWords.length
  const spoken = (spokenWords || []).map(s => ({
    norm: normalize(s.w),
    start: Number(s.start),
    filler: isFiller(s.w)
  }))

  if (!n) {
    return { accuracy: 0, timing: 0, matched: 0, path_word_count: 0, mean_abs_offset: 0, drift: 0, flags: [] }
  }

  const pathNorm = pathWords.map(p => normalize(p.w))
  const { matches } = align(pathNorm, spoken)

  const matched = matches.length
  const accuracy = Math.round((matched / n) * 100)

  // Timing: offset per matched word = spoken start - target start.
  const offsets = matches.map(({ pi, si }) => spoken[si].start - pathWords[pi].t_start)
  const absOffsets = offsets.map(Math.abs)
  const meanAbs = mean(absOffsets)
  const timing = matched ? Math.round(timingScore(meanAbs)) : 0
  const drift = matched ? round3(slope(matches.map(({ pi }) => pathWords[pi].t_start), offsets)) : 0

  const flags = buildFlags({ pathWords, matches, spoken, offsets, accuracy, n })

  return {
    accuracy,
    timing,
    matched,
    path_word_count: n,
    mean_abs_offset: round3(meanAbs),
    drift,
    flags
  }
}

// Levenshtein alignment (DP) over normalized tokens. Substitution / insertion /
// deletion all cost 1. A spoken filler can never match a path word. Returns the
// matched { pi, si } pairs (0-cost diagonal steps).
function align (pathNorm, spoken) {
  const n = pathNorm.length
  const m = spoken.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) dp[i][0] = i
  for (let j = 1; j <= m; j++) dp[0][j] = j
  const eq = (i, j) => !spoken[j].filler && spoken[j].norm !== '' && pathNorm[i] === spoken[j].norm
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const subCost = eq(i - 1, j - 1) ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + subCost,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      )
    }
  }
  // Backtrack, preferring 0-cost diagonal matches.
  const matches = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (eq(i - 1, j - 1) && dp[i][j] === dp[i - 1][j - 1]) {
      matches.push({ pi: i - 1, si: j - 1 })
      i--
      j--
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      i--
      j--
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      i--
    } else {
      j--
    }
  }
  matches.reverse()
  return { matches }
}

function buildFlags ({ pathWords, matches, spoken, offsets, accuracy, n }) {
  const flags = []

  // Per-line offset stats + coverage.
  const lineOffsets = new Map()
  const lineMatched = new Map()
  const lineTotal = new Map()
  for (const p of pathWords) lineTotal.set(p.line, (lineTotal.get(p.line) || 0) + 1)
  matches.forEach(({ pi }, idx) => {
    const line = pathWords[pi].line
    if (!lineOffsets.has(line)) lineOffsets.set(line, [])
    lineOffsets.get(line).push(offsets[idx])
    lineMatched.set(line, (lineMatched.get(line) || 0) + 1)
  })

  for (const [line, offs] of lineOffsets) {
    const mo = mean(offs)
    if (mo < -1) flags.push({ type: 'rushed_line', line })
    else if (mo > 1) flags.push({ type: 'dragged_line', line })
  }

  // skipped_line: < 50% of a line's path words matched.
  for (const [line, total] of lineTotal) {
    const got = lineMatched.get(line) || 0
    if (got / total < 0.5) flags.push({ type: 'skipped_line', line })
  }

  // long_pause: a matched-to-matched gap more than 2x the expected path gap.
  for (let k = 1; k < matches.length; k++) {
    const prev = matches[k - 1]
    const cur = matches[k]
    const expected = pathWords[cur.pi].t_start - pathWords[prev.pi].t_start
    const actual = spoken[cur.si].start - spoken[prev.si].start
    if (expected > 0 && actual > 2 * expected) {
      flags.push({ type: 'long_pause', line: pathWords[cur.pi].line })
      break
    }
  }

  if (accuracy < 70) flags.push({ type: 'off_script' })

  return flags.slice(0, 5)
}

function timingScore (meanAbs) {
  if (meanAbs <= TIMING_TIGHT_S) return 100
  if (meanAbs >= TIMING_LOOSE_S) return 0
  return 100 * (TIMING_LOOSE_S - meanAbs) / (TIMING_LOOSE_S - TIMING_TIGHT_S)
}

function mean (arr) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

// Least-squares slope of y over x.
function slope (xs, ys) {
  const nn = xs.length
  if (nn < 2) return 0
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < nn; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  return den === 0 ? 0 : num / den
}

function round3 (n) {
  return Math.round(n * 1000) / 1000
}

module.exports = { scoreTake, align, timingScore }

'use strict'

// Karaoke path algorithm (v1 spec §6). Turns an edited script + the original
// take's word timings into a timed teleprompter path.
//
//   buildPath(originalWords, editedScript, speed) -> {
//     path: { words: [{ w, t_start, t_end, line }], lines: [...], total_s },
//     fits, est_duration_s, warning
//   }
//
// Pure function, no I/O. Tested heavily — this is core IP.

const { normalize, charLen, segmentWords } = require('./text')

const MAX_TAKE_S = 60
// Fallback speaking rate when the original take gives us nothing to measure
// (~150 wpm, ~5.5 chars/word incl. space).
const DEFAULT_SEC_PER_CHAR = 0.0727
const LINE_MAX_CHARS = 40
const LINE_MIN_CHARS = 24

// Longest common subsequence of two normalized token arrays. Returns the
// surviving [aIndex, bIndex] pairs in order — these become the anchors.
function lcsPairs (a, b) {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const pairs = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1])
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  pairs.reverse()
  return pairs
}

// Median seconds-per-character over the original voiced words.
function measureRate (originalWords) {
  const rates = []
  for (const o of originalWords) {
    const dur = Number(o.end) - Number(o.start)
    const chars = charLen(o.w)
    if (dur > 0 && chars > 0) rates.push(dur / chars)
  }
  if (!rates.length) return DEFAULT_SEC_PER_CHAR
  rates.sort((x, y) => x - y)
  const mid = Math.floor(rates.length / 2)
  return rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2
}

function breakIntoLines (tokens) {
  const lines = []
  let cur = []
  let curLen = 0
  const flush = () => {
    if (!cur.length) return
    const index = lines.length
    for (const t of cur) t.line = index
    lines.push({
      index,
      text: cur.map(t => t.w).join(' '),
      t_start: cur[0].t_start,
      t_end: cur[cur.length - 1].t_end
    })
    cur = []
    curLen = 0
  }
  for (const t of tokens) {
    cur.push(t)
    curLen += charLen(t.w) + 1
    if (curLen >= LINE_MAX_CHARS || (t.clauseBreak && curLen >= LINE_MIN_CHARS)) flush()
  }
  flush()
  return lines
}

function buildPath (originalWords, editedScript, speed) {
  const spd = clampSpeed(speed)
  const segs = segmentWords(editedScript)
  const tokens = segs.map(s => ({
    w: s.w,
    clauseBreak: s.clauseBreak,
    t_start: 0,
    t_end: 0,
    line: 0
  }))

  if (!tokens.length) {
    return { path: { words: [], lines: [], total_s: 0 }, fits: true, est_duration_s: 0, warning: null }
  }

  const original = (originalWords || []).map(o => ({
    w: o.w,
    start: Number(o.start),
    end: Number(o.end)
  }))
  const editedNorm = tokens.map(t => normalize(t.w))
  const origNorm = original.map(o => normalize(o.w))
  const spc = measureRate(original)
  const minSpc = spc * 0.8 // fastest speakable rate (max rate)

  // Align: LCS pairs -> anchors. anchorOf[editedIndex] = original word or null.
  const anchorOf = new Array(tokens.length).fill(null)
  if (original.length) {
    for (const [ei, oi] of lcsPairs(editedNorm, origNorm)) {
      anchorOf[ei] = original[oi]
    }
  }
  const anchorIdx = tokens.map((_, i) => (anchorOf[i] ? i : -1)).filter(i => i >= 0)

  if (!anchorIdx.length) {
    // No surviving words: pure rate-based extrapolation from t=0.
    let t = 0
    for (const tok of tokens) {
      const dur = Math.max(charLen(tok.w) * spc, 0.001)
      tok.t_start = t
      tok.t_end = t + dur
      t = tok.t_end
    }
  } else {
    let shift = 0
    // Leading run before the first anchor: extrapolate backward at natural rate.
    const first = anchorIdx[0]
    const leadTokens = tokens.slice(0, first)
    const leadChars = leadTokens.reduce((s, t) => s + charLen(t.w), 0)
    const anchor0 = anchorOf[first]
    if (leadTokens.length) {
      const needed = leadChars * spc
      let t = anchor0.start - needed
      for (const tok of leadTokens) {
        const dur = leadChars ? (charLen(tok.w) / leadChars) * needed : spc
        tok.t_start = t
        tok.t_end = t + dur
        t = tok.t_end
      }
    }
    tokens[first].t_start = anchor0.start
    tokens[first].t_end = anchor0.end

    for (let k = 1; k < anchorIdx.length; k++) {
      const prevI = anchorIdx[k - 1]
      const curI = anchorIdx[k]
      const prevAnchor = anchorOf[prevI]
      const curAnchor = anchorOf[curI]
      const run = tokens.slice(prevI + 1, curI)
      const availGap = curAnchor.start - prevAnchor.end
      const cursor = prevAnchor.end + shift
      if (run.length) {
        const runChars = run.reduce((s, t) => s + charLen(t.w), 0) || 1
        const neededMin = runChars * minSpc
        const gap = Math.max(availGap, neededMin)
        shift += gap - availGap
        let t = cursor
        for (const tok of run) {
          const dur = (charLen(tok.w) / runChars) * gap
          tok.t_start = t
          tok.t_end = t + dur
          t = tok.t_end
        }
      }
      tokens[curI].t_start = curAnchor.start + shift
      tokens[curI].t_end = curAnchor.end + shift
    }

    // Trailing run after the last anchor: extrapolate forward at natural rate.
    const last = anchorIdx[anchorIdx.length - 1]
    let t = tokens[last].t_end
    for (let i = last + 1; i < tokens.length; i++) {
      const dur = Math.max(charLen(tokens[i].w) * spc, 0.001)
      tokens[i].t_start = t
      tokens[i].t_end = t + dur
      t = tokens[i].t_end
    }
  }

  // Normalize so the timeline never starts before 0.
  const minStart = Math.min(...tokens.map(t => t.t_start))
  if (minStart < 0) {
    for (const tok of tokens) {
      tok.t_start -= minStart
      tok.t_end -= minStart
    }
  }

  // Apply the global speed slider: slower speed => longer path.
  const factor = 1 / spd
  for (const tok of tokens) {
    tok.t_start = round3(tok.t_start * factor)
    tok.t_end = round3(tok.t_end * factor)
  }

  const lines = breakIntoLines(tokens)
  const words = tokens.map(t => ({ w: t.w, t_start: t.t_start, t_end: t.t_end, line: t.line }))
  const totalS = words.length ? words[words.length - 1].t_end : 0

  const fits = totalS <= MAX_TAKE_S
  let warning = null
  if (!fits) {
    const over = round1(totalS - MAX_TAKE_S)
    const perWord = totalS / words.length
    const toCut = Math.ceil(over / perWord)
    warning = `Over by ${over}s at this pace — cut about ${toCut} word${toCut === 1 ? '' : 's'} or increase speed.`
  }

  return {
    path: { words, lines, total_s: round1(totalS) },
    fits,
    est_duration_s: round1(totalS),
    warning
  }
}

function clampSpeed (speed) {
  const s = Number(speed)
  if (!Number.isFinite(s)) return 1
  return Math.min(1.25, Math.max(0.75, s))
}

function round3 (n) {
  return Math.round(n * 1000) / 1000
}

function round1 (n) {
  return Math.round(n * 10) / 10
}

module.exports = { buildPath, measureRate, lcsPairs }

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

// Broadcast-teleprompter line construction (T-1162 §B): short lines that break
// at natural phrase boundaries. Character-based caps so Hebrew/RTL behave; CJK
// counts by grapheme (charLen already does).
const LINE_MAX_CHARS = 32
const LINE_MAX_WORDS = 6

// Pacing fallback (T-1167 §A). After a clean-verbatim pass plus real edits, few
// words survive as exact timing anchors; anchoring the sparse survivors to
// take-1 timestamps and stretching everything between them warps the rhythm.
// Below this anchor coverage we ignore anchors and lay the whole script
// uniformly at the speaker's measured rate. At or above it we keep anchors but
// cap any word's implied rate to the ±SMOOTH_BAND band.
const ANCHOR_COVERAGE_MIN = 0.6
const SMOOTH_BAND = 0.35

// Uniform-layout inter-word gaps (T-1168). layUniform packs word *durations* at
// the measured rate; the elapsed pace of real speech also includes the silence
// between words, so we lay explicit gaps that carry it: a small gap between
// plain words, a longer one after a comma/clause break, the sentence pause at
// full stops. Word durations scale with COMFORT; the gaps are fixed and never
// scaled, so they stay exact regardless of pace.
const WORD_GAP = 0.08 // gap between two plain words (s)
const CLAUSE_GAP = 0.15 // gap after a comma / clause punctuation (s)
const SENTENCE_PAUSE = 0.35 // pause at sentence punctuation (s)

// Delivery-comfort bias (T-1168): speakers read a prompt slightly slower than
// they converse, so the uniform word durations run 10% longer than measured.
const COMFORT = 1.1

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

// Effective seconds-per-character over the whole take: elapsed wall time from
// the first word's start to the last word's end, divided by total characters.
// Unlike the voiced median (measureRate) this INCLUDES inter-word gaps, breaths
// and hesitations, so it reflects the speaker's real delivery pace — which is
// what a teleprompter should run at. Guarded by the voiced median as a lower
// bound so a take that was mostly silence can't drive an absurdly slow prompt
// (T-1168). Falls back to voicedRate when there is nothing to measure.
function measureEffectiveRate (originalWords, voicedRate) {
  const words = (originalWords || [])
    .map(o => ({ chars: charLen(o.w), start: Number(o.start), end: Number(o.end) }))
    .filter(o => Number.isFinite(o.start) && Number.isFinite(o.end))
  if (words.length < 2) return voicedRate
  const elapsed = words[words.length - 1].end - words[0].start
  const totalChars = words.reduce((s, o) => s + o.chars, 0)
  if (!(elapsed > 0) || totalChars <= 0) return voicedRate
  return Math.max(elapsed / totalChars, voicedRate)
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
      t_start: grp[0].t_start,
      t_end: grp[grp.length - 1].t_end
    })
  })
  return lines
}

function buildPath (originalWords, editedScript, speed) {
  const spd = clampSpeed(speed)
  const segs = segmentWords(editedScript)
  const tokens = segs.map(s => ({
    w: s.w,
    clauseBreak: s.clauseBreak,
    sentenceEnd: s.sentenceEnd,
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
  const voicedRate = measureRate(original) // articulation rate of voiced words
  const effRate = measureEffectiveRate(original, voicedRate) // >= voicedRate; includes gaps
  const rateFast = effRate * (1 - SMOOTH_BAND) // fastest speakable rate (min sec/char)

  // Align: LCS pairs -> anchors. anchorOf[editedIndex] = original word or null.
  const anchorOf = new Array(tokens.length).fill(null)
  if (original.length) {
    for (const [ei, oi] of lcsPairs(editedNorm, origNorm)) {
      anchorOf[ei] = original[oi]
    }
  }
  const anchorIdx = tokens.map((_, i) => (anchorOf[i] ? i : -1)).filter(i => i >= 0)

  // Anchor coverage: fraction of the edited script that survives from take 1 as
  // an exact timing anchor. Too sparse -> uniform fallback; otherwise anchor +
  // smooth so no single word or gap reads jarringly fast or slow (T-1167 §A).
  const coverage = anchorIdx.length / tokens.length
  if (coverage < ANCHOR_COVERAGE_MIN) {
    layUniform(tokens, effRate)
  } else {
    layAnchored(tokens, anchorOf, anchorIdx, effRate, rateFast)
    smoothRates(tokens, voicedRate, effRate)
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

// Uniform fallback (T-1168): every word's duration is chars × effective rate ×
// COMFORT, and an explicit gap is laid after each word — the sentence pause at a
// full stop, the clause gap after a comma, otherwise the small word gap. The
// gaps reproduce the inter-word silence the effective rate was measured over, so
// the whole path elapses at the speaker's real pace instead of racing. Monotonic
// by construction; word durations scale with COMFORT while the gaps stay exact.
function layUniform (tokens, rate) {
  let t = 0
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const dur = Math.max(charLen(tok.w) * rate * COMFORT, 0.001)
    tok.t_start = t
    tok.t_end = t + dur
    t = tok.t_end
    if (i < tokens.length - 1) {
      t += tok.sentenceEnd ? SENTENCE_PAUSE : tok.clauseBreak ? CLAUSE_GAP : WORD_GAP
    }
  }
}

// Anchor-based layout: surviving words are pinned to their take-1 timestamps and
// runs of inserted words are timed between them. Inserted words read at the
// speaker's effective rate (T-1168 — same basis as the uniform path, so light
// and heavy edits pace consistently); if the gap can't hold them they compress
// toward the fastest speakable rate (never past it) and only then push later
// anchors right. Any spare gap becomes a pause before the next anchor instead of
// stretching the inserted words slow — that is what kept editing from warping
// the rhythm.
function layAnchored (tokens, anchorOf, anchorIdx, rate, rateFast) {
  let shift = 0
  // Leading run before the first anchor: extrapolate backward at natural rate.
  const first = anchorIdx[0]
  const leadTokens = tokens.slice(0, first)
  const leadChars = leadTokens.reduce((s, t) => s + charLen(t.w), 0)
  const anchor0 = anchorOf[first]
  if (leadTokens.length) {
    const needed = leadChars * rate
    let t = anchor0.start - needed
    for (const tok of leadTokens) {
      const dur = leadChars ? (charLen(tok.w) / leadChars) * needed : rate
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
      const naturalTotal = runChars * rate
      const minTotal = runChars * rateFast
      let readTotal
      if (availGap >= naturalTotal) {
        readTotal = naturalTotal // natural rate; the surplus becomes a pause
      } else if (availGap >= minTotal) {
        readTotal = availGap // compress into the gap, still within the band
      } else {
        readTotal = minTotal // fastest speakable; push later anchors right
        shift += minTotal - availGap
      }
      let t = cursor
      for (const tok of run) {
        const dur = (charLen(tok.w) / runChars) * readTotal
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
    const dur = Math.max(charLen(tokens[i].w) * rate, 0.001)
    tokens[i].t_start = t
    tokens[i].t_end = t + dur
    t = tokens[i].t_end
  }
}

// Clamp each word's implied rate into the speakable band, pushing the delta into
// the following words so gaps and ordering are preserved. The fast bound stays
// tied to the voiced articulation rate so a word pinned to its real (fast) take-1
// timestamp is never stretched off its beat; the slow bound scales with the
// effective rate so inserted runs paced at that rate (layAnchored) are not
// compressed back (T-1168). A no-op for words already in band; it only trims a
// word that survived take 1 unusually stretched or clipped.
function smoothRates (tokens, voicedRate, effRate) {
  const rateFast = voicedRate * (1 - SMOOTH_BAND)
  const rateSlow = effRate * (1 + SMOOTH_BAND)
  for (let i = 0; i < tokens.length; i++) {
    const chars = charLen(tokens[i].w) || 1
    const dur = tokens[i].t_end - tokens[i].t_start
    const minD = Math.max(chars * rateFast, 0.001)
    const maxD = chars * rateSlow
    let newDur = dur
    if (dur > maxD) newDur = maxD
    else if (dur < minD) newDur = minD
    const delta = newDur - dur
    if (delta === 0) continue
    tokens[i].t_end += delta
    for (let j = i + 1; j < tokens.length; j++) {
      tokens[j].t_start += delta
      tokens[j].t_end += delta
    }
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

module.exports = { buildPath, measureRate, measureEffectiveRate, lcsPairs }

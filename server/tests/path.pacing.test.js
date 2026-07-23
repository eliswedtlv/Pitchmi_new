'use strict'

// T-1167 §A: after clean-verbatim + real edits, few words survive as exact
// timing anchors. Below 0.6 anchor coverage we ignore anchors and lay the whole
// script uniformly at the measured rate; at/above it we keep anchors but cap any
// word's implied rate to ±35% of that rate so nothing reads jarringly fast/slow.

const { buildPath, measureRate } = require('../src/lib/path')
const { charLen } = require('../src/lib/text')

const SENTENCE_PAUSE_S = 0.35

// Original take with a clean 0.1 s/char measured rate.
const ORIG = [
  { w: 'hello', start: 0.0, end: 0.5 },
  { w: 'world', start: 0.6, end: 1.1 }
]

// Original take with a long silent pause between "show" and "today" — the shape
// that used to warp inserted words slow when the script was edited.
const ORIG_LONG = [
  { w: 'welcome', start: 0.0, end: 0.6 },
  { w: 'to', start: 0.7, end: 0.9 },
  { w: 'the', start: 1.0, end: 1.2 },
  { w: 'show', start: 1.3, end: 1.8 },
  { w: 'today', start: 5.0, end: 5.6 }
]

function rateOf (w) {
  return (w.t_end - w.t_start) / charLen(w.w)
}

describe('low anchor coverage -> uniform timing (T-1167 §A)', () => {
  const script = 'Alpha beta gamma. Delta epsilon zeta.'
  const r = buildPath(ORIG, script, 1)
  const spc = measureRate(ORIG)

  test('all original words replaced away -> uniform, monotonic, in band', () => {
    const words = r.path.words
    expect(words.map(w => w.w)).toEqual(['Alpha', 'beta', 'gamma', 'Delta', 'epsilon', 'zeta'])
    for (let i = 1; i < words.length; i++) {
      expect(words[i].t_start).toBeGreaterThanOrEqual(words[i - 1].t_end - 1e-9)
    }
    for (const w of words) {
      expect(rateOf(w)).toBeGreaterThanOrEqual(spc * 0.65 - 1e-6)
      expect(rateOf(w)).toBeLessThanOrEqual(spc * 1.35 + 1e-6)
    }
  })

  test('a sentence pause lands at sentence punctuation', () => {
    const words = r.path.words
    const g = words.findIndex(w => w.w === 'gamma')
    const gap = words[g + 1].t_start - words[g].t_end
    expect(gap).toBeCloseTo(SENTENCE_PAUSE_S, 2)
    // no spurious pause mid-sentence (between beta and gamma)
    const b = words.findIndex(w => w.w === 'beta')
    expect(words[b + 1].t_start - words[b].t_end).toBeCloseTo(0, 5)
  })
})

describe('high anchor coverage -> anchors kept + smoothed (T-1167 §A)', () => {
  // welcome/to/the/show/today survive (5) out of 8 tokens => coverage 0.625.
  const script = 'welcome to the show my dear friends today'
  const r = buildPath(ORIG_LONG, script, 1)
  const spc = measureRate(ORIG_LONG)

  test('surviving anchor "today" stays at its take-1 timestamp', () => {
    const today = r.path.words.find(w => w.w === 'today')
    expect(today.t_start).toBeCloseTo(5.0, 2)
  })

  test('no word falls outside the ±35% speakable band', () => {
    for (const w of r.path.words) {
      expect(rateOf(w)).toBeGreaterThanOrEqual(spc * 0.65 - 1e-6)
      expect(rateOf(w)).toBeLessThanOrEqual(spc * 1.35 + 1e-6)
    }
  })

  test('inserted words are not stretched slow across the pause', () => {
    // Pre-fix these three shared the whole 3.2s gap (~0.25 s/char, far slow).
    for (const name of ['my', 'dear', 'friends']) {
      const w = r.path.words.find(x => x.w === name)
      expect(rateOf(w)).toBeLessThanOrEqual(spc * 1.35 + 1e-6)
    }
  })
})

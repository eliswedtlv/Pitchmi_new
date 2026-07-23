'use strict'

// T-1167 §A + T-1168: after clean-verbatim + real edits, few words survive as
// exact timing anchors. Below 0.6 anchor coverage we ignore anchors and lay the
// whole script uniformly at the EFFECTIVE rate (elapsed / total chars, so it
// includes inter-word gaps) with explicit inter-word gaps + a 10% comfort bias;
// at/above it we keep anchors but pace inserted runs at that same effective rate
// and clamp any word's implied rate into the speakable band.

const { buildPath, measureRate, measureEffectiveRate } = require('../src/lib/path')
const { charLen } = require('../src/lib/text')

const WORD_GAP = 0.08
const CLAUSE_GAP = 0.15
const SENTENCE_PAUSE = 0.35
const COMFORT = 1.1
const SMOOTH_BAND = 0.35

// Original take "hello world": measured (voiced) rate 0.1 s/char, effective rate
// (1.1s elapsed / 10 chars) 0.11 s/char.
const ORIG = [
  { w: 'hello', start: 0.0, end: 0.5 },
  { w: 'world', start: 0.6, end: 1.1 }
]

// High-coverage take: welcome/to/the/show survive as anchors, each articulated
// at a clean 0.12 s/char, with a gap before "show" wide enough to hold one
// inserted word ("great") — the shape a light edit produces.
const ORIG_ANCHOR = [
  { w: 'welcome', start: 0.0, end: 0.84 },
  { w: 'to', start: 0.94, end: 1.18 },
  { w: 'the', start: 1.28, end: 1.64 },
  { w: 'show', start: 2.6, end: 3.08 }
]

function rateOf (w) {
  return (w.t_end - w.t_start) / charLen(w.w)
}

describe('measureEffectiveRate (T-1168)', () => {
  test('elapsed / total chars, includes gaps, above the voiced median', () => {
    const voiced = measureRate(ORIG)
    const eff = measureEffectiveRate(ORIG, voiced)
    expect(voiced).toBeCloseTo(0.1, 5)
    expect(eff).toBeCloseTo(0.11, 5) // 1.1s / 10 chars
    expect(eff).toBeGreaterThan(voiced)
  })

  test('voiced median is a lower bound; degenerate takes fall back to it', () => {
    expect(measureEffectiveRate([{ w: 'hello', start: 0, end: 0.5 }], 0.1)).toBe(0.1)
    expect(measureEffectiveRate([], 0.1)).toBe(0.1)
  })
})

describe('low anchor coverage -> uniform effective-rate timing (T-1168)', () => {
  const script = 'Alpha beta, gamma. Delta epsilon zeta.'
  const r = buildPath(ORIG, script, 1)
  const eff = measureEffectiveRate(ORIG, measureRate(ORIG))

  test('all original words replaced away -> uniform, monotonic', () => {
    const words = r.path.words
    expect(words.map(w => w.w)).toEqual(['Alpha', 'beta', 'gamma', 'Delta', 'epsilon', 'zeta'])
    for (let i = 1; i < words.length; i++) {
      expect(words[i].t_start).toBeGreaterThanOrEqual(words[i - 1].t_end - 1e-9)
    }
  })

  test('word durations = chars × effective rate × comfort bias', () => {
    for (const w of r.path.words) {
      expect(w.t_end - w.t_start).toBeCloseTo(charLen(w.w) * eff * COMFORT, 3)
    }
  })

  test('inter-word / comma / sentence gaps are present and exact', () => {
    const words = r.path.words
    const gapAfter = (name) => {
      const i = words.findIndex(w => w.w === name)
      return words[i + 1].t_start - words[i].t_end
    }
    expect(gapAfter('Alpha')).toBeCloseTo(WORD_GAP, 5) // plain word gap
    expect(gapAfter('beta')).toBeCloseTo(CLAUSE_GAP, 5) // after the comma
    expect(gapAfter('gamma')).toBeCloseTo(SENTENCE_PAUSE, 5) // full stop
    expect(gapAfter('Delta')).toBeCloseTo(WORD_GAP, 5)
  })

  test('total ≈ script chars × effRate × comfort + pauses (within 5%)', () => {
    const scriptChars = r.path.words.reduce((s, w) => s + charLen(w.w), 0)
    const pauses = WORD_GAP * 3 + CLAUSE_GAP + SENTENCE_PAUSE
    const expected = scriptChars * eff * COMFORT + pauses
    expect(r.path.total_s).toBeGreaterThan(expected * 0.95)
    expect(r.path.total_s).toBeLessThan(expected * 1.05)
  })
})

describe('high anchor coverage -> anchors kept, effective-rate basis (T-1168)', () => {
  // welcome/to/the/show survive (4) out of 5 tokens => coverage 0.8; "great" is
  // inserted between "the" and "show".
  const script = 'welcome to the great show'
  const r = buildPath(ORIG_ANCHOR, script, 1)
  const voiced = measureRate(ORIG_ANCHOR)
  const eff = measureEffectiveRate(ORIG_ANCHOR, voiced)

  test('surviving anchors keep their take-1 timestamps (light-edit beats)', () => {
    const at = (name) => r.path.words.find(w => w.w === name)
    expect(at('welcome')).toMatchObject({ t_start: 0, t_end: 0.84 })
    expect(at('to').t_start).toBeCloseTo(0.94, 2)
    expect(at('the').t_start).toBeCloseTo(1.28, 2)
    expect(at('show').t_start).toBeCloseTo(2.6, 2)
    expect(at('show').t_end).toBeCloseTo(3.08, 2)
  })

  test('inserted word paces at the effective rate, not the fast voiced rate', () => {
    const great = r.path.words.find(w => w.w === 'great')
    expect(rateOf(great)).toBeCloseTo(eff, 2)
    expect(rateOf(great)).toBeGreaterThan(voiced * 1.2)
  })

  test('no word falls outside the band [voiced×0.65, effRate×1.35]', () => {
    for (const w of r.path.words) {
      expect(rateOf(w)).toBeGreaterThanOrEqual(voiced * (1 - SMOOTH_BAND) - 1e-6)
      expect(rateOf(w)).toBeLessThanOrEqual(eff * (1 + SMOOTH_BAND) + 1e-6)
    }
  })
})

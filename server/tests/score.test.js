'use strict'

const { scoreTake, timingScore } = require('../src/lib/score')

// Path: "hello world" on one line, then "foo bar" on a second line.
const PATH = {
  words: [
    { w: 'hello', t_start: 0.0, t_end: 0.5, line: 0 },
    { w: 'world', t_start: 0.5, t_end: 1.0, line: 0 },
    { w: 'foo', t_start: 1.0, t_end: 1.5, line: 1 },
    { w: 'bar', t_start: 1.5, t_end: 2.0, line: 1 }
  ]
}

const ONE_LINE = {
  words: [
    { w: 'hello', t_start: 0.0, t_end: 0.5, line: 0 },
    { w: 'world', t_start: 0.5, t_end: 1.0, line: 0 }
  ]
}

describe('scoreTake (§7)', () => {
  test('perfect take -> 100/100, no flags', () => {
    const spoken = [
      { w: 'hello', start: 0.0 },
      { w: 'world', start: 0.5 },
      { w: 'foo', start: 1.0 },
      { w: 'bar', start: 1.5 }
    ]
    const r = scoreTake(spoken, PATH)
    expect(r.accuracy).toBe(100)
    expect(r.timing).toBe(100)
    expect(r.matched).toBe(4)
    expect(r.flags).toEqual([])
  })

  test('every word 1s late (same rhythm) -> timing 100, no flags', () => {
    const spoken = [
      { w: 'hello', start: 1.0 },
      { w: 'world', start: 1.5 },
      { w: 'foo', start: 2.0 },
      { w: 'bar', start: 2.5 }
    ]
    const r = scoreTake(spoken, PATH)
    expect(r.accuracy).toBe(100)
    expect(r.mean_abs_offset).toBeCloseTo(0, 5) // constant lag normalized away
    expect(r.timing).toBe(100)
    expect(r.flags).toEqual([])
  })

  test('half the words skipped -> accuracy 50 + skipped_line + off_script', () => {
    const spoken = [
      { w: 'hello', start: 0.0 },
      { w: 'world', start: 0.5 }
    ]
    const r = scoreTake(spoken, PATH)
    expect(r.accuracy).toBe(50)
    expect(r.timing).toBe(100) // the two matched words are on time
    const types = r.flags.map(f => f.type)
    expect(types).toContain('skipped_line')
    expect(types).toContain('off_script')
    expect(r.flags).toContainEqual({ type: 'skipped_line', line: 1 })
  })

  test('fillers count as insertions, never matches', () => {
    const spoken = [
      { w: 'um', start: 0.0 },
      { w: 'hello', start: 0.1 },
      { w: 'world', start: 0.6 }
    ]
    const r = scoreTake(spoken, ONE_LINE)
    expect(r.matched).toBe(2)
    expect(r.accuracy).toBe(100)
  })

  test('substitution reduces accuracy', () => {
    const spoken = [
      { w: 'hello', start: 0.0 },
      { w: 'planet', start: 0.5 } // wrong word for "world"
    ]
    const r = scoreTake(spoken, ONE_LINE)
    expect(r.matched).toBe(1)
    expect(r.accuracy).toBe(50)
    expect(r.flags.map(f => f.type)).toContain('off_script')
  })

  test('progressively later delivery -> positive drift (dragging)', () => {
    const spoken = [
      { w: 'hello', start: 0.0 },
      { w: 'world', start: 0.7 },
      { w: 'foo', start: 1.4 },
      { w: 'bar', start: 2.3 }
    ]
    const r = scoreTake(spoken, PATH)
    expect(r.drift).toBeGreaterThan(0)
  })

  test('empty path is handled gracefully', () => {
    const r = scoreTake([{ w: 'hello', start: 0 }], { words: [] })
    expect(r.accuracy).toBe(0)
    expect(r.timing).toBe(0)
    expect(r.flags).toEqual([])
  })

  test('timingScore formula boundaries', () => {
    expect(timingScore(0)).toBe(100)
    expect(timingScore(0.3)).toBe(100)
    expect(timingScore(3.0)).toBe(0)
    expect(timingScore(5)).toBe(0)
    expect(Math.round(timingScore(1.65))).toBe(50) // midpoint
  })
})

// T-1170 — a constant lead/lag is not a rhythm error. PM repro against
// production (2026-07-26): the same clip that set the subtitles scored timing
// 100, while the identical rhythm shifted +1.2s scored 66 with every line
// flagged `dragged_line`. Offsets are now normalized by their median.
describe('timing offset normalization (T-1170)', () => {
  // 5 lines x 4 words, one word every 0.4s, lines 4s apart.
  const WORDS = [
    ['alpha', 'bravo', 'charlie', 'delta'],
    ['echo', 'foxtrot', 'golf', 'hotel'],
    ['india', 'juliet', 'kilo', 'lima'],
    ['mike', 'november', 'oscar', 'papa'],
    ['quebec', 'romeo', 'sierra', 'tango']
  ]
  const LONG_PATH = {
    words: WORDS.flatMap((line, li) =>
      line.map((w, k) => ({ w, t_start: li * 4 + k * 0.4, t_end: li * 4 + k * 0.4 + 0.3, line: li }))
    )
  }
  // Spoken take built from the path, with a per-line time delta applied.
  const takeWith = (delta = () => 0) =>
    LONG_PATH.words.map(p => ({ w: p.w, start: p.t_start + delta(p.line) }))

  test('identical take -> timing 100, no flags (regression)', () => {
    const r = scoreTake(takeWith(), LONG_PATH)
    expect(r.accuracy).toBe(100)
    expect(r.timing).toBe(100)
    expect(r.flags).toEqual([])
  })

  test('uniform +1.2s shift -> timing >= 95, zero rushing/dragging flags', () => {
    const r = scoreTake(takeWith(() => 1.2), LONG_PATH)
    expect(r.accuracy).toBe(100)
    expect(r.timing).toBeGreaterThanOrEqual(95)
    expect(r.flags.filter(f => f.type === 'rushed_line' || f.type === 'dragged_line')).toEqual([])
    expect(r.flags.map(f => f.type)).not.toContain('long_pause')
  })

  test('uniform -1.2s lead (Ariella case) -> timing >= 95, no flags', () => {
    const r = scoreTake(takeWith(() => -1.2), LONG_PATH)
    expect(r.timing).toBeGreaterThanOrEqual(95)
    expect(r.flags).toEqual([])
  })

  test('one line 1.5s fast relative to the rest -> only that line flags rushed', () => {
    const r = scoreTake(takeWith(line => (line === 2 ? -1.5 : 0)), LONG_PATH)
    expect(r.flags).toContainEqual({ type: 'rushed_line', line: 2 })
    expect(r.flags.filter(f => f.type === 'rushed_line')).toHaveLength(1)
    expect(r.flags.filter(f => f.type === 'dragged_line')).toEqual([])
  })

  test('progressive rush (accelerating) -> negative drift still detected', () => {
    const spoken = LONG_PATH.words.map(p => ({ w: p.w, start: p.t_start * 0.85 }))
    const r = scoreTake(spoken, LONG_PATH)
    expect(r.drift).toBeLessThan(-0.1)
  })
})

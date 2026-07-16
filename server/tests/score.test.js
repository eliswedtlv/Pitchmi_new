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

  test('every word 1s late -> timing 74, accuracy 100', () => {
    const spoken = [
      { w: 'hello', start: 1.0 },
      { w: 'world', start: 1.5 },
      { w: 'foo', start: 2.0 },
      { w: 'bar', start: 2.5 }
    ]
    const r = scoreTake(spoken, PATH)
    expect(r.accuracy).toBe(100)
    expect(r.mean_abs_offset).toBeCloseTo(1.0, 5)
    expect(r.timing).toBe(74) // 100 * (3 - 1) / (3 - 0.3) = 74.07 -> 74
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

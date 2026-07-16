'use strict'

const { buildPath } = require('../src/lib/path')

// Original take "hello world": hello 0.0-0.5, world 0.6-1.1 (0.1s pause).
const HELLO_WORLD = [
  { w: 'hello', start: 0.0, end: 0.5 },
  { w: 'world', start: 0.6, end: 1.1 }
]

describe('buildPath (§6)', () => {
  test('empty edit -> empty path, fits, zero duration', () => {
    const r = buildPath(HELLO_WORLD, '', 1)
    expect(r.path.words).toEqual([])
    expect(r.path.lines).toEqual([])
    expect(r.path.total_s).toBe(0)
    expect(r.fits).toBe(true)
    expect(r.warning).toBeNull()
  })

  test('punctuation-only edit -> empty path', () => {
    const r = buildPath(HELLO_WORLD, '!!! ??? ...', 1)
    expect(r.path.words).toEqual([])
    expect(r.fits).toBe(true)
  })

  test('identical edit reproduces original timings', () => {
    const r = buildPath(HELLO_WORLD, 'hello world', 1)
    expect(r.path.words).toHaveLength(2)
    expect(r.path.words[0]).toMatchObject({ w: 'hello', t_start: 0, t_end: 0.5 })
    expect(r.path.words[1]).toMatchObject({ w: 'world', t_start: 0.6, t_end: 1.1 })
    expect(r.path.total_s).toBe(1.1)
    expect(r.fits).toBe(true)
  })

  test('everything replaced -> pure rate-based (no anchors)', () => {
    // Measured rate from original = 0.1 s/char; "aaa"/"bbb" = 3 chars each.
    const r = buildPath(HELLO_WORLD, 'aaa bbb', 1)
    expect(r.path.words).toHaveLength(2)
    expect(r.path.words[0].t_start).toBe(0)
    expect(r.path.words[0].t_end).toBeCloseTo(0.3, 5)
    expect(r.path.words[1].t_start).toBeCloseTo(0.3, 5)
    expect(r.path.total_s).toBe(0.6)
  })

  test('single word anchored keeps original timing', () => {
    const r = buildPath(HELLO_WORLD, 'hello', 1)
    expect(r.path.words).toHaveLength(1)
    expect(r.path.words[0]).toMatchObject({ w: 'hello', t_start: 0, t_end: 0.5 })
  })

  test('inserted words between anchors shift subsequent timing right', () => {
    // "hello brave new world" — brave/new inserted between the two anchors.
    const r = buildPath(HELLO_WORLD, 'hello brave new world', 1)
    expect(r.path.words.map(w => w.w)).toEqual(['hello', 'brave', 'new', 'world'])
    expect(r.path.words[0].t_start).toBe(0)
    // world can no longer sit at 0.6 — it is pushed later than the original end.
    expect(r.path.words[3].t_start).toBeGreaterThan(0.6)
    expect(r.path.total_s).toBeGreaterThan(1.1)
  })

  test('edit that cannot fit 60s -> fits:false with warning', () => {
    const longScript = Array(250).fill('word').join(' ')
    const r = buildPath([], longScript, 1)
    expect(r.fits).toBe(false)
    expect(r.path.total_s).toBeGreaterThan(60)
    expect(typeof r.warning).toBe('string')
    expect(r.warning).toMatch(/cut/i)
  })

  test('RTL Hebrew text (logical order preserved)', () => {
    const heb = [
      { w: 'שלום', start: 0.0, end: 0.5 },
      { w: 'עולם', start: 0.6, end: 1.1 }
    ]
    const r = buildPath(heb, 'שלום עולם', 1)
    expect(r.path.words.map(w => w.w)).toEqual(['שלום', 'עולם'])
    expect(r.path.total_s).toBeCloseTo(1.1, 5)
  })

  test('CJK with no spaces -> grapheme tokens', () => {
    const r = buildPath([], '你好世界', 1)
    expect(r.path.words).toHaveLength(4)
    expect(r.path.words.map(w => w.w)).toEqual(['你', '好', '世', '界'])
  })

  test('numbers are tokens, punctuation is not', () => {
    const r = buildPath([], '123 456', 1)
    expect(r.path.words.map(w => w.w)).toEqual(['123', '456'])
  })

  test('speed extremes scale duration inversely', () => {
    const slow = buildPath(HELLO_WORLD, 'aaa bbb ccc', 0.75)
    const fast = buildPath(HELLO_WORLD, 'aaa bbb ccc', 1.25)
    const base = buildPath(HELLO_WORLD, 'aaa bbb ccc', 1)
    expect(slow.path.total_s).toBeGreaterThan(base.path.total_s)
    expect(fast.path.total_s).toBeLessThan(base.path.total_s)
    // slow (0.75) => factor 1/0.75; fast (1.25) => factor 1/1.25.
    expect(slow.path.total_s).toBeCloseTo(base.path.total_s / 0.75, 1)
    expect(fast.path.total_s).toBeCloseTo(base.path.total_s / 1.25, 1)
  })

  test('speed clamps outside 0.75–1.25', () => {
    const tooSlow = buildPath(HELLO_WORLD, 'aaa bbb', 0.1)
    const clamped = buildPath(HELLO_WORLD, 'aaa bbb', 0.75)
    expect(tooSlow.path.total_s).toBe(clamped.path.total_s)
  })

  test('every word carries a line index and lines are built', () => {
    const r = buildPath([], Array(20).fill('word').join(' '), 1)
    expect(r.path.lines.length).toBeGreaterThan(1)
    for (const w of r.path.words) expect(typeof w.line).toBe('number')
  })
})

'use strict'

// Teleprompter line construction (T-1162 §B). Exercised through buildPath's
// path.lines output. Timing is rate-based here (empty original words) so the
// line *structure* is deterministic and independent of the timing algorithm.

const { buildPath } = require('../src/lib/path')
const { charLen } = require('../src/lib/text')

const linesOf = (script) => buildPath([], script, 1).path.lines

describe('line chunker (§B)', () => {
  test('respects the ~32-char / 6-word cap', () => {
    const lines = linesOf(Array(12).fill('word').join(' '))
    expect(lines.length).toBe(2)
    for (const l of lines) {
      expect(charLen(l.text)).toBeLessThanOrEqual(32)
      expect(l.text.split(' ').length).toBeLessThanOrEqual(6)
    }
  })

  test('prefers a comma boundary over filling the line', () => {
    const lines = linesOf('Hello there, my friends and welcome').map(l => l.text)
    expect(lines[0]).toBe('Hello there')
  })

  test('breaks before a conjunction so the phrase opens the next line', () => {
    const lines = linesOf('Hello there, my friends and welcome').map(l => l.text)
    expect(lines[lines.length - 1]).toBe('and welcome')
  })

  test('Hebrew breaks at the comma (char-based cap, RTL-safe)', () => {
    const lines = linesOf('שלום עולם, מה שלומך').map(l => l.text)
    expect(lines).toEqual(['שלום עולם', 'מה שלומך'])
  })

  test('never leaves a one-word orphan line', () => {
    const lines = linesOf(Array(13).fill('word').join(' '))
    for (const l of lines) {
      expect(l.text.split(' ').length).toBeGreaterThan(1)
    }
  })

  test('never splits a number from its following unit', () => {
    const r = buildPath([], 'aaaa aaaa aaaa aaaa aaaa 10 km rest', 1)
    const num = r.path.words.find(w => w.w === '10')
    const unit = r.path.words.find(w => w.w === 'km')
    expect(num.line).toBe(unit.line)
  })

  test('each line exposes start/end times and words carry the line index', () => {
    const HELLO_WORLD = [
      { w: 'hello', start: 0.0, end: 0.5 },
      { w: 'world', start: 0.6, end: 1.1 }
    ]
    const r = buildPath(HELLO_WORLD, 'hello world', 1)
    expect(r.path.lines).toHaveLength(1)
    expect(r.path.lines[0]).toMatchObject({ index: 0, t_start: 0, t_end: 1.1 })
    for (const w of r.path.words) expect(w.line).toBe(0)
  })
})

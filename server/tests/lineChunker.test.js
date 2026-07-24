'use strict'

// Teleprompter line construction (T-1162 §B, moved to subtitles.js in T-1169).
// Exercised through buildSubtitles's `lines` output. Punctuation rides on the
// word surface (as Scribe delivers it) and drives the phrase-boundary breaks.

const { buildSubtitles } = require('../src/lib/subtitles')
const { charLen } = require('../src/lib/text')

// Turn a list of word surfaces (which may carry trailing punctuation) into a
// timestamped Scribe-style word array with sequential, non-overlapping timings.
const words = (surfaces) => surfaces.map((w, i) => ({ w, start: i * 0.5, end: i * 0.5 + 0.4 }))
const linesOf = (surfaces) => buildSubtitles(words(surfaces)).lines

describe('line chunker (§B)', () => {
  test('respects the ~32-char / 6-word cap', () => {
    const lines = linesOf(Array(12).fill('word'))
    expect(lines.length).toBe(2)
    for (const l of lines) {
      expect(charLen(l.text)).toBeLessThanOrEqual(32)
      expect(l.text.split(' ').length).toBeLessThanOrEqual(6)
    }
  })

  test('prefers a comma boundary over filling the line', () => {
    const lines = linesOf(['Hello', 'there,', 'my', 'friends', 'and', 'welcome']).map(l => l.text)
    expect(lines[0]).toBe('Hello there')
  })

  test('breaks before a conjunction so the phrase opens the next line', () => {
    const lines = linesOf(['Hello', 'there,', 'my', 'friends', 'and', 'welcome']).map(l => l.text)
    expect(lines[lines.length - 1]).toBe('and welcome')
  })

  test('Hebrew breaks at the comma (char-based cap, RTL-safe)', () => {
    const lines = linesOf(['שלום', 'עולם,', 'מה', 'שלומך']).map(l => l.text)
    expect(lines).toEqual(['שלום עולם', 'מה שלומך'])
  })

  test('never leaves a one-word orphan line', () => {
    const lines = linesOf(Array(13).fill('word'))
    for (const l of lines) {
      expect(l.text.split(' ').length).toBeGreaterThan(1)
    }
  })

  test('never splits a number from its following unit', () => {
    const { words: out } = buildSubtitles(words(['aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa', '10', 'km', 'rest']))
    const num = out.find(w => w.w === '10')
    const unit = out.find(w => w.w === 'km')
    expect(num.line).toBe(unit.line)
  })

  test('each line exposes start/end times and words carry the line index', () => {
    const r = buildSubtitles([
      { w: 'hello', start: 0.0, end: 0.5 },
      { w: 'world', start: 0.6, end: 1.1 }
    ])
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0]).toMatchObject({ index: 0, t_start: 0, t_end: 1.1 })
    for (const w of r.words) expect(w.line).toBe(0)
  })
})

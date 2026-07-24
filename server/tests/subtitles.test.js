'use strict'

// Subtitle building (T-1169). Subtitles are the user's spoken words at their
// EXACT recorded timestamps — no rate synthesis, no reflow. buildSubtitles
// receives the already-filler-stripped Scribe words; a filler dropped upstream
// simply widens the gap between the neighbours it leaves behind.

const { buildSubtitles } = require('../src/lib/subtitles')

describe('buildSubtitles (T-1169)', () => {
  test('each word keeps its exact Scribe start/end — no rate synthesis', () => {
    const words = [
      { w: 'we', start: 0.2, end: 0.4 },
      { w: 'shipped', start: 0.6, end: 1.0 },
      { w: 'today', start: 1.1, end: 1.6 }
    ]
    const { words: out, total_s: totalS } = buildSubtitles(words)
    expect(out.map(w => [w.w, w.t_start, w.t_end])).toEqual([
      ['we', 0.2, 0.4],
      ['shipped', 0.6, 1.0],
      ['today', 1.1, 1.6]
    ])
    expect(totalS).toBe(1.6)
  })

  test('a dropped filler leaves a wider gap — neighbours keep their timings', () => {
    // "um" (0.4–0.55) was already stripped upstream; the surrounding words are
    // handed to buildSubtitles untouched and must not be reflowed to close it.
    const words = [
      { w: 'we', start: 0.2, end: 0.4 },
      { w: 'shipped', start: 0.7, end: 1.1 }
    ]
    const { words: out } = buildSubtitles(words)
    expect(out[0]).toMatchObject({ w: 'we', t_start: 0.2, t_end: 0.4 })
    expect(out[1]).toMatchObject({ w: 'shipped', t_start: 0.7, t_end: 1.1 })
    // The 0.3s gap (0.4 -> 0.7) is preserved, not compressed to 0.
    expect(out[1].t_start - out[0].t_end).toBeCloseTo(0.3, 5)
  })

  test('trailing punctuation is stripped from the displayed word', () => {
    const { words: out } = buildSubtitles([
      { w: 'Hello,', start: 0, end: 0.4 },
      { w: 'world.', start: 0.5, end: 1.0 }
    ])
    expect(out.map(w => w.w)).toEqual(['Hello', 'world'])
  })

  test('empty / unusable input -> empty structure, no crash', () => {
    expect(buildSubtitles([])).toEqual({ words: [], lines: [], total_s: 0 })
    expect(buildSubtitles(null)).toEqual({ words: [], lines: [], total_s: 0 })
    expect(buildSubtitles([{ w: '', start: 0, end: 0 }])).toEqual({ words: [], lines: [], total_s: 0 })
  })
})

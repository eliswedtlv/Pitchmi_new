'use strict'

// T-1163 §B: the transcript is now stored as clean-verbatim text (punctuation,
// capitalization, one sentence per line) while original_words keeps the raw STT.
// The §6 path algorithm treats script-vs-original divergence as user edits, so it
// must still anchor the cleaned script against the raw words without crashing.

const { buildPath } = require('../src/lib/path')

// Raw take (Hebrew) with a leading stutter ("היי היי") — the shape original_words
// keeps. Timestamps in seconds.
const RAW_HE = [
  { w: 'היי', start: 0.0, end: 0.4 },
  { w: 'היי', start: 0.4, end: 0.8 },
  { w: 'אני', start: 0.9, end: 1.2 },
  { w: 'רוצה', start: 1.3, end: 1.7 },
  { w: 'להציג', start: 1.8, end: 2.4 },
  { w: 'לכם', start: 2.5, end: 2.9 },
  { w: 'את', start: 3.0, end: 3.2 },
  { w: 'PitchMi', start: 3.3, end: 4.0 },
  { w: 'היום', start: 4.1, end: 4.6 }
]

// Cleaned draft as the editor would hold it: stutter dropped, punctuation added,
// split across two lines with '\n'.
const CLEANED_HE = 'היי, אני רוצה להציג לכם את PitchMi.\nהיום.'

describe('buildPath tolerates a clean-verbatim script vs raw original_words', () => {
  test('anchors are found and the path builds without crashing', () => {
    const r = buildPath(RAW_HE, CLEANED_HE, 1)
    expect(r.path.words.length).toBeGreaterThanOrEqual(7)
    expect(r.path.lines.length).toBeGreaterThanOrEqual(1)
    expect(r.path.total_s).toBeGreaterThan(0)
    // Punctuation ("PitchMi.") normalizes to "PitchMi" and anchors to the raw
    // word at ~3.3s — proof the diff step found the anchor rather than falling
    // back to pure rate extrapolation from t=0.
    const pitch = r.path.words.find(w => /PitchMi/i.test(w.w))
    expect(pitch).toBeDefined()
    expect(pitch.t_start).toBeGreaterThan(2)
    expect(pitch.t_start).toBeLessThan(6)
  })

  test('every word carries a numeric line index', () => {
    const r = buildPath(RAW_HE, CLEANED_HE, 1)
    for (const w of r.path.words) expect(typeof w.line).toBe('number')
  })
})

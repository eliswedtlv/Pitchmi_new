'use strict'

// T-10018 — the typed script inherits REAL timings from a reading of it.
//
// The invariant under test throughout: nothing here synthesizes a pace. A word
// the reading anchored keeps the exact Scribe start/end; a word it did not is
// interpolated between two real neighbours. The monotonic guarantee is checked
// hardest because a violation is completely silent in production — the karaoke
// clock just stops highlighting.

const { buildSeedPath, buildPathFromScript } = require('../src/lib/scriptPath')
const { scoreTake } = require('../src/lib/score')
const config = require('../src/config')

// Reading a script back at a steady pace, optionally substituting or dropping
// words. `mutate(word, index)` returns the spoken surface, or null to skip it.
function read (script, mutate = w => w, { wordS = 0.4, gapS = 0.1, t0 = 0 } = {}) {
  const out = []
  let t = t0
  script.split(/\s+/).filter(Boolean).forEach((w, i) => {
    const said = mutate(w, i)
    if (said !== null) out.push({ w: said, start: round(t), end: round(t + wordS) })
    t += wordS + gapS
  })
  return out
}

function round (n) {
  return Math.round(n * 1000) / 1000
}

function starts (path) {
  return path.words.map(w => w.t_start)
}

function isMonotonic (path) {
  return starts(path).every((s, i, a) => i === 0 || s >= a[i - 1])
}

describe('buildPathFromScript — anchoring (T-10018)', () => {
  test('a perfect reading gives every typed word its exact spoken timestamp', () => {
    const script = 'hello world today'
    const spoken = [
      { w: 'hello', start: 0.2, end: 0.6 },
      { w: 'world', start: 0.7, end: 1.1 },
      { w: 'today', start: 1.3, end: 1.9 }
    ]

    const { path, coverage, matched, total } = buildPathFromScript(script, spoken)

    expect(path.words).toEqual([
      { w: 'hello', t_start: 0.2, t_end: 0.6, line: 0 },
      { w: 'world', t_start: 0.7, t_end: 1.1, line: 0 },
      { w: 'today', t_start: 1.3, t_end: 1.9, line: 0 }
    ])
    expect(matched).toBe(3)
    expect(total).toBe(3)
    expect(coverage).toBe(1)
    expect(path.total_s).toBe(1.9)
  })

  test('punctuation and case in the typed script do not stop a word anchoring', () => {
    const spoken = [
      { w: 'Hello,', start: 0.1, end: 0.5 },
      { w: 'world.', start: 0.6, end: 1.0 },
      { w: 'Ship', start: 1.2, end: 1.6 }
    ]
    const { path, coverage } = buildPathFromScript('hello world ship', spoken)

    expect(coverage).toBe(1)
    expect(starts(path)).toEqual([0.1, 0.6, 1.2])
  })

  test('a skipped word is interpolated strictly between its neighbours', () => {
    const script = 'we shipped the whole thing'
    // The reader jumps straight from "shipped" to "whole".
    const spoken = read(script, (w, i) => (i === 2 ? null : w))

    const { path, matched, total, coverage } = buildPathFromScript(script, spoken)

    const [, shipped, the, whole] = path.words
    expect(the.t_start).toBeGreaterThan(shipped.t_start)
    expect(the.t_start).toBeLessThan(whole.t_start)
    expect(matched).toBe(4)
    expect(total).toBe(5)
    expect(coverage).toBe(0.8)
    expect(isMonotonic(path)).toBe(true)
  })

  test('a mis-heard word is interpolated and counted as a miss', () => {
    const script = 'we shipped it today'
    const spoken = read(script, (w, i) => (i === 1 ? 'shopped' : w))

    const { path, matched, total } = buildPathFromScript(script, spoken)

    const [we, shipped, it] = path.words
    expect(shipped.t_start).toBeGreaterThan(we.t_start)
    expect(shipped.t_start).toBeLessThan(it.t_start)
    expect(matched).toBe(3)
    expect(total).toBe(4)
    expect(isMonotonic(path)).toBe(true)
  })

  test('longer unmatched words get proportionally more of the gap', () => {
    // "a" and "extraordinary" share one gap; the long word must take more time.
    const script = 'start a extraordinary end'
    const spoken = [
      { w: 'start', start: 0, end: 0.5 },
      { w: 'end', start: 4.5, end: 5 }
    ]

    const { path } = buildPathFromScript(script, spoken)
    const [, a, extra] = path.words
    const aDur = extra.t_start - a.t_start
    const extraDur = path.words[3].t_start - extra.t_start

    expect(extraDur).toBeGreaterThan(aDur * 5)
    expect(isMonotonic(path)).toBe(true)
  })

  test('leading and trailing unmatched runs get finite, ordered, non-negative times', () => {
    const script = 'one two three four five six'
    // Only the middle two words are recognised.
    const spoken = [
      { w: 'three', start: 2.0, end: 2.4 },
      { w: 'four', start: 2.5, end: 2.9 }
    ]

    const { path } = buildPathFromScript(script, spoken)

    expect(path.words).toHaveLength(6)
    for (const w of path.words) {
      expect(Number.isFinite(w.t_start)).toBe(true)
      expect(Number.isFinite(w.t_end)).toBe(true)
      expect(w.t_start).toBeGreaterThanOrEqual(0)
      expect(w.t_end).toBeGreaterThanOrEqual(w.t_start)
    }
    expect(isMonotonic(path)).toBe(true)
    expect(starts(path)[2]).toBe(2)
    expect(starts(path)[3]).toBe(2.5)
    // The trailing run really is laid out after the last anchor.
    expect(starts(path)[4]).toBeGreaterThanOrEqual(2.9)
  })

  test('a leading run never produces a negative t_start', () => {
    const script = 'alpha beta gamma delta'
    // The first anchor lands almost immediately, so back-extrapolation would
    // run below zero without the floor.
    const spoken = [
      { w: 'gamma', start: 0.05, end: 0.2 },
      { w: 'delta', start: 0.25, end: 0.4 }
    ]

    const { path } = buildPathFromScript(script, spoken)
    expect(starts(path)[0]).toBeGreaterThanOrEqual(0)
    expect(isMonotonic(path)).toBe(true)
  })

  test('coverage is matched / typed-word-count', () => {
    const script = 'one two three four five six seven eight nine ten'
    // Mangle words 3 and 7 -> 8 of 10 anchored.
    const spoken = read(script, (w, i) => (i === 2 || i === 6 ? `x${w}x` : w))

    const { coverage, matched, total } = buildPathFromScript(script, spoken)
    expect(total).toBe(10)
    expect(matched).toBe(8)
    expect(coverage).toBe(0.8)
  })

  test('duplicate words in the script keep the anchors ordered and monotonic', () => {
    const script = 'this is really really really good work'
    const spoken = read(script)

    const { path, coverage } = buildPathFromScript(script, spoken)
    expect(coverage).toBe(1)
    expect(isMonotonic(path)).toBe(true)
    // Every "really" gets its own distinct beat — no crossed anchors.
    const [, , r1, r2, r3] = starts(path)
    expect(r1).toBeLessThan(r2)
    expect(r2).toBeLessThan(r3)
  })

  test('a 3-word script produces a usable single-line path', () => {
    const { path, total } = buildPathFromScript('ship it now', read('ship it now'))
    expect(total).toBe(3)
    expect(path.words).toHaveLength(3)
    expect(path.lines).toHaveLength(1)
    expect(path.total_s).toBeGreaterThan(0)
  })

  test('a silent reading yields an empty path (the caller answers no_speech)', () => {
    const { path, coverage, matched } = buildPathFromScript('ship it now', [])
    expect(path).toEqual({ words: [], lines: [], total_s: 0 })
    expect(matched).toBe(0)
    expect(coverage).toBe(0)
  })

  test('a completely different reading still yields a well-formed path at coverage 0', () => {
    const spoken = read('totally unrelated sentence spoken instead')
    const { path, coverage } = buildPathFromScript('ship the product today', spoken)

    expect(coverage).toBe(0)
    expect(path.words).toHaveLength(4)
    expect(isMonotonic(path)).toBe(true)
  })

  test('empty script -> empty path, no crash', () => {
    expect(buildPathFromScript('   ', read('anything at all'))).toEqual({
      path: { words: [], lines: [], total_s: 0 },
      coverage: 0,
      matched: 0,
      total: 0
    })
  })
})

describe('buildPathFromScript — monotonic guarantee (fuzz)', () => {
  // Deterministic LCG: a fuzz that cannot reproduce is not a regression test.
  function rng (seed) {
    let s = seed
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648
      return s / 2147483648
    }
  }

  const WORDS = ['ship', 'the', 'product', 'today', 'we', 'are', 'building', 'a', 'tool', 'for', 'founders', 'now']

  test('t_start never decreases over 200 fuzzed script/reading pairs', () => {
    const rand = rng(20180)
    for (let trial = 0; trial < 200; trial++) {
      const n = 3 + Math.floor(rand() * 12)
      const script = Array.from({ length: n }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(' ')
      // Each word is dropped, mangled or read cleanly; pace and gaps vary.
      const spoken = read(
        script,
        w => {
          const r = rand()
          if (r < 0.2) return null
          if (r < 0.4) return `${w}${Math.floor(rand() * 9)}`
          return w
        },
        { wordS: 0.1 + rand() * 0.6, gapS: rand() * 0.8, t0: rand() * 2 }
      )

      const { path } = buildPathFromScript(script, spoken)
      const ts = starts(path)
      for (let i = 1; i < ts.length; i++) {
        if (ts[i] < ts[i - 1]) {
          throw new Error(`trial ${trial}: t_start decreased at ${i} (${ts[i - 1]} -> ${ts[i]}) for "${script}"`)
        }
      }
      expect(ts.every(t => t >= 0)).toBe(true)
    }
  })
})

describe('buildPathFromScript — path shape (the highest-value regression check)', () => {
  const script = 'we are building a tool for founders who hate rehearsing alone'
  const spoken = read(script)
  const { path } = buildPathFromScript(script, spoken)

  test('the shape is identical to a buildSubtitles path', () => {
    for (const w of path.words) {
      expect(Object.keys(w).sort()).toEqual(['line', 't_end', 't_start', 'w'])
      expect(typeof w.w).toBe('string')
      expect(typeof w.line).toBe('number')
    }
    for (const l of path.lines) {
      expect(Object.keys(l).sort()).toEqual(['index', 't_end', 't_start', 'text'])
    }
    expect(typeof path.total_s).toBe('number')
  })

  test('scoreTake runs against it and scores a re-read of the same script highly', () => {
    const res = scoreTake(spoken, path)
    expect(res.path_word_count).toBe(path.words.length)
    expect(res.accuracy).toBe(100)
    expect(res.timing).toBe(100)
    expect(res.flags).toEqual([])
  })
})

describe('buildSeedPath — the disposable take-0 estimate', () => {
  const script = 'We are building a tool for founders, who hate rehearsing alone. It works well.'

  test('emits the same shape as any other path, monotonic and non-negative', () => {
    const path = buildSeedPath(script)

    expect(path.words.length).toBe(14)
    expect(isMonotonic(path)).toBe(true)
    for (const w of path.words) {
      expect(Object.keys(w).sort()).toEqual(['line', 't_end', 't_start', 'w'])
      expect(w.t_start).toBeGreaterThanOrEqual(0)
      expect(w.t_end).toBeGreaterThan(w.t_start)
    }
    for (const l of path.lines) {
      expect(Object.keys(l).sort()).toEqual(['index', 't_end', 't_start', 'text'])
    }
    expect(path.total_s).toBeGreaterThan(0)
  })

  test('word duration is character length at SEED_CHARS_PER_SECOND', () => {
    // "a" (1 char) vs "extraordinary" (13) in a plain, punctuation-free script.
    const path = buildSeedPath('a extraordinary ok')
    const [a, extra] = path.words
    const cps = config.SEED_CHARS_PER_SECOND

    expect(a.t_end - a.t_start).toBeCloseTo(1 / cps, 3)
    expect(extra.t_end - extra.t_start).toBeCloseTo(13 / cps, 3)
  })

  test('honours the punctuation pauses: 80ms plain, 150ms clause, 350ms sentence', () => {
    const path = buildSeedPath('alpha beta, gamma. delta')
    const gapAfter = i => round(path.words[i + 1].t_start - path.words[i].t_end)

    expect(gapAfter(0)).toBeCloseTo(0.08, 3) // alpha -> beta
    expect(gapAfter(1)).toBeCloseTo(0.15, 3) // beta, -> gamma
    expect(gapAfter(2)).toBeCloseTo(0.35, 3) // gamma. -> delta
  })

  test('punctuation is stripped from the rendered surface, as it is for a take', () => {
    expect(buildSeedPath('alpha beta, gamma.').words.map(w => w.w)).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('an empty or whitespace-only script yields an empty path, no crash', () => {
    expect(buildSeedPath('')).toEqual({ words: [], lines: [], total_s: 0 })
    expect(buildSeedPath('   \n ')).toEqual({ words: [], lines: [], total_s: 0 })
  })

  test('a 3-word script is a single usable line', () => {
    const path = buildSeedPath('ship it now')
    expect(path.words).toHaveLength(3)
    expect(path.lines).toHaveLength(1)
  })

  test('Hebrew seeds at the same character rate', () => {
    const path = buildSeedPath('שלום קוראים לי אלי ואני בונה מוצר')
    expect(path.words).toHaveLength(7)
    expect(isMonotonic(path)).toBe(true)
    expect(path.total_s).toBeGreaterThan(0)
  })
})

describe('the prompter text never reflows between the seed and the re-timed path', () => {
  test.each([
    'We are building a tool for founders who hate rehearsing alone, and it works.',
    'Hi. I want to present PitchMi today, because rehearsing in front of a mirror is useless.',
    'שלום קוראים לי אלי ואני בונה מוצר חדש לדוברים',
    'ship it now'
  ])('same words and same line grouping for %s', (script) => {
    const seed = buildSeedPath(script)
    const { path } = buildPathFromScript(script, read(script))

    expect(path.words.map(w => w.w)).toEqual(seed.words.map(w => w.w))
    expect(path.words.map(w => w.line)).toEqual(seed.words.map(w => w.line))
    expect(path.lines.map(l => l.text)).toEqual(seed.lines.map(l => l.text))
  })
})

describe('Hebrew end-to-end', () => {
  const script = 'שלום קוראים לי אלי ואני בונה מוצר חדש לדוברים'

  test('a Hebrew reading of a Hebrew script anchors, stays monotonic and lines up', () => {
    const { path, coverage } = buildPathFromScript(script, read(script))

    expect(coverage).toBeGreaterThan(0.8)
    expect(isMonotonic(path)).toBe(true)
    expect(path.lines.length).toBeGreaterThan(0)
    expect(path.lines.every(l => l.text.trim().length > 0)).toBe(true)
    expect(buildSeedPath(script).lines.map(l => l.text)).toEqual(path.lines.map(l => l.text))
  })

  test('Hebrew punctuation in the typed script does not block anchoring', () => {
    const punctuated = 'שלום, קוראים לי אלי. אני בונה מוצר חדש'
    const { coverage, path } = buildPathFromScript(punctuated, read('שלום קוראים לי אלי אני בונה מוצר חדש'))

    expect(coverage).toBe(1)
    expect(isMonotonic(path)).toBe(true)
  })

  test('a partially improvised Hebrew reading still produces a usable path', () => {
    const spoken = read(script, (w, i) => (i % 3 === 0 ? 'משהו' : w))
    const { path, coverage } = buildPathFromScript(script, spoken)

    expect(coverage).toBeGreaterThan(0.5)
    expect(path.words).toHaveLength(9)
    expect(isMonotonic(path)).toBe(true)
  })
})

describe('partially improvised readings stay usable, not just above threshold', () => {
  const script = 'we are building a tool for founders who hate rehearsing alone today'

  // Mangle every k-th word to land near a target coverage.
  function atCoverage (everyK) {
    const spoken = read(script, (w, i) => (i % everyK === 0 ? `${w}zz` : w))
    return buildPathFromScript(script, spoken)
  }

  test.each([
    [2, 0.45],
    [3, 0.6],
    [5, 0.75]
  ])('every %ith word mangled -> coverage >= %f, path usable', (k, floor) => {
    const { path, coverage, total } = atCoverage(k)

    expect(coverage).toBeGreaterThanOrEqual(floor)
    // "Usable" = one word per typed word, ordered, spanning real time.
    expect(path.words).toHaveLength(total)
    expect(isMonotonic(path)).toBe(true)
    expect(path.total_s).toBeGreaterThan(0)
    // No word is left flat on top of its neighbour for the whole run.
    const distinct = new Set(starts(path))
    expect(distinct.size).toBe(total)
  })
})

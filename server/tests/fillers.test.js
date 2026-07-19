'use strict'

const { isFiller, stripFillers, FILLERS } = require('../src/lib/fillers')

describe('fillers — shared single source of truth (§C)', () => {
  test('isFiller matches vocalised pauses, case/punct-insensitive', () => {
    expect(isFiller('um')).toBe(true)
    expect(isFiller('Uh')).toBe(true)
    expect(isFiller('erm,')).toBe(true)
    expect(isFiller('Hmm')).toBe(true)
  })

  test('real words are never fillers (do not strip "like"/"you"/"so")', () => {
    expect(isFiller('like')).toBe(false)
    expect(isFiller('you')).toBe(false)
    expect(isFiller('so')).toBe(false)
    expect(isFiller('world')).toBe(false)
  })

  test('Hebrew disfluencies are fillers', () => {
    for (const t of ['אה', 'אהה', 'אמ', 'אממ', 'אהם']) {
      expect(isFiller(t)).toBe(true)
    }
    expect(isFiller('שלום')).toBe(false)
  })

  test('stripFillers (EN) removes disfluencies, keeps real words in order', () => {
    const words = [
      { w: 'um', start: 0, end: 0.2 },
      { w: 'hello', start: 0.2, end: 0.6 },
      { w: 'uh', start: 0.6, end: 0.8 },
      { w: 'world', start: 0.8, end: 1.2 }
    ]
    expect(stripFillers(words)).toBe('hello world')
  })

  test('stripFillers (HE) removes disfluencies, keeps real words', () => {
    const words = [
      { w: 'אהה', start: 0, end: 0.2 },
      { w: 'שלום', start: 0.2, end: 0.6 },
      { w: 'עולם', start: 0.6, end: 1.0 }
    ]
    expect(stripFillers(words)).toBe('שלום עולם')
  })

  test('stripFillers prefers an explicit provider disfluency tag over the list', () => {
    // "you know" is a real phrase — only stripped when tagged as a disfluency.
    const words = [
      { w: 'so', start: 0, end: 0.2 },
      { w: 'yknow', start: 0.2, end: 0.4, disfluency: true },
      { w: 'ship', start: 0.4, end: 0.8 }
    ]
    expect(stripFillers(words)).toBe('so ship')
  })

  test('score.js and transcribe share this list (FILLERS is the canonical set)', () => {
    expect(FILLERS.has('um')).toBe(true)
    expect(FILLERS.has('like')).toBe(false)
  })
})

'use strict'

// Eval prompt persona guard (T-1169). Editing is gone, so coach comments are the
// only improvement lever — the prompt now PERMITS pace/timing direction. This
// change must be purely additive: the tough-but-fair persona, the 3×(5–8 words)
// rule, the spoken-language rule and the judge-the-messenger rule stay intact.

const { buildPrompt } = require('../src/lib/evaluate')

describe('eval prompt persona (T-1169)', () => {
  const prompt = buildPrompt({ language: 'Hebrew' })

  test('keeps the messenger-not-message rule', () => {
    expect(prompt).toMatch(/judge the messenger, never the message/i)
  })

  test('keeps the 3-comments / 5–8-words / tough-coach persona', () => {
    expect(prompt).toMatch(/exactly 3 comments/i)
    expect(prompt).toMatch(/5–8 words/)
    expect(prompt).toMatch(/tough startup coach/i)
  })

  test('keeps the spoken-language rule and substitutes the language', () => {
    expect(prompt).toMatch(/spoken language \(Hebrew\)/)
  })

  test('adds the pace/timing coaching allowance (additive)', () => {
    expect(prompt).toMatch(/delivery-pace and timing direction/i)
    // Pace coaching must still be framed as HOW, not WHAT.
    expect(prompt).toMatch(/keep judging the messenger, not the message/i)
  })

  // T-10021: every placeholder must be substituted. An orphaned token left in
  // eval.md would be sent to the model as literal prompt text.
  test('leaves no unsubstituted placeholder', () => {
    expect(prompt).not.toMatch(/\{\{/)
  })

  test('drops the use case and states the 30s cap', () => {
    expect(prompt).not.toMatch(/Use-case adaptation/i)
    expect(prompt).not.toMatch(/≤ ?60 ?seconds/)
    expect(prompt).not.toMatch(/≤60s/)
    expect(prompt).toMatch(/≤ 30 seconds/)
  })
})

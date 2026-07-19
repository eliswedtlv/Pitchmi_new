'use strict'

require('./helpers')
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-openrouter-key'

jest.mock('../src/lib/db', () => require('./mocks/db'))

const { parseResult, evaluateVideo } = require('../src/lib/evaluate')
const dbMock = require('./mocks/db')

const VALID = { voice: 80, body: 82, delivery: 84, comments: ['a', 'b', 'c'] }

beforeEach(() => dbMock.__reset())

describe('parseResult — robust parsing', () => {
  test('valid plain JSON', () => {
    const out = parseResult(JSON.stringify(VALID))
    expect(out).toEqual(VALID)
  })

  test('fenced JSON (```json ... ```)', () => {
    const raw = '```json\n' + JSON.stringify(VALID) + '\n```'
    expect(parseResult(raw)).toEqual(VALID)
  })

  test('JSON with leading + trailing prose', () => {
    const raw = `Sure! Here is the evaluation:\n${JSON.stringify(VALID)}\nHope that helps.`
    expect(parseResult(raw)).toEqual(VALID)
  })

  test('picks the first balanced block, ignoring nested braces', () => {
    const raw = 'noise { "voice": 10, "body": 20, "delivery": 30, "comments": ["x"], "meta": {"k": 1} } trailing'
    const out = parseResult(raw)
    expect(out.voice).toBe(10)
    expect(out.comments).toEqual(['x', '', ''])
  })

  test('garbage → throws', () => {
    expect(() => parseResult('this is not json at all')).toThrow('no JSON object in model output')
  })
})

describe('evaluateVideo — retries + diagnostic logging', () => {
  const origFetch = global.fetch

  afterEach(() => { global.fetch = origFetch })

  function mockOpenRouter (content) {
    let calls = 0
    global.fetch = jest.fn(async () => {
      calls++
      return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) }
    })
    return () => calls
  }

  test('garbage falls through all 3 attempts → error + metadata-only event', async () => {
    const calls = mockOpenRouter('totally not json')
    await expect(evaluateVideo(Buffer.from('v'), 'video/webm', { useCase: 'pitch' }))
      .rejects.toThrow('no JSON object in model output')
    expect(calls()).toBe(3) // initial + retry + stricter retry

    const evt = dbMock.__state.events.find(e => e.action === 'error')
    expect(evt).toBeTruthy()
    expect(evt.error).toMatch(/^eval_parse_fail provider=openrouter len=\d+ fenced=(true|false)$/)
    // Privacy: the model text must never appear in the event.
    expect(evt.error).not.toContain('totally not json')
  })

  test('fenced JSON succeeds on first attempt, no error event', async () => {
    const calls = mockOpenRouter('```json\n' + JSON.stringify(VALID) + '\n```')
    const out = await evaluateVideo(Buffer.from('v'), 'video/webm', { useCase: 'pitch' })
    expect(out).toMatchObject(VALID)
    expect(out.attempts).toBe(1) // stage metadata for the evaluate event
    expect(calls()).toBe(1)
    expect(dbMock.__state.events.find(e => e.action === 'error')).toBeFalsy()
  })
})

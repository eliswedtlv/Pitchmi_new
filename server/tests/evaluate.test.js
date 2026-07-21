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

  function mockOpenRouter (content, provider = 'google-vertex') {
    let calls = 0
    global.fetch = jest.fn(async () => {
      calls++
      return { ok: true, json: async () => ({ provider, choices: [{ message: { content } }] }) }
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
    expect(evt.error).toMatch(/^eval_parse_fail provider=openrouter upstream=\S+ len=\d+ fenced=(true|false)$/)
    // Privacy: the model text must never appear in the event.
    expect(evt.error).not.toContain('totally not json')
  })

  test('fenced JSON succeeds on first attempt, no error event', async () => {
    const calls = mockOpenRouter('```json\n' + JSON.stringify(VALID) + '\n```')
    const out = await evaluateVideo(Buffer.from('v'), 'video/webm', { useCase: 'pitch' })
    expect(out).toMatchObject(VALID)
    expect(out.attempts).toBe(1) // stage metadata for the evaluate event
    expect(out.upstream).toBe('google-vertex') // upstream provider echoed back
    expect(calls()).toBe(1)
    expect(dbMock.__state.events.find(e => e.action === 'error')).toBeFalsy()
  })

  test('request shape: Vertex-only routing + real mime in the video data URL', async () => {
    let captured
    global.fetch = jest.fn(async (_url, opts) => {
      captured = JSON.parse(opts.body)
      return { ok: true, json: async () => ({ provider: 'google-vertex', choices: [{ message: { content: JSON.stringify(VALID) } }] }) }
    })
    await evaluateVideo(Buffer.from('mp4-bytes'), 'video/mp4', { useCase: 'pitch' })

    // Provider routing pins the call to a base64-video-capable backend.
    expect(captured.provider).toMatchObject({ only: ['google-vertex'], allow_fallbacks: false })
    expect(captured.response_format).toEqual({ type: 'json_object' })
    // The content part carries the take's REAL mime, not a hardcoded one.
    const videoPart = captured.messages[0].content.find(c => c.type === 'video_url')
    expect(videoPart.video_url.url.startsWith('data:video/mp4;base64,')).toBe(true)
  })

  test('transient upstream 5xx is retried then succeeds', async () => {
    let calls = 0
    global.fetch = jest.fn(async () => {
      calls++
      if (calls < 3) return { ok: false, status: 500, text: async () => 'Internal Server Error' }
      return { ok: true, json: async () => ({ provider: 'google-vertex', choices: [{ message: { content: JSON.stringify(VALID) } }] }) }
    })
    const out = await evaluateVideo(Buffer.from('v'), 'video/mp4', { useCase: 'pitch' })
    expect(out).toMatchObject(VALID)
    expect(calls).toBe(3) // two 500s + one success, all inside a single parse attempt
  })

  test('persistent upstream 5xx throws without burning JSON retries', async () => {
    let calls = 0
    global.fetch = jest.fn(async () => {
      calls++
      return { ok: false, status: 500, text: async () => 'Internal Server Error' }
    })
    await expect(evaluateVideo(Buffer.from('v'), 'video/mp4', { useCase: 'pitch' }))
      .rejects.toThrow(/OpenRouter 500/)
    expect(calls).toBe(3) // 1 + 2 backoff retries, then surfaced — no extra parse re-calls
  })
})

describe('evaluateVideo — upstream timeouts + deadline (T-1165)', () => {
  const origFetch = global.fetch
  afterEach(() => {
    global.fetch = origFetch
    jest.useRealTimers()
  })

  test('a spent budget short-circuits to a 504-tagged error before any upstream call', async () => {
    let calls = 0
    global.fetch = jest.fn(async () => { calls++; return { ok: true, json: async () => ({}) } })
    await expect(
      evaluateVideo(Buffer.from('v'), 'video/mp4', { useCase: 'pitch' }, { deadline: Date.now() - 1 })
    ).rejects.toMatchObject({ code: 'eval_upstream_timeout', status: 504 })
    expect(calls).toBe(0)
  })

  test('a hung upstream is aborted per attempt, retried, then surfaces a 504 within budget', async () => {
    jest.useFakeTimers()
    let calls = 0
    // Never resolves on its own — only the per-attempt AbortSignal ends it.
    global.fetch = jest.fn((_url, opts) => new Promise((_resolve, reject) => {
      calls++
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')))
    }))

    const deadline = Date.now() + 240000
    const p = evaluateVideo(Buffer.from('v'), 'video/mp4', { useCase: 'pitch' }, { deadline })
    const assertion = expect(p).rejects.toMatchObject({ code: 'eval_upstream_timeout' })

    // Attempt 0 (60s) → backoff 250ms → attempt 1 (60s) → backoff 500ms →
    // attempt 2 (60s) → out of retries → 504. Total ~180.75s, well under 240s.
    await jest.advanceTimersByTimeAsync(60000)
    await jest.advanceTimersByTimeAsync(250)
    await jest.advanceTimersByTimeAsync(60000)
    await jest.advanceTimersByTimeAsync(500)
    await jest.advanceTimersByTimeAsync(60000)

    await assertion
    expect(calls).toBe(3) // retried, never a 4th attempt / never a hang
  })
})

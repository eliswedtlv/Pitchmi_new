'use strict'

require('./helpers')
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-openrouter-key'

const { cleanVerbatim, parseSentences } = require('../src/lib/cleanVerbatim')

describe('parseSentences — shape extraction', () => {
  test('plain JSON with a sentences array', () => {
    const raw = JSON.stringify({ sentences: ['Hello world.', 'This is PitchMi.'] })
    expect(parseSentences(raw)).toEqual(['Hello world.', 'This is PitchMi.'])
  })

  test('tolerates code fences and trims blanks', () => {
    const raw = '```json\n{"sentences":["  A.  ","", "B."]}\n```'
    expect(parseSentences(raw)).toEqual(['A.', 'B.'])
  })

  test('missing/invalid shape -> null', () => {
    expect(parseSentences('not json')).toBeNull()
    expect(parseSentences('{"foo":1}')).toBeNull()
    expect(parseSentences('{"sentences":[]}')).toBeNull()
    expect(parseSentences('')).toBeNull()
  })
})

describe('cleanVerbatim — one text-only LLM call', () => {
  const origFetch = global.fetch
  afterEach(() => { global.fetch = origFetch })

  function mockOnce (content) {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] })
    }))
  }

  test('success -> returns the sentences array (same language)', async () => {
    const content = JSON.stringify({ sentences: ['היי, אני רוצה להציג לכם את PitchMi.', 'בואו נתחיל.'] })
    mockOnce(content)
    const out = await cleanVerbatim('היי היי אני רוצה להציג לכם את PitchMi', 'he')
    expect(out).toEqual(['היי, אני רוצה להציג לכם את PitchMi.', 'בואו נתחיל.'])
    expect(global.fetch).toHaveBeenCalledTimes(1)
    // Text-only: the request body must carry no video/image content parts.
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(typeof body.messages[0].content).toBe('string')
  })

  test('non-ok HTTP -> null (degrade silently)', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }))
    expect(await cleanVerbatim('hello world', 'en')).toBeNull()
  })

  test('network throw -> null', async () => {
    global.fetch = jest.fn(async () => { throw new Error('network') })
    expect(await cleanVerbatim('hello world', 'en')).toBeNull()
  })

  test('empty input -> null without calling the model', async () => {
    global.fetch = jest.fn()
    expect(await cleanVerbatim('   ', 'en')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

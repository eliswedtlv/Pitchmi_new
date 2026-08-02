'use strict'

// T-1172: real cost accounting. STT is billed off the PROBED media duration
// (vendors bill submitted audio, not the end of the last recognised word), and
// the model spend — roughly 45% of a pass and invisible until now — comes from
// OpenRouter's own `usage.cost`, never from a hardcoded price table.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

let mockDurationS = null
jest.mock('../src/lib/audio', () => ({
  extForMime: () => 'webm',
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: mockDurationS }),
  transcodeForEval: async () => ({ buffer: Buffer.from('eval-proxy'), mime: 'video/mp4' })
}))
jest.mock('../src/lib/scribe', () => ({
  transcribe: async () => ({
    text: 'hello world',
    language: 'en',
    // Last word ends at 20s — a take with trailing silence bills longer.
    words: [{ w: 'hello', start: 0, end: 0.5 }, { w: 'world', start: 19.5, end: 20 }],
    duration_s: 20
  })
}))
const mockEval = { evaluateVideo: jest.fn() }
jest.mock('../src/lib/evaluate', () => mockEval)

const request = require('supertest')
const createApp = require('../src/app')
const config = require('../src/config')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const PATH = { words: [{ w: 'hello', t_start: 0, t_end: 0.5, line: 0 }] }
const DELIVERY = { voice: 80, body: 80, delivery: 80, comments: ['a', 'b', 'c'], attempts: 1, upstream: 'google-vertex' }

beforeEach(() => {
  dbMock.__reset()
  mockDurationS = null
  mockEval.evaluateVideo.mockReset().mockResolvedValue(DELIVERY)
})

function post (route) {
  return request(createApp())
    .post(route)
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.webm', contentType: 'video/webm' })
}

describe('Scribe rate + billing basis', () => {
  test('the configured rate is the corrected $0.004/min, not the old $0.007', () => {
    expect(config.SCRIBE_USD_PER_MIN).toBe(0.004)
  })

  // T-10018 deleted /api/transcribe; /api/evaluate is the only billable STT
  // caller left, and it carries the same basis logic unchanged.
  test('STT bills the PROBED media duration, not the last-word-end', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 28 // 8s of trailing silence past the last word at 20s

    expect((await post('/api/evaluate')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(evt.scores.cost.stt_usd).toBeCloseTo((28 / 60) * 0.004, 10)
    expect(evt.scores.cost.media_duration_s).toBe(28)
    expect(evt.scores.cost.basis).toBe('media')
  })

  test('probe failure falls back to the last-word-end and says so', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = null

    expect((await post('/api/evaluate')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(evt.scores.cost.stt_usd).toBeCloseTo((20 / 60) * 0.004, 10)
    expect(evt.scores.cost.media_duration_s).toBeNull()
    expect(evt.scores.cost.basis).toBe('words')
  })
})

describe('evaluate row carries STT + eval spend', () => {
  test('cost_usd = stt + eval, with the split and token counts in scores.cost', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH, language: 'en' })
    mockDurationS = 24
    mockEval.evaluateVideo.mockResolvedValue({
      ...DELIVERY,
      usage: { cost: 0.0031, prompt_tokens: 4200, completion_tokens: 120, total_tokens: 4320 }
    })

    expect((await post('/api/evaluate')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'evaluate')
    const stt = (24 / 60) * 0.004
    expect(evt.scores.cost.stt_usd).toBeCloseTo(stt, 10)
    expect(evt.scores.cost.eval_usd).toBeCloseTo(0.0031, 10)
    expect(evt.cost_usd).toBeCloseTo(stt + 0.0031, 10)
    expect(evt.scores.cost.media_duration_s).toBe(24)
    expect(evt.scores.cost.eval_prompt_tokens).toBe(4200)
    expect(evt.scores.cost.eval_completion_tokens).toBe(120)
  })

  test('a 200 with no usage -> eval_usd null, cost_usd is STT only, no throw', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 24
    mockEval.evaluateVideo.mockResolvedValue(DELIVERY) // no `usage` key at all

    expect((await post('/api/evaluate')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(evt.scores.cost.eval_usd).toBeNull()
    expect(evt.cost_usd).toBeCloseTo((24 / 60) * 0.004, 10)
    expect(evt.scores.cost.eval_prompt_tokens).toBeNull()
  })

  test('gemini-direct reports tokens but no spend -> eval_usd stays null', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 10
    mockEval.evaluateVideo.mockResolvedValue({
      ...DELIVERY,
      upstream: 'gemini-direct',
      usage: { cost: null, prompt_tokens: 3000, completion_tokens: 90, total_tokens: 3090 }
    })

    expect((await post('/api/evaluate')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(evt.scores.cost.eval_usd).toBeNull()
    expect(evt.scores.cost.eval_prompt_tokens).toBe(3000)
    expect(evt.cost_usd).toBeCloseTo((10 / 60) * 0.004, 10)
  })
})

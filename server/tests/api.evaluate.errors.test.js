'use strict'

// T-1165: /api/evaluate must never hang and must log an event row on EVERY
// outcome. These tests drive the route's failure paths by stubbing evaluateVideo.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))
jest.mock('../src/lib/audio', () => ({
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4' }),
  extForMime: () => 'webm'
}))
jest.mock('../src/lib/scribe', () => ({
  transcribe: async () => ({
    text: 'hello world',
    language: 'en',
    words: [{ w: 'hello', start: 0, end: 0.5 }, { w: 'world', start: 0.5, end: 1 }],
    duration_s: 1
  })
}))
const mockEval = { evaluateVideo: jest.fn() }
jest.mock('../src/lib/evaluate', () => mockEval)

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const PATH = { words: [{ w: 'hello', t_start: 0, t_end: 0.5, line: 0 }] }

beforeEach(() => {
  dbMock.__reset()
  mockEval.evaluateVideo.mockReset()
})

function evalRequest (app) {
  return request(app).post('/api/evaluate')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), 'take.webm')
}

describe('POST /api/evaluate — guaranteed event on every outcome', () => {
  test('upstream timeout -> 504 eval_upstream_timeout + a single error event with timings', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    const err = Object.assign(new Error('eval_upstream_timeout'), { code: 'eval_upstream_timeout', status: 504 })
    mockEval.evaluateVideo.mockRejectedValue(err)

    const res = await evalRequest(createApp())
    expect(res.status).toBe(504)
    expect(res.body).toEqual({ error: 'eval_upstream_timeout' })

    const errors = dbMock.__state.events.filter(e => e.action === 'error')
    expect(errors).toHaveLength(1) // exactly one row — not double-logged
    expect(errors[0].error).toBe('eval_upstream_timeout')
    expect(typeof errors[0].scores.timings.scribe_ms).toBe('number')
    expect(typeof errors[0].scores.timings.eval_ms).toBe('number')
    expect(typeof errors[0].latency_ms).toBe('number')
  })

  test('generic eval failure -> 500 server_error + a single error event with timings', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockEval.evaluateVideo.mockRejectedValue(new Error('OpenRouter 500: boom'))

    const res = await evalRequest(createApp())
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('server_error')

    const errors = dbMock.__state.events.filter(e => e.action === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].error).toMatch(/OpenRouter 500/)
    expect(typeof errors[0].scores.timings.scribe_ms).toBe('number')
  })

  test('success -> 200 + exactly one evaluate event, no error rows', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH, use_case: 'pitch', language: 'en' })
    mockEval.evaluateVideo.mockResolvedValue({
      voice: 80, body: 80, delivery: 80, comments: ['a', 'b', 'c'], attempts: 2, upstream: 'google-vertex'
    })

    const res = await evalRequest(createApp())
    expect(res.status).toBe(200)
    expect(dbMock.__state.events.filter(e => e.action === 'evaluate')).toHaveLength(1)
    expect(dbMock.__state.events.filter(e => e.action === 'error')).toHaveLength(0)
  })
})

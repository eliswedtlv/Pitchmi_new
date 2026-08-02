'use strict'

// T-1172: the 30s cap is enforced SERVER-side on the upload route — the
// browser cap is only a browser cap. An over-limit take must be rejected with
// 413 take_too_long BEFORE Scribe is called (that is the whole point: pay the
// decode we already ran, skip the billable STT call), and an unreadable
// duration must fail OPEN.
//
// T-10018 deleted /api/transcribe, so /api/evaluate is the only upload route
// left; the cap and its ordering guarantees are unchanged.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

// The probed duration is driven per-test.
let mockDurationS = null
jest.mock('../src/lib/audio', () => ({
  extForMime: () => 'webm',
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: mockDurationS }),
  transcodeForEval: async () => ({ buffer: Buffer.from('eval-proxy'), mime: 'video/mp4' })
}))

const mockScribe = { transcribe: jest.fn() }
jest.mock('../src/lib/scribe', () => mockScribe)
const mockEval = { evaluateVideo: jest.fn() }
jest.mock('../src/lib/evaluate', () => mockEval)

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const PATH = { words: [{ w: 'hello', t_start: 0, t_end: 0.5, line: 0 }] }

const SCRIBE_OK = {
  text: 'hello world',
  language: 'en',
  words: [{ w: 'hello', start: 0, end: 0.5 }, { w: 'world', start: 0.5, end: 1 }],
  duration_s: 1
}

beforeEach(() => {
  dbMock.__reset()
  mockDurationS = null
  mockScribe.transcribe.mockReset().mockResolvedValue(SCRIBE_OK)
  mockEval.evaluateVideo.mockReset().mockResolvedValue({
    voice: 80, body: 80, delivery: 80, comments: ['a', 'b', 'c'], attempts: 1, upstream: 'google-vertex'
  })
})

function post (route) {
  return request(createApp())
    .post(route)
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.webm', contentType: 'video/webm' })
}

describe.each(['/api/evaluate'])('%s — 30s hard cap', (route) => {
  test('45s take -> 413 take_too_long, Scribe NEVER called, error event logged', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 45

    const res = await post(route)

    expect(res.status).toBe(413)
    expect(res.body.error).toBe('take_too_long')
    expect(res.body.limit_s).toBe(30)
    expect(res.body.message.en).toMatch(/30 seconds/)
    expect(typeof res.body.message.he).toBe('string')
    // The entire point of the check: no billable STT call on a rejected take.
    expect(mockScribe.transcribe).not.toHaveBeenCalled()
    expect(mockEval.evaluateVideo).not.toHaveBeenCalled()

    const errors = dbMock.__state.events.filter(e => e.action === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].error).toBe('take_too_long')
    expect(errors[0].duration_s).toBe(45)
  })

  test('32s take -> passes (inside the 3s tolerance for MediaRecorder slop)', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 32

    const res = await post(route)

    expect(res.status).toBe(200)
    expect(mockScribe.transcribe).toHaveBeenCalledTimes(1)
    expect(dbMock.__state.events.filter(e => e.error === 'take_too_long')).toHaveLength(0)
  })

  test('exactly 30s -> passes (the cap does not reject AT the limit)', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 30

    expect((await post(route)).status).toBe(200)
    expect(mockScribe.transcribe).toHaveBeenCalledTimes(1)
  })

  test('unreadable duration (null) -> fails OPEN, request proceeds as before', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = null

    expect((await post(route)).status).toBe(200)
    expect(mockScribe.transcribe).toHaveBeenCalledTimes(1)
  })
})

describe('/api/evaluate — cap ordering', () => {
  test('the daily quota still answers first, so quota semantics are unchanged', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    dbMock.__state.evalCountToday = 25
    mockDurationS = 45

    const res = await post('/api/evaluate')
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: 'daily_limit', limit: 25 })
  })

  test('a silent OVER-limit take is rejected as too long, before Scribe', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 45
    mockScribe.transcribe.mockResolvedValue({ words: [], language: 'en', duration_s: 0 })

    const res = await post('/api/evaluate')
    expect(res.status).toBe(413)
    expect(res.body.error).toBe('take_too_long')
    expect(mockScribe.transcribe).not.toHaveBeenCalled()
  })

  test('a silent within-limit take is still scored (a bad take is not an error)', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 12
    mockScribe.transcribe.mockResolvedValue({ words: [], language: 'en', duration_s: 0 })

    const res = await post('/api/evaluate')
    expect(res.status).toBe(200)
    expect(res.body.dimensions.accuracy).toBe(0)
  })
})

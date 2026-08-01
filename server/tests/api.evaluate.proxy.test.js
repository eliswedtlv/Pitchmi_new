'use strict'

// T-1166: the eval proxy is transcoded before the upstream call, and an
// oversized proxy (>18MB) is rejected with 413 take_too_large before any
// provider call. A large proxy buffer drives the guard.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))
jest.mock('../src/lib/audio', () => ({
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: 12 }),
  // 19MB proxy — just over the 18MB EVAL_MAX_BYTES ceiling.
  transcodeForEval: async () => ({ buffer: Buffer.alloc(19 * 1024 * 1024), mime: 'video/mp4' }),
  extForMime: () => 'webm'
}))
jest.mock('../src/lib/scribe', () => ({
  transcribe: async () => ({
    text: 'hello world',
    language: 'en',
    words: [{ w: 'hello', start: 0, end: 0.5 }],
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

describe('POST /api/evaluate — oversized proxy guard (T-1166)', () => {
  test('proxy over 18MB -> 413 take_too_large, no upstream call, error event logged', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    const res = await evalRequest(createApp())

    expect(res.status).toBe(413)
    expect(res.body.error).toBe('take_too_large')
    expect(res.body.message.en).toMatch(/too large/i)
    expect(typeof res.body.message.he).toBe('string')
    // The upstream provider is never called for an oversized proxy.
    expect(mockEval.evaluateVideo).not.toHaveBeenCalled()

    const errors = dbMock.__state.events.filter(e => e.action === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].error).toBe('take_too_large')
    expect(errors[0].scores.timings.video_bytes_eval).toBe(19 * 1024 * 1024)
  })
})

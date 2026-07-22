'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))
jest.mock('../src/lib/audio', () => ({
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4' }),
  transcodeForEval: async () => ({ buffer: Buffer.from('eval-proxy'), mime: 'video/mp4' }),
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
jest.mock('../src/lib/evaluate', () => ({
  evaluateVideo: async () => ({ voice: 80, body: 82, delivery: 84, comments: ['tighten the open', 'lift your energy', 'land the finish'] })
}))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const PATH = {
  words: [
    { w: 'hello', t_start: 0, t_end: 0.5, line: 0 },
    { w: 'world', t_start: 0.5, t_end: 1, line: 0 }
  ]
}

beforeEach(() => dbMock.__reset())

function evalRequest (app) {
  return request(app).post('/api/evaluate')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), 'take.webm')
}

describe('POST /api/evaluate', () => {
  test('#9 e2e (mocked) -> §9 shape + event with latency+cost', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH, use_case: 'pitch', language: 'en' })
    const res = await evalRequest(createApp())
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      dimensions: { voice: 80, body: 82, delivery: 84, timing: 100, accuracy: 100 },
      comments: ['tighten the open', 'lift your energy', 'land the finish'],
      flags: [],
      language: 'en'
    })
    // overall = 0.5*mean(80,82,84) + 0.25*100 + 0.25*100 = 41 + 25 + 25 = 91
    expect(res.body.overall).toBe(91)
    expect(res.body.evals_left_today).toBe(24)

    const evt = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(evt).toBeTruthy()
    expect(typeof evt.latency_ms).toBe('number')
    expect(typeof evt.cost_usd).toBe('number')
    // Stage timings ride along as numeric metadata (privacy rule kept).
    expect(typeof evt.scores.timings.scribe_ms).toBe('number')
    expect(typeof evt.scores.timings.eval_ms).toBe('number')
    // T-1166: transcode + payload sizes ride along as numeric metadata.
    expect(typeof evt.scores.timings.transcode_ms).toBe('number')
    expect(evt.scores.timings.video_bytes_in).toBe(Buffer.from('fake-video-bytes').length)
    expect(evt.scores.timings.video_bytes_eval).toBe(Buffer.from('eval-proxy').length)
    expect(evt.scores.timings.attempts).toBe(1)
  })

  test('#10 no Storage write during evaluate', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    await evalRequest(createApp())
    expect(dbMock.__state.uploads).toHaveLength(0)
  })

  test('#5 daily cap: 26th evaluate -> 429 daily_limit', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    dbMock.__state.evalCountToday = 25 // already at the limit
    const res = await evalRequest(createApp())
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: 'daily_limit', limit: 25 })
  })
})

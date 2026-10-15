'use strict'

// T-1172: real cost accounting. STT is billed off the PROBED media duration
// Vendors bill submitted audio, not the end of the last recognised word.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

let mockDurationS = null
jest.mock('../src/lib/audio', () => ({
  extForMime: () => 'webm',
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: mockDurationS })
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

const request = require('supertest')
const createApp = require('../src/app')
const config = require('../src/config')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const PATH = { words: [{ w: 'hello', t_start: 0, t_end: 0.5, line: 0 }] }

beforeEach(() => {
  dbMock.__reset()
  mockDurationS = null
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

  // T-10018 deleted /api/transcribe; /api/rhythm is the only billable STT
  // caller left, and it carries the same basis logic unchanged.
  test('STT bills the PROBED media duration, not the last-word-end', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = 28 // 8s of trailing silence past the last word at 20s

    expect((await post('/api/rhythm')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'rhythm')
    expect(evt.scores.cost.stt_usd).toBeCloseTo((28 / 60) * 0.004, 10)
    expect(evt.scores.cost.media_duration_s).toBe(28)
    expect(evt.cost_usd).toBeCloseTo((28 / 60) * 0.004, 10)
    expect(Object.keys(evt.scores.cost).sort()).toEqual(['media_duration_s', 'stt_usd'])
  })

  test('probe failure falls back to the last-word-end and says so', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PATH })
    mockDurationS = null

    expect((await post('/api/rhythm')).status).toBe(200)

    const evt = dbMock.__state.events.find(e => e.action === 'rhythm')
    expect(evt.scores.cost.stt_usd).toBeCloseTo((20 / 60) * 0.004, 10)
    expect(evt.scores.cost.media_duration_s).toBeNull()
  })
})

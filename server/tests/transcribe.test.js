'use strict'

require('./helpers')
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-openrouter-key'

jest.mock('../src/lib/db', () => require('./mocks/db'))
// Keep the route pure: audio extraction and Scribe are exercised elsewhere.
jest.mock('../src/lib/audio', () => ({
  extForMime: () => 'mp4',
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mpeg' })
}))
jest.mock('../src/lib/scribe', () => ({
  transcribe: async () => ({
    // Raw STT with a disfluency ("um") and a stutter ("we we").
    words: [
      { w: 'um', start: 0.0, end: 0.2, type: 'disfluency' },
      { w: 'we', start: 0.2, end: 0.4 },
      { w: 'we', start: 0.4, end: 0.6 },
      { w: 'shipped', start: 0.6, end: 1.0 }
    ],
    language: 'en',
    duration_s: 1.0
  })
}))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const origFetch = global.fetch
beforeEach(() => dbMock.__reset())
afterEach(() => { global.fetch = origFetch })

// Deterministic filler-strip of the mocked Scribe output ("um" removed).
const DETERMINISTIC = 'we we shipped'

function post () {
  return request(createApp())
    .post('/api/transcribe')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.mp4', contentType: 'video/mp4' })
}

describe('POST /api/transcribe — clean-verbatim draft (T-1163 §B)', () => {
  test('stores the cleaned sentences (joined with \\n) on success', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ sentences: ['We shipped.', 'It works.'] }) } }]
      })
    }))
    const res = await post()
    expect(res.status).toBe(200)
    expect(res.body.text).toBe('We shipped.\nIt works.')
    expect(dbMock.__state.projects.get('proj-1').script).toBe('We shipped.\nIt works.')
    // clean_ms is logged into the transcribe event metadata.
    const ev = dbMock.__state.events.find(e => e.action === 'transcribe')
    expect(typeof ev.clean_ms).toBe('number')
  })

  test('falls back to deterministic text when the LLM cleanup fails (still 200)', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }))
    const res = await post()
    expect(res.status).toBe(200)
    expect(res.body.text).toBe(DETERMINISTIC)
    expect(dbMock.__state.projects.get('proj-1').script).toBe(DETERMINISTIC)
    // original_words keeps the FULL raw list (fillers included) for /api/path.
    expect(dbMock.__state.projects.get('proj-1').original_words).toHaveLength(4)
  })
})

'use strict'

require('./helpers')

jest.mock('../src/lib/db', () => require('./mocks/db'))
// Keep the route pure: audio extraction is exercised elsewhere; Scribe output is
// driven per-test via mockScribe.
jest.mock('../src/lib/audio', () => ({
  extForMime: () => 'mp4',
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mpeg', duration_s: 12 })
}))
let mockScribe
jest.mock('../src/lib/scribe', () => ({ transcribe: async () => mockScribe }))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

beforeEach(() => dbMock.__reset())

function post () {
  return request(createApp())
    .post('/api/transcribe')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.mp4', contentType: 'video/mp4' })
}

describe('POST /api/transcribe — zero-edit subtitles (T-1169)', () => {
  test('subtitle words carry the SURVIVING Scribe timestamps exactly (no rate synthesis, no reflow)', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    mockScribe = {
      // Raw STT: a leading tagged disfluency ("um") and a list filler ("uh")
      // between two real words. Both are stripped; the survivors are untouched.
      words: [
        { w: 'um', start: 0.0, end: 0.2, type: 'disfluency' },
        { w: 'we', start: 0.3, end: 0.5 },
        { w: 'shipped', start: 0.6, end: 1.0 },
        { w: 'uh', start: 1.0, end: 1.05 },
        { w: 'today', start: 1.2, end: 1.7 }
      ],
      language: 'en',
      duration_s: 1.7
    }

    const res = await post()
    expect(res.status).toBe(200)
    expect(res.body.language).toBe('en')
    expect(res.body.script).toBe('we shipped today')
    // Every subtitle word == the exact Scribe timing of the surviving word.
    expect(res.body.path.words).toEqual([
      { w: 'we', t_start: 0.3, t_end: 0.5, line: 0 },
      { w: 'shipped', t_start: 0.6, t_end: 1.0, line: 0 },
      { w: 'today', t_start: 1.2, t_end: 1.7, line: 0 }
    ])
    // Persisted for karaoke/results.
    expect(dbMock.__state.projects.get('proj-1').path.words).toHaveLength(3)
  })

  test('a filler between two words becomes a gap — the neighbours keep their timings', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    mockScribe = {
      words: [
        { w: 'we', start: 0.2, end: 0.4 },
        { w: 'um', start: 0.45, end: 0.6, type: 'disfluency' },
        { w: 'shipped', start: 0.7, end: 1.1 }
      ],
      language: 'en',
      duration_s: 1.1
    }

    const res = await post()
    expect(res.status).toBe(200)
    const [we, shipped] = res.body.path.words
    expect(we).toMatchObject({ w: 'we', t_start: 0.2, t_end: 0.4 })
    expect(shipped).toMatchObject({ w: 'shipped', t_start: 0.7, t_end: 1.1 })
    // The dropped "um" widens the gap; nothing is reflowed to close it.
    expect(shipped.t_start - we.t_end).toBeCloseTo(0.3, 5)
  })

  test('no usable words (silent take) -> 422 no_speech, does not crash', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    mockScribe = {
      words: [{ w: 'um', start: 0.0, end: 0.2, type: 'disfluency' }],
      language: 'en',
      duration_s: 0.2
    }

    const res = await post()
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('no_speech')
  })
})

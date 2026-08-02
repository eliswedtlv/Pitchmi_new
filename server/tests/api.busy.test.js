'use strict'

// T-10010: with the media slots full and the queue at its bound, a further
// upload is refused with 503 `busy` instead of piling up. The limiter reads its
// bounds at require time, so the env is set before the app is loaded.

process.env.MEDIA_CONCURRENCY = '1'
process.env.MEDIA_QUEUE_MAX = '0'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

// extractAudio parks until the test lets it finish, so the slot stays occupied.
let release = null
const mockAudio = {
  extractAudio: jest.fn(() => new Promise(resolve => {
    release = () => resolve({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: 5 })
  })),
  transcodeForEval: jest.fn(async () => ({ buffer: Buffer.from('eval-proxy'), mime: 'video/mp4' }))
}
jest.mock('../src/lib/audio', () => mockAudio)
jest.mock('../src/lib/scribe', () => ({
  transcribe: async () => ({
    text: 'hello', language: 'en', words: [{ w: 'hello', start: 0, end: 0.5 }], duration_s: 0.5
  })
}))
jest.mock('../src/lib/evaluate', () => ({
  evaluateVideo: async () => ({ voice: 80, body: 80, delivery: 80, comments: ['a', 'b', 'c'], attempts: 1 })
}))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')
const { userToken } = require('./helpers')

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
  release = null
})

function post (app) {
  return request(app)
    .post('/api/evaluate')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.webm', contentType: 'video/webm' })
}

test('an upload arriving with the media queue full gets 503 busy', async () => {
  const app = createApp()
  dbMock.__seedProject('proj-1', 'user-1', {
    path: { words: [{ w: 'hello', t_start: 0, t_end: 0.5, line: 0 }] }
  })

  // .then() is what actually dispatches a superagent request — without it the
  // first upload would never leave the starting line and never take the slot.
  const first = post(app).then(res => res)
  await new Promise((resolve, reject) => {
    let waited = 0
    const check = () => {
      if (release) return resolve()
      if ((waited += 5) > 3000) return reject(new Error('first request never took the media slot'))
      setTimeout(check, 5)
    }
    check()
  })

  const second = await post(app)
  expect(second.status).toBe(503)
  expect(second.body).toEqual({ error: 'busy' })

  release()
  expect((await first).status).toBe(200)
})

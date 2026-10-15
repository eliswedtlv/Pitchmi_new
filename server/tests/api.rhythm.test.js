'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))
const mockAudio = { extractAudio: jest.fn() }
jest.mock('../src/lib/audio', () => mockAudio)
const mockScribe = { transcribe: jest.fn() }
jest.mock('../src/lib/scribe', () => mockScribe)

const request = require('supertest')
const createApp = require('../src/app')
const db = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')
const { userToken } = require('./helpers')

beforeEach(() => {
  db.__reset()
  rateLimit.__resetAll()
  db.__seedProject('proj-1', 'user-1', { script: 'hello brave world', path: null })
  mockAudio.extractAudio.mockReset().mockResolvedValue({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: 12 })
  mockScribe.transcribe.mockReset().mockResolvedValue({
    words: ['hello', 'brave', 'world'].map((w, i) => ({ w, start: i, end: i + 0.5 })),
    language: 'en',
    duration_s: 2.5
  })
})

function post (project = 'proj-1', video = true, user = 'user-1') {
  const req = request(createApp()).post('/api/rhythm')
    .set('Authorization', `Bearer ${userToken(user)}`)
  if (project) req.field('project_id', project)
  if (video) req.attach('video', Buffer.from('fake-video'), 'take.webm')
  return req
}

test('success returns exactly the rhythm contract and metadata, with no Storage writes', async () => {
  const res = await post()
  expect(res.status).toBe(200)
  expect(res.body).toEqual({
    path: expect.objectContaining({ words: expect.any(Array), lines: expect.any(Array), total_s: 2.5 }),
    coverage: 1,
    language: 'en',
    rhythms_left_today: 24
  })
  expect(db.__state.projects.get('proj-1').path).toEqual(res.body.path)
  expect(db.__state.uploads).toHaveLength(0)
  expect(db.__state.events).toHaveLength(1)
  const event = db.__state.events[0]
  expect(event).toMatchObject({ action: 'rhythm', duration_s: 12, language: 'en', scores: { coverage: 1, retimed: 1 } })
  expect(typeof event.scores.timings.scribe_ms).toBe('number')
  expect(event.cost_usd).toBeCloseTo(12 / 60 * 0.004)
  expect(JSON.stringify(event)).not.toMatch(/hello|brave|world|fake-video/)
})

test('coverage exactly at the threshold stores the measured rhythm', async () => {
  db.__state.projects.get('proj-1').script = 'hello brave world today'
  mockScribe.transcribe.mockResolvedValue({ words: [{ w: 'hello', start: 0, end: 1 }, { w: 'world', start: 2, end: 3 }], language: 'en', duration_s: 3 })
  const res = await post()
  expect(res.status).toBe(200)
  expect(res.body.coverage).toBe(0.5)
  expect(res.body.path).not.toBeNull()
})

test.each([
  [null, true, 'missing_project_id'],
  ['proj-1', false, 'missing_video']
])('missing input returns 400 %s', async (project, video, error) => {
  const res = await post(project, video)
  expect(res.status).toBe(400)
  expect(res.body).toEqual({ error })
  expect(mockAudio.extractAudio).not.toHaveBeenCalled()
})

test('project ownership is required', async () => {
  const res = await post('proj-1', true, 'someone-else')
  expect(res.status).toBe(404)
  expect(res.body).toEqual({ error: 'project_not_found' })
  expect(mockAudio.extractAudio).not.toHaveBeenCalled()
})

test('daily limit is enforced before decoding', async () => {
  db.__state.evalCountToday = 25
  const res = await post()
  expect(res.status).toBe(429)
  expect(res.body).toEqual({ error: 'daily_limit', limit: 25 })
  expect(mockAudio.extractAudio).not.toHaveBeenCalled()
})

test.each([
  ['busy', 503, 'busy'],
  ['UNSUPPORTED_MEDIA_TYPE', 415, 'unsupported_media_type'],
  ['decode_failed', 500, 'server_error']
])('decode failure %s uses the existing error shape', async (code, status, error) => {
  mockAudio.extractAudio.mockRejectedValue(Object.assign(new Error('private details'), { code }))
  const res = await post()
  expect(res.status).toBe(status)
  expect(res.body).toEqual({ error })
  expect(mockScribe.transcribe).not.toHaveBeenCalled()
  expect(db.__state.events).toHaveLength(1)
  expect(db.__state.events[0]).toMatchObject({ action: 'error', error })
})

test('Scribe failure returns 500 and one content-free error event', async () => {
  mockScribe.transcribe.mockRejectedValue(new Error('private upstream response'))
  const res = await post()
  expect(res.status).toBe(500)
  expect(res.body).toEqual({ error: 'server_error' })
  expect(db.__state.events).toHaveLength(1)
  expect(JSON.stringify(db.__state.events)).not.toContain('private')
})

test('missing language falls back to the project language, then null', async () => {
  mockScribe.transcribe.mockResolvedValue({ words: [], duration_s: 0 })
  const project = db.__state.projects.get('proj-1')
  project.language = 'he'
  expect((await post()).body.language).toBe('he')
  project.language = null
  expect((await post()).body.language).toBeNull()
})

test('the removed evaluation route returns 404', async () => {
  expect((await request(createApp()).post('/api/evaluate')).status).toBe(404)
})

// Launch blocker 2026-10-15: a karaoke take 2 with no audio track made
// ffmpeg fail and /api/rhythm answered 500 server_error.
test('a take with no usable audio answers 422 no_audio, not 500', async () => {
  mockAudio.extractAudio.mockRejectedValue(Object.assign(new Error('no_audio'), { code: 'NO_AUDIO' }))
  const res = await post()
  expect(res.status).toBe(422)
  expect(res.body.error).toBe('no_audio')
  expect(mockScribe.transcribe).not.toHaveBeenCalled()
  expect(db.__state.events.at(-1)).toMatchObject({ action: 'error', error: 'no_audio' })
})

test('Hebrew take 2 re-times an existing Hebrew rhythm', async () => {
  const script = 'שלום, קוראים לי דנה. אנחנו עוזרים למרפאות קטנות.'
  const spoken = ['שלום', 'קוראים', 'לי', 'דנה', 'אנחנו', 'עוזרים', 'למרפאות', 'קטנות']
  db.__state.projects.get('proj-1').script = script
  mockScribe.transcribe.mockResolvedValue({ words: spoken.map((w, i) => ({ w, start: i, end: i + 0.5 })), language: 'heb', duration_s: 8 })
  const take1 = await post()
  expect(take1.status).toBe(200)
  expect(take1.body.path.words[0].w).toBe('שלום,')

  mockScribe.transcribe.mockResolvedValue({ words: spoken.map((w, i) => ({ w, start: 1 + i * 0.8, end: 1.4 + i * 0.8 })), language: 'heb', duration_s: 7.5 })
  const take2 = await post()
  expect(take2.status).toBe(200)
  expect(take2.body.coverage).toBe(1)
  expect(take2.body.path.words[1].t_start).toBeCloseTo(1.8)
  expect(db.__state.projects.get('proj-1').path).toEqual(take2.body.path)
})

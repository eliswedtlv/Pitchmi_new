'use strict'

// T-10018 — /api/evaluate learns the user's real pace from every take.
//
// The ordering here is the whole point and is asserted directly: the take is
// SCORED against the path it actually followed, and only afterwards realigned
// to produce the path the NEXT take will follow. Get that backwards and every
// take is judged against timings derived from itself, so timing accuracy always
// reads ~100 and means nothing.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

jest.mock('../src/lib/audio', () => ({
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: 12 }),
  transcodeForEval: async () => ({ buffer: Buffer.from('eval-proxy'), mime: 'video/mp4' })
}))

const mockScribe = { transcribe: jest.fn() }
jest.mock('../src/lib/scribe', () => mockScribe)
const mockEval = { evaluateVideo: jest.fn() }
jest.mock('../src/lib/evaluate', () => mockEval)

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')
const { buildSeedPath } = require('../src/lib/scriptPath')
const { userToken } = require('./helpers')

const SCRIPT = 'we are building a tool for founders who hate rehearsing alone'
const SEED = buildSeedPath(SCRIPT)

// A delivery of SCRIPT that is much SLOWER than the seed, so a re-timed path is
// unmistakably different from the seed it replaces.
function spokenSlow (mutate = w => w) {
  const out = []
  let t = 1
  SCRIPT.split(' ').forEach((w, i) => {
    const said = mutate(w, i)
    if (said !== null) out.push({ w: said, start: round(t), end: round(t + 0.6) })
    t += 0.9
  })
  return out
}

function round (n) {
  return Math.round(n * 1000) / 1000
}

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
  mockScribe.transcribe.mockReset().mockResolvedValue({
    text: SCRIPT, language: 'en', words: spokenSlow(), duration_s: 11
  })
  mockEval.evaluateVideo.mockReset().mockResolvedValue({
    voice: 80, body: 80, delivery: 80, comments: ['a', 'b', 'c'], attempts: 1, upstream: 'google-vertex'
  })
})

function post () {
  return request(createApp())
    .post('/api/evaluate')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.webm', contentType: 'video/webm' })
}

describe('POST /api/evaluate — re-timing the prompter (T-10018)', () => {
  test('scores against the OLD path, then returns and stores the NEW one', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })

    const res = await post()

    expect(res.status).toBe(200)
    // Scored against the seed: the take runs at roughly half the seed's pace,
    // so timing must NOT be a perfect 100 — that is the proof it was not
    // scored against a path derived from itself.
    expect(res.body.dimensions.timing).toBeLessThan(100)
    expect(res.body.dimensions.accuracy).toBe(100)

    // Re-timed: every word carries the moment it was really said.
    expect(res.body.path.words).toHaveLength(11)
    expect(res.body.path.words[0].t_start).toBe(1)
    expect(res.body.path.words.map(w => w.w)).toEqual(SEED.words.map(w => w.w))
    expect(res.body.path.total_s).toBeGreaterThan(SEED.total_s)

    // Persisted, so a refresh or a later take starts from the measured pace.
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(res.body.path)
  })

  test('the re-timed path replaces the seed with the take\'s real timestamps', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })

    const spoken = spokenSlow()
    const res = await post()

    // Word for word, the new path IS the reading.
    expect(res.body.path.words.map(w => w.t_start)).toEqual(spoken.map(s => s.start))
  })

  test('a second take re-times against the FIRST take\'s path, not the seed', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })
    await post()
    const afterFirst = dbMock.__state.projects.get('proj-1').path

    // Take 2 is faster than take 1.
    mockScribe.transcribe.mockResolvedValue({
      text: SCRIPT,
      language: 'en',
      words: SCRIPT.split(' ').map((w, i) => ({ w, start: round(i * 0.5), end: round(i * 0.5 + 0.3) })),
      duration_s: 5.3
    })

    const res = await post()

    expect(res.body.path.words[0].t_start).toBe(0)
    expect(res.body.path.total_s).toBeLessThan(afterFirst.total_s)
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(res.body.path)
  })

  test('low coverage leaves the stored path untouched and omits `path`', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })
    // The user improvised something else entirely.
    mockScribe.transcribe.mockResolvedValue({
      text: 'completely unrelated words',
      language: 'en',
      words: [
        { w: 'completely', start: 0.2, end: 0.8 },
        { w: 'unrelated', start: 0.9, end: 1.5 },
        { w: 'improvisation', start: 1.6, end: 2.4 }
      ],
      duration_s: 2.4
    })

    const res = await post()

    expect(res.status).toBe(200)
    expect(res.body.path).toBeUndefined()
    // Still scored and still coached — a bad take is not an error.
    expect(res.body.overall).toBeGreaterThan(0)
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(SEED)
  })

  test('a project with no script is scored but never re-timed', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: SEED })

    const res = await post()

    expect(res.status).toBe(200)
    expect(res.body.path).toBeUndefined()
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(SEED)
  })

  test('coverage and the re-time decision are logged as numeric metadata', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })

    await post()

    const row = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(row.scores.coverage).toBe(1)
    expect(row.scores.retimed).toBe(true)
    // Privacy rule: no transcript, no script text anywhere on the row.
    expect(JSON.stringify(row)).not.toContain('rehearsing')
  })

  test('a low-coverage take logs its coverage with retimed:false', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })
    mockScribe.transcribe.mockResolvedValue({
      text: 'nope', language: 'en', words: [{ w: 'nope', start: 0, end: 0.5 }], duration_s: 0.5
    })

    await post()

    const row = dbMock.__state.events.find(e => e.action === 'evaluate')
    expect(row.scores.coverage).toBeLessThan(0.5)
    expect(row.scores.retimed).toBe(false)
  })

  test('a silent take neither crashes nor re-times', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: SEED })
    mockScribe.transcribe.mockResolvedValue({ text: '', language: 'en', words: [], duration_s: 0 })

    const res = await post()

    expect(res.status).toBe(200)
    expect(res.body.path).toBeUndefined()
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(SEED)
  })
})

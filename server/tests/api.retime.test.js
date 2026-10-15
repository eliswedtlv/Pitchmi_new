'use strict'

// Measured speech updates the prompter rhythm.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

jest.mock('../src/lib/audio', () => ({
  extractAudio: async () => ({ buffer: Buffer.from('audio'), mime: 'audio/mp4', duration_s: 12 })
}))

const mockScribe = { transcribe: jest.fn() }
jest.mock('../src/lib/scribe', () => mockScribe)

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')
const { userToken } = require('./helpers')

const SCRIPT = 'we are building a tool for founders who hate rehearsing alone'
const PREVIOUS = { words: [{ w: 'previous', t_start: 0, t_end: 1, line: 0 }], lines: [], total_s: 1 }

// Read the script with distinct timestamps so persistence can be verified.
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
})

function post () {
  return request(createApp())
    .post('/api/rhythm')
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('fake-video-bytes'), { filename: 'take.webm', contentType: 'video/webm' })
}

describe('POST /api/rhythm — re-timing the prompter (T-10018)', () => {
  test('returns and stores the measured path', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })

    const res = await post()

    expect(res.status).toBe(200)
    // Re-timed: every word carries the moment it was really said.
    expect(res.body.path.words).toHaveLength(11)
    expect(res.body.path.words[0].t_start).toBe(1)
    expect(res.body.path.total_s).toBeGreaterThan(PREVIOUS.total_s)

    // Persisted, so a refresh or a later take starts from the measured pace.
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(res.body.path)
  })

  test('the re-timed path replaces the previous rhythm with the take\'s real timestamps', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })

    const spoken = spokenSlow()
    const res = await post()

    // Word for word, the new path IS the reading.
    expect(res.body.path.words.map(w => w.t_start)).toEqual(spoken.map(s => s.start))
  })

  test('a second take re-times from the second reading', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })
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

  test('low coverage leaves the stored path untouched and returns null `path`', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })
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
    expect(res.body.path).toBeNull()
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(PREVIOUS)
  })

  test('a project with no script is never re-timed', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { path: PREVIOUS })

    const res = await post()

    expect(res.status).toBe(200)
    expect(res.body.path).toBeNull()
    expect(res.body.coverage).toBeNull()
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(PREVIOUS)
  })

  test('coverage and the re-time decision are logged as numeric metadata', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })

    await post()

    const row = dbMock.__state.events.find(e => e.action === 'rhythm')
    expect(row.scores.coverage).toBe(1)
    expect(row.scores.retimed).toBe(1)
    // Privacy rule: no transcript, no script text anywhere on the row.
    expect(JSON.stringify(row)).not.toContain('rehearsing')
  })

  test('a low-coverage take logs its coverage with retimed:false', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })
    mockScribe.transcribe.mockResolvedValue({
      text: 'nope', language: 'en', words: [{ w: 'nope', start: 0, end: 0.5 }], duration_s: 0.5
    })

    await post()

    const row = dbMock.__state.events.find(e => e.action === 'rhythm')
    expect(row.scores.coverage).toBeLessThan(0.5)
    expect(row.scores.retimed).toBe(0)
  })

  test('a silent take neither crashes nor re-times', async () => {
    dbMock.__seedProject('proj-1', 'user-1', { script: SCRIPT, path: PREVIOUS })
    mockScribe.transcribe.mockResolvedValue({ text: '', language: 'en', words: [], duration_s: 0 })

    const res = await post()

    expect(res.status).toBe(200)
    expect(res.body.path).toBeNull()
    expect(dbMock.__state.projects.get('proj-1').path).toEqual(PREVIOUS)
  })
})

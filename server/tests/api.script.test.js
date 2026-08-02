'use strict'

// T-10018 — POST /api/script is the text-first entry point. It stores the typed
// script, seeds a throwaway karaoke path from it, and hands both back so the
// client can go straight to the prompter. No media, so no rate limiter and no
// media semaphore.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const config = require('../src/config')
const { userToken } = require('./helpers')

beforeEach(() => dbMock.__reset())

function post (body, user = 'user-1') {
  return request(createApp())
    .post('/api/script')
    .set('Authorization', `Bearer ${userToken(user)}`)
    .send(body)
}

const SCRIPT = 'We are building a tool for founders who hate rehearsing alone.'

describe('POST /api/script', () => {
  test('happy path: 200 with a seed path, script + path written to the project', async () => {
    dbMock.__seedProject('proj-1', 'user-1')

    const res = await post({ project_id: 'proj-1', text: SCRIPT })

    expect(res.status).toBe(200)
    expect(res.body.word_count).toBe(11)
    expect(res.body.est_duration_s).toBeGreaterThan(0)
    expect(res.body.est_duration_s).toBe(res.body.path.total_s)
    // A real, renderable path — same shape the client already draws.
    expect(res.body.path.words).toHaveLength(11)
    expect(res.body.path.words[0]).toEqual({
      w: 'We',
      t_start: 0,
      t_end: expect.any(Number),
      line: 0
    })
    expect(res.body.path.lines.length).toBeGreaterThan(0)

    const project = dbMock.__state.projects.get('proj-1')
    expect(project.script).toBe(SCRIPT)
    expect(project.path.words).toHaveLength(11)
  })

  test('the seed path is monotonic', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const res = await post({ project_id: 'proj-1', text: SCRIPT })
    const starts = res.body.path.words.map(w => w.t_start)
    expect(starts.every((s, i) => i === 0 || s >= starts[i - 1])).toBe(true)
  })

  test('re-posting a script resets to a FRESH seed — edited text never keeps stale timings', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    await post({ project_id: 'proj-1', text: SCRIPT })

    // Simulate a take having re-timed the path in the meantime.
    const measured = { words: [{ w: 'measured', t_start: 9, t_end: 9.4, line: 0 }], lines: [], total_s: 9.4 }
    dbMock.__state.projects.get('proj-1').path = measured

    const res = await post({ project_id: 'proj-1', text: 'A completely different pitch about something else.' })

    expect(res.status).toBe(200)
    const project = dbMock.__state.projects.get('proj-1')
    expect(project.script).toBe('A completely different pitch about something else.')
    expect(project.path).not.toEqual(measured)
    expect(project.path.words.map(w => w.w)).toEqual(res.body.path.words.map(w => w.w))
    expect(project.path.words[0].t_start).toBe(0)
  })

  test('missing project_id -> 400', async () => {
    const res = await post({ text: SCRIPT })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing_project_id')
  })

  test.each([undefined, '', '   ', 42])('missing/blank text (%p) -> 400 missing_text', async (text) => {
    dbMock.__seedProject('proj-1', 'user-1')
    const res = await post({ project_id: 'proj-1', text })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing_text')
  })

  test('a 2-word script -> 400 script_too_short with a localized message', async () => {
    dbMock.__seedProject('proj-1', 'user-1')

    const res = await post({ project_id: 'proj-1', text: 'ship it' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('script_too_short')
    expect(typeof res.body.message.en).toBe('string')
    expect(typeof res.body.message.he).toBe('string')
    // Nothing was written.
    expect(dbMock.__state.projects.get('proj-1').script).toBeUndefined()
  })

  test('a 1300-character script -> 400 script_too_long with a localized message', async () => {
    dbMock.__seedProject('proj-1', 'user-1')

    const res = await post({ project_id: 'proj-1', text: 'word '.repeat(260) })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('script_too_long')
    expect(res.body.limit_chars).toBe(config.MAX_SCRIPT_CHARS)
    expect(res.body.message.en).toMatch(/1200/)
    expect(typeof res.body.message.he).toBe('string')
    expect(dbMock.__state.projects.get('proj-1').script).toBeUndefined()
  })

  test('a script exactly at the limit is accepted', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const text = 'word '.repeat(239) + 'end'.padEnd(config.MAX_SCRIPT_CHARS - 1195, 'x')
    expect(text.length).toBeLessThanOrEqual(config.MAX_SCRIPT_CHARS)

    expect((await post({ project_id: 'proj-1', text })).status).toBe(200)
  })

  test("another user's project -> 404", async () => {
    dbMock.__seedProject('proj-1', 'someone-else')
    const res = await post({ project_id: 'proj-1', text: SCRIPT })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('project_not_found')
  })

  test('no token -> 401', async () => {
    const res = await request(createApp()).post('/api/script').send({ project_id: 'proj-1', text: SCRIPT })
    expect(res.status).toBe(401)
  })

  test('Hebrew script round-trips and seeds a path', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const he = 'שלום, קוראים לי אלי ואני בונה מוצר חדש לדוברים.'

    const res = await post({ project_id: 'proj-1', text: he })

    expect(res.status).toBe(200)
    expect(res.body.word_count).toBe(9)
    expect(dbMock.__state.projects.get('proj-1').script).toBe(he)
    expect(res.body.path.lines.every(l => l.text.trim().length > 0)).toBe(true)
  })
})

'use strict'

// Script submissions store text and clear any previous measured rhythm.

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
  test('happy path: 200 with word_count, script written and path cleared', async () => {
    dbMock.__seedProject('proj-1', 'user-1')

    const res = await post({ project_id: 'proj-1', text: SCRIPT })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ word_count: 11 })
    const project = dbMock.__state.projects.get('proj-1')
    expect(project.script).toBe(SCRIPT)
    expect(project.path).toBeNull()
  })

  test('re-posting a script clears the previous rhythm — edited text never keeps stale timings', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    await post({ project_id: 'proj-1', text: SCRIPT })

    // Simulate a take having re-timed the path in the meantime.
    const measured = { words: [{ w: 'measured', t_start: 9, t_end: 9.4, line: 0 }], lines: [], total_s: 9.4 }
    dbMock.__state.projects.get('proj-1').path = measured

    const res = await post({ project_id: 'proj-1', text: 'A completely different pitch about something else.' })

    expect(res.status).toBe(200)
    const project = dbMock.__state.projects.get('proj-1')
    expect(project.script).toBe('A completely different pitch about something else.')
    expect(project.path).toBeNull()
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

  test.each(['!!!', 'ship, it!', 'שלום, עולם!'])('tokenizer rejects fewer than 3 words: %s', async (text) => {
    dbMock.__seedProject('proj-1', 'user-1')
    const res = await post({ project_id: 'proj-1', text })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('script_too_short')
  })

  test('exactly 3 tokens are accepted', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const res = await post({ project_id: 'proj-1', text: 'ship, it now!' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ word_count: 3 })
  })

  test('a 6001-character script -> 400 script_too_long with a localized message', async () => {
    dbMock.__seedProject('proj-1', 'user-1')

    const res = await post({ project_id: 'proj-1', text: 'x'.repeat(config.MAX_SCRIPT_CHARS + 1) })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('script_too_long')
    expect(res.body.limit_chars).toBe(config.MAX_SCRIPT_CHARS)
    expect(res.body.message.en).toMatch(/6000/)
    expect(typeof res.body.message.he).toBe('string')
    expect(dbMock.__state.projects.get('proj-1').script).toBeUndefined()
  })

  test('a script exactly at the limit is accepted', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const text = 'word '.repeat(1199) + 'abcde'
    expect(text.length).toBe(config.MAX_SCRIPT_CHARS)

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

  test('Hebrew script round-trips and clears the rhythm', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const he = 'שלום, קוראים לי אלי ואני בונה מוצר חדש לדוברים.'

    const res = await post({ project_id: 'proj-1', text: he })

    expect(res.status).toBe(200)
    expect(res.body.word_count).toBe(9)
    expect(dbMock.__state.projects.get('proj-1').script).toBe(he)
  })
})

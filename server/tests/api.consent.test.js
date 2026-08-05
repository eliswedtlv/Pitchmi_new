'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')
const { CONSENT_ACTION, CONSENT_VERSION } = require('../src/lib/consent')
const { userToken } = require('./helpers')

const auth = () => `Bearer ${userToken('user-1')}`

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
})

describe('anonymous consent and erasure', () => {
  test('feature routes require a current server-side consent receipt', async () => {
    dbMock.__state.consentGranted = false
    const res = await request(createApp())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({})

    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      error: 'consent_required',
      consent_version: CONSENT_VERSION
    })
  })

  test('consent stores only anonymous metadata, then unlocks the product', async () => {
    dbMock.__state.consentGranted = false
    const app = createApp()
    const accepted = await request(app)
      .post('/api/consent')
      .set('Authorization', auth())
      .send({ version: CONSENT_VERSION })

    expect(accepted.status).toBe(201)
    expect(accepted.body).toEqual({ ok: true, consent_version: CONSENT_VERSION })
    const receipt = dbMock.__state.events.find(event => event.action === CONSENT_ACTION)
    expect(receipt).toEqual({ user_id: 'user-1', action: CONSENT_ACTION })
    expect(JSON.stringify(receipt)).not.toMatch(/name|initial|script|video|audio/i)

    const project = await request(app)
      .post('/api/projects')
      .set('Authorization', auth())
      .send({})
    expect(project.status).toBe(201)
  })

  test('unknown consent versions are rejected and not logged', async () => {
    dbMock.__state.consentGranted = false
    const res = await request(createApp())
      .post('/api/consent')
      .set('Authorization', auth())
      .send({ version: 'old' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('unsupported_consent_version')
    expect(dbMock.__state.events).toHaveLength(0)
  })

  test('the current anonymous user can erase data even when the product is paused', async () => {
    dbMock.__state.serviceEnabled = false
    dbMock.__seedProject('project-1', 'user-1')
    dbMock.__state.savedTakes.set('take-1', {
      id: 'take-1',
      project_id: 'project-1',
      user_id: 'user-1',
      storage_path: 'user-1/take-1.webm'
    })
    dbMock.__state.events.push({ user_id: 'user-1', action: 'evaluate' })

    const res = await request(createApp())
      .delete('/api/me')
      .set('Authorization', auth())

    expect(res.status).toBe(204)
    expect(dbMock.__state.deletedUsers).toEqual(['user-1'])
    expect(dbMock.__state.projects.size).toBe(0)
    expect(dbMock.__state.savedTakes.size).toBe(0)
    expect(dbMock.__state.events).toHaveLength(0)
  })
})

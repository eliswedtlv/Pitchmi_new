'use strict'

process.env.SUPABASE_JWT_SECRET = 'test-secret'
process.env.ADMIN_PASSWORD = 'admin-pass'
process.env.ADMIN_COOKIE_SECRET = 'test-cookie-secret'
process.env.CLIENT_ORIGIN = 'https://app.pitchmi.test'

jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
})

describe('cookie-authenticated admin origin checks', () => {
  test('login requires JSON from the configured browser origin', async () => {
    const app = createApp()
    const missing = await request(app)
      .post('/api/admin/login')
      .send({ password: 'admin-pass' })
    expect(missing.status).toBe(403)

    const foreign = await request(app)
      .post('/api/admin/login')
      .set('Origin', 'https://evil.example')
      .send({ password: 'admin-pass' })
    expect(foreign.status).toBe(403)

    const form = await request(app)
      .post('/api/admin/login')
      .set('Origin', 'https://app.pitchmi.test')
      .type('form')
      .send({ password: 'admin-pass' })
    expect(form.status).toBe(415)

    const allowed = await request(app)
      .post('/api/admin/login')
      .set('Origin', 'https://app.pitchmi.test')
      .send({ password: 'admin-pass' })
    expect(allowed.status).toBe(200)
  })

  test('a foreign form cannot use an existing admin cookie to pause service', async () => {
    const app = createApp()
    const login = await request(app)
      .post('/api/admin/login')
      .set('Origin', 'https://app.pitchmi.test')
      .send({ password: 'admin-pass' })
    const cookie = (login.headers['set-cookie'] || []).map(value => value.split(';')[0]).join('; ')

    const blocked = await request(app)
      .post('/api/admin/service')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .type('form')
      .send({ enabled: false })

    expect(blocked.status).toBe(403)
    expect(dbMock.__state.serviceEnabled).toBe(true)
  })
})

'use strict'

// T-10010: the billable routes are capped per IP. The per-user DAILY_EVAL_LIMIT
// cannot do this job — anonymous Supabase identities are free, so a script mints
// a fresh `sub` per request. The limiter sits in FRONT of auth, so these probes
// need no token: an unauthenticated POST still consumes a slot, which is the
// point (an attacker does not have to authenticate to cost us money).

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
})

describe('per-IP rate limits', () => {
  // T-10018 deleted /api/transcribe (and with it its limiter): the typed
  // script seeds its own path, so /api/evaluate is the only billable route
  // left. Its ceiling is unchanged.
  test('the 31st /api/evaluate in the hour -> 429 rate_limited', async () => {
    const app = createApp()
    for (let i = 0; i < 30; i++) {
      const r = await request(app).post('/api/evaluate')
      expect(r.status).not.toBe(429)
    }
    const blocked = await request(app).post('/api/evaluate')
    expect(blocked.status).toBe(429)
    expect(blocked.body).toEqual({ error: 'rate_limited' })
  })

  test('the 21st /api/save in the hour -> 429 rate_limited', async () => {
    const app = createApp()
    for (let i = 0; i < 20; i++) await request(app).post('/api/save')
    const blocked = await request(app).post('/api/save')
    expect(blocked.status).toBe(429)
  })

  test('a trip logs metadata only: action + route, never an IP', async () => {
    const app = createApp()
    for (let i = 0; i < 31; i++) await request(app).post('/api/evaluate')
    const rows = dbMock.__state.events.filter(e => e.action === 'rate_limited')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ action: 'rate_limited', error: '/api/evaluate' })
  })

  test('the limiters are independent: evaluate exhausted, save still open', async () => {
    const app = createApp()
    for (let i = 0; i < 31; i++) await request(app).post('/api/evaluate')
    const save = await request(app).post('/api/save')
    expect(save.status).not.toBe(429)
  })

  test('/api/script carries no limiter — it costs nothing and calls nothing', async () => {
    const app = createApp()
    for (let i = 0; i < 40; i++) {
      expect((await request(app).post('/api/script')).status).not.toBe(429)
    }
  })

  test('distinct client IPs get distinct budgets (trust proxy)', async () => {
    const app = createApp()
    for (let i = 0; i < 31; i++) {
      await request(app).post('/api/evaluate').set('X-Forwarded-For', '203.0.113.7')
    }
    const other = await request(app).post('/api/evaluate').set('X-Forwarded-For', '198.51.100.4')
    expect(other.status).not.toBe(429)
  })
})

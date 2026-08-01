'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const crypto = require('crypto')
const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
})

// The admin cookie is Secure (T-10010), so superagent's jar will not replay it
// over plain http — every test drives it back by hand. That is exactly the
// production shape: the cookie only travels over TLS.
async function login (app, password = 'admin-pass') {
  const res = await request(app).post('/api/admin/login').send({ password })
  const set = res.headers['set-cookie'] || []
  return { res, cookie: set.map(c => c.split(';')[0]).join('; ') }
}

describe('admin auth (#7)', () => {
  test('logs without cookie -> 401', async () => {
    const res = await request(createApp()).get('/api/admin/logs')
    expect(res.status).toBe(401)
  })

  test('login then logs with cookie -> 200', async () => {
    const app = createApp()
    const { res, cookie } = await login(app)
    expect(res.status).toBe(200)
    expect(cookie).toBeTruthy()

    const logs = await request(app).get('/api/admin/logs').set('Cookie', cookie)
    expect(logs.status).toBe(200)
    expect(Array.isArray(logs.body.events)).toBe(true)
  })

  test('wrong password -> 401', async () => {
    const res = await request(createApp()).post('/api/admin/login').send({ password: 'wrong' })
    expect(res.status).toBe(401)
  })

  test('aggregates split STT vs eval spend, and pre-T-1172 rows never produce NaN', async () => {
    const app = createApp()
    const { cookie } = await login(app)

    dbMock.__state.events = [
      // Pre-T-1172 row: a total, no breakdown at all.
      { ts: '2026-08-01T09:00:00Z', user_id: 'u1', action: 'evaluate', cost_usd: 0.01, scores: { overall: 70 } },
      // Post-change rows: the breakdown rides in scores.cost.
      { ts: '2026-08-01T10:00:00Z', user_id: 'u1', action: 'transcribe', cost_usd: 0.002, scores: { cost: { stt_usd: 0.002, eval_usd: null } } },
      { ts: '2026-08-01T11:00:00Z', user_id: 'u2', action: 'evaluate', cost_usd: 0.005, scores: { overall: 80, cost: { stt_usd: 0.002, eval_usd: 0.003 } } }
    ]

    const res = await request(app).get('/api/admin/aggregates').set('Cookie', cookie)
    expect(res.status).toBe(200)
    const day = res.body.aggregates.find(d => d.day === '2026-08-01')

    // The total still sums every row, including the one with no breakdown.
    expect(day.total_cost_usd).toBeCloseTo(0.017, 6)
    // The split counts only rows that carry one — the legacy row contributes 0.
    expect(day.total_stt_usd).toBeCloseTo(0.004, 6)
    expect(day.total_eval_usd).toBeCloseTo(0.003, 6)
    expect(Number.isNaN(day.total_stt_usd)).toBe(false)
    expect(Number.isNaN(day.total_eval_usd)).toBe(false)
  })

  test('a day of ONLY pre-T-1172 rows reports a zero split, not NaN', async () => {
    const app = createApp()
    const { cookie } = await login(app)

    dbMock.__state.events = [
      { ts: '2026-07-01T09:00:00Z', user_id: 'u1', action: 'evaluate', cost_usd: 0.01, scores: { overall: 70 } }
    ]

    const res = await request(app).get('/api/admin/aggregates').set('Cookie', cookie)
    const day = res.body.aggregates.find(d => d.day === '2026-07-01')
    expect(day.total_cost_usd).toBeCloseTo(0.01, 6)
    expect(day.total_stt_usd).toBe(0)
    expect(day.total_eval_usd).toBe(0)
  })

  test('service toggle re-arms kill switch', async () => {
    const app = createApp()
    const { cookie } = await login(app)
    dbMock.__state.serviceEnabled = false
    const res = await request(app).post('/api/admin/service').set('Cookie', cookie).send({ enabled: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ enabled: true })
    expect(dbMock.__state.serviceEnabled).toBe(true)
  })
})

// --- T-10010 hardening -----------------------------------------------------

// cookie-parser's signed-cookie format, so a test can forge one.
function signAdminCookie (secret) {
  const sig = crypto.createHmac('sha256', secret).update('1').digest('base64').replace(/=+$/, '')
  return `admin=${encodeURIComponent(`s:1.${sig}`)}`
}

describe('admin hardening (T-10010)', () => {
  test('a cookie signed with the old published constant is rejected', async () => {
    const forged = signAdminCookie('pitchmi-dev-cookie-secret')
    const res = await request(createApp()).get('/api/admin/logs').set('Cookie', forged)
    expect(res.status).toBe(401)
  })

  test('a cookie signed with the configured secret is accepted', async () => {
    const real = signAdminCookie(process.env.ADMIN_COOKIE_SECRET)
    const res = await request(createApp()).get('/api/admin/logs').set('Cookie', real)
    expect(res.status).toBe(200)
  })

  test('the session cookie is HttpOnly + Secure + SameSite=None', async () => {
    const { res } = await login(createApp())
    const set = String(res.headers['set-cookie'])
    expect(set).toMatch(/HttpOnly/i)
    expect(set).toMatch(/Secure/i)
    expect(set).toMatch(/SameSite=None/i)
  })

  test('login is rate limited: the 11th attempt in the window is 429', async () => {
    const app = createApp()
    for (let i = 0; i < 10; i++) {
      const r = await request(app).post('/api/admin/login').send({ password: 'wrong' })
      expect(r.status).toBe(401)
    }
    const blocked = await request(app).post('/api/admin/login').send({ password: 'wrong' })
    expect(blocked.status).toBe(429)
    expect(blocked.body).toEqual({ error: 'too_many_attempts' })
    // The trip is logged as metadata only — route, no IP, no password.
    const limited = dbMock.__state.events.filter(e => e.action === 'rate_limited')
    expect(limited).toHaveLength(1)
    expect(limited[0].error).toBe('/api/admin/login')
  })

  test('a failed login writes one admin_login event with ok:false and no secret', async () => {
    await request(createApp()).post('/api/admin/login').send({ password: 'wrong' })
    const rows = dbMock.__state.events.filter(e => e.action === 'admin_login')
    expect(rows).toHaveLength(1)
    expect(rows[0].scores).toEqual({ ok: false })
    expect(JSON.stringify(rows[0])).not.toMatch(/wrong|admin-pass/)
  })

  test('a successful login writes admin_login with ok:true', async () => {
    await login(createApp())
    const rows = dbMock.__state.events.filter(e => e.action === 'admin_login')
    expect(rows).toHaveLength(1)
    expect(rows[0].scores).toEqual({ ok: true })
  })

  test('a password of a different length is rejected, not thrown on', async () => {
    // timingSafeEqual throws on unequal buffer lengths — the digests it actually
    // compares are always 32 bytes, so this must be a plain 401.
    const res = await request(createApp()).post('/api/admin/login').send({ password: 'x' })
    expect(res.status).toBe(401)
    const short = await request(createApp()).post('/api/admin/login').send({})
    expect(short.status).toBe(401)
  })
})

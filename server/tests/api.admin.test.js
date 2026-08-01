'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')

beforeEach(() => dbMock.__reset())

describe('admin auth (#7)', () => {
  test('logs without cookie -> 401', async () => {
    const res = await request(createApp()).get('/api/admin/logs')
    expect(res.status).toBe(401)
  })

  test('login then logs with cookie -> 200', async () => {
    const agent = request.agent(createApp())
    const login = await agent.post('/api/admin/login').send({ password: 'admin-pass' })
    expect(login.status).toBe(200)
    expect(login.headers['set-cookie']).toBeTruthy()

    const logs = await agent.get('/api/admin/logs')
    expect(logs.status).toBe(200)
    expect(Array.isArray(logs.body.events)).toBe(true)
  })

  test('wrong password -> 401', async () => {
    const res = await request(createApp()).post('/api/admin/login').send({ password: 'wrong' })
    expect(res.status).toBe(401)
  })

  test('aggregates split STT vs eval spend, and pre-T-1172 rows never produce NaN', async () => {
    const agent = request.agent(createApp())
    await agent.post('/api/admin/login').send({ password: 'admin-pass' })

    dbMock.__state.events = [
      // Pre-T-1172 row: a total, no breakdown at all.
      { ts: '2026-08-01T09:00:00Z', user_id: 'u1', action: 'evaluate', cost_usd: 0.01, scores: { overall: 70 } },
      // Post-change rows: the breakdown rides in scores.cost.
      { ts: '2026-08-01T10:00:00Z', user_id: 'u1', action: 'transcribe', cost_usd: 0.002, scores: { cost: { stt_usd: 0.002, eval_usd: null } } },
      { ts: '2026-08-01T11:00:00Z', user_id: 'u2', action: 'evaluate', cost_usd: 0.005, scores: { overall: 80, cost: { stt_usd: 0.002, eval_usd: 0.003 } } }
    ]

    const res = await agent.get('/api/admin/aggregates')
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
    const agent = request.agent(createApp())
    await agent.post('/api/admin/login').send({ password: 'admin-pass' })

    dbMock.__state.events = [
      { ts: '2026-07-01T09:00:00Z', user_id: 'u1', action: 'evaluate', cost_usd: 0.01, scores: { overall: 70 } }
    ]

    const res = await agent.get('/api/admin/aggregates')
    const day = res.body.aggregates.find(d => d.day === '2026-07-01')
    expect(day.total_cost_usd).toBeCloseTo(0.01, 6)
    expect(day.total_stt_usd).toBe(0)
    expect(day.total_eval_usd).toBe(0)
  })

  test('service toggle re-arms kill switch', async () => {
    const agent = request.agent(createApp())
    await agent.post('/api/admin/login').send({ password: 'admin-pass' })
    dbMock.__state.serviceEnabled = false
    const res = await agent.post('/api/admin/service').send({ enabled: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ enabled: true })
    expect(dbMock.__state.serviceEnabled).toBe(true)
  })
})

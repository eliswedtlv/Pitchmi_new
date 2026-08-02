'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')

beforeEach(() => dbMock.__reset())

describe('basic endpoints', () => {
  test('#1 health -> 200 {status:ok}', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  test('#2 auth gate: POST /api/script without JWT -> 401', async () => {
    const res = await request(createApp()).post('/api/script')
    expect(res.status).toBe(401)
  })

  test('#8 ad stub -> 200 demo config', async () => {
    const res = await request(createApp()).get('/api/ad')
    expect(res.status).toBe(200)
    expect(res.body.type).toBe('demo')
    expect(res.body.url).toBe('/ads/demo.mp4')
    expect(res.body.skippable_after_s).toBe(5)
  })

  test('unknown /api route -> 404', async () => {
    const res = await request(createApp()).get('/api/nope')
    expect(res.status).toBe(404)
  })
})

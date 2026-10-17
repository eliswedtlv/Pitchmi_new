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

  test('unknown /api route -> 404', async () => {
    const res = await request(createApp()).get('/api/nope')
    expect(res.status).toBe(404)
  })
})

describe('ad flag', () => {
  const previous = process.env.ADS_ENABLED

  afterEach(() => {
    if (previous === undefined) delete process.env.ADS_ENABLED
    else process.env.ADS_ENABLED = previous
    jest.resetModules()
  })

  function appWithAds (value) {
    if (value === undefined) delete process.env.ADS_ENABLED
    else process.env.ADS_ENABLED = value
    jest.resetModules()
    return require('../src/app')()
  }

  test.each([undefined, '', 'false', 'TRUE', '1', ' true', 'true '])(
    'ADS_ENABLED=%s -> 200 null (no ad)', async value => {
      const res = await request(appWithAds(value)).get('/api/ad')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/application\/json/)
      expect(res.body).toBeNull()
    }
  )

  test('#8 ADS_ENABLED=true -> 200 demo config', async () => {
    const res = await request(appWithAds('true')).get('/api/ad')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ type: 'demo', url: '/ads/demo.mp4', skippable_after_s: 5 })
  })
})

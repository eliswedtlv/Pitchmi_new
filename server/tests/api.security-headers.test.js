'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')

test('API responses carry the production security-header baseline', async () => {
  const res = await request(createApp()).get('/api/health')

  expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/i)
  expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/i)
  expect(res.headers['x-content-type-options']).toBe('nosniff')
  expect(res.headers['x-frame-options']).toBe('DENY')
  expect(res.headers['referrer-policy']).toBe('no-referrer')
  expect(res.headers['permissions-policy']).toMatch(/camera=\(\)/)
  expect(res.headers['x-powered-by']).toBeUndefined()
})

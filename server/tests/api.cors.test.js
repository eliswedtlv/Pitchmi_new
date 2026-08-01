'use strict'

// T-10010: CORS fails closed. An unset CLIENT_ORIGIN used to mean reflect-any,
// which together with `credentials: true` and the SameSite=None admin cookie
// turns a missing env var into a one-request admin read from any website.

require('./helpers') // sets CLIENT_ORIGIN=''
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')

test('no CLIENT_ORIGIN -> a foreign origin is not reflected', async () => {
  const res = await request(createApp())
    .get('/api/health')
    .set('Origin', 'https://evil.example')

  expect(res.headers['access-control-allow-origin']).toBeUndefined()
  expect(res.headers['access-control-allow-credentials']).toBeUndefined()
})

test('no CLIENT_ORIGIN -> the preflight grants nothing either', async () => {
  const res = await request(createApp())
    .options('/api/admin/logs')
    .set('Origin', 'https://evil.example')
    .set('Access-Control-Request-Method', 'GET')

  expect(res.headers['access-control-allow-origin']).toBeUndefined()
})

describe('with CLIENT_ORIGIN configured', () => {
  const previous = process.env.CLIENT_ORIGIN

  beforeAll(() => {
    process.env.CLIENT_ORIGIN = 'https://app.pitchmi.test'
    jest.resetModules()
  })
  afterAll(() => {
    process.env.CLIENT_ORIGIN = previous
    jest.resetModules()
  })

  test('the configured origin is allowed with credentials; others are not', async () => {
    const app = require('../src/app')()

    const allowed = await request(app).get('/api/health').set('Origin', 'https://app.pitchmi.test')
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.pitchmi.test')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')

    const denied = await request(app).get('/api/health').set('Origin', 'https://evil.example')
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })
})

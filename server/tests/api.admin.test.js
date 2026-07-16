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

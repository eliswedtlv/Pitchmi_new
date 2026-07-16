'use strict'

// Low surge threshold must be set before config loads.
process.env.SURGE_MAX_CALLS = '3'
process.env.SURGE_WINDOW_MIN = '5'
require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const surge = require('../src/middleware/surge')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

beforeEach(() => {
  dbMock.__reset()
  surge.reset()
})

describe('surge -> kill switch (#6)', () => {
  test('exceeding SURGE_MAX_CALLS trips 503, disables service, logs surge_trip', async () => {
    const app = createApp()
    const auth = `Bearer ${userToken('user-1')}`

    // First 3 calls pass (threshold is 3; the 4th exceeds it).
    for (let i = 0; i < 3; i++) {
      const r = await request(app).post('/api/projects').set('Authorization', auth).send({ use_case: 'pitch' })
      expect(r.status).toBe(201)
    }

    const tripped = await request(app).post('/api/projects').set('Authorization', auth).send({ use_case: 'pitch' })
    expect(tripped.status).toBe(503)
    expect(tripped.body).toEqual({ error: 'service_paused' })
    expect(dbMock.__state.serviceEnabled).toBe(false)
    expect(dbMock.__state.events.some(e => e.action === 'surge_trip')).toBe(true)

    // Subsequent call is now blocked by the kill switch.
    const blocked = await request(app).post('/api/projects').set('Authorization', auth).send({ use_case: 'pitch' })
    expect(blocked.status).toBe(503)
    expect(blocked.body).toEqual({ error: 'service_paused' })
  })
})

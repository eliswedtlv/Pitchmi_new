'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

beforeEach(() => dbMock.__reset())

describe('POST /api/save', () => {
  test('#10 uploads to Storage exactly once and returns take_id', async () => {
    dbMock.__seedProject('proj-1', 'user-1', {})
    const res = await request(createApp()).post('/api/save')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .field('project_id', 'proj-1')
      .field('scores', JSON.stringify({ overall: 84 }))
      .field('duration_s', '12.5')
      .attach('video', Buffer.from('fake-video-bytes'), 'take.webm')

    expect(res.status).toBe(201)
    expect(res.body.take_id).toBeTruthy()
    expect(dbMock.__state.uploads).toHaveLength(1)
    expect(dbMock.__state.uploads[0].storagePath).toMatch(/^user-1\/.*\.webm$/)
  })

  test('missing project -> 404', async () => {
    const res = await request(createApp()).post('/api/save')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .field('project_id', 'nope')
      .attach('video', Buffer.from('x'), 'take.webm')
    expect(res.status).toBe(404)
    expect(dbMock.__state.uploads).toHaveLength(0)
  })
})

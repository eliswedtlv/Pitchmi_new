'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

const WEBM = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  Buffer.from('webm-payload-bytes')
])
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftypisom'),
  Buffer.from('mp4-payload')
])

beforeEach(() => dbMock.__reset())

describe('POST /api/save', () => {
  test('#10 uploads to Storage exactly once and returns take_id', async () => {
    dbMock.__seedProject('proj-1', 'user-1', {})
    const res = await request(createApp()).post('/api/save')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .field('project_id', 'proj-1')
      .field('scores', JSON.stringify({ overall: 84 }))
      .field('duration_s', '12.5')
      .attach('video', WEBM, 'take.webm')

    expect(res.status).toBe(201)
    expect(res.body.take_id).toBeTruthy()
    expect(dbMock.__state.uploads).toHaveLength(1)
    expect(dbMock.__state.uploads[0].storagePath).toMatch(/^user-1\/.*\.webm$/)
  })

  test('missing project -> 404', async () => {
    const res = await request(createApp()).post('/api/save')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .field('project_id', 'nope')
      .attach('video', WEBM, 'take.webm')
    expect(res.status).toBe(404)
    expect(dbMock.__state.uploads).toHaveLength(0)
  })

  test('storage type and extension come from magic bytes, not the declared mime', async () => {
    dbMock.__seedProject('proj-1', 'user-1', {})
    const res = await request(createApp()).post('/api/save')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .field('project_id', 'proj-1')
      .attach('video', MP4, { filename: 'take.webm', contentType: 'video/webm' })

    expect(res.status).toBe(201)
    expect(dbMock.__state.uploads[0].storagePath).toMatch(/\.mp4$/)
    expect(dbMock.__state.uploads[0].contentType).toBe('video/mp4')
  })

  test('unidentified bytes are never written to storage', async () => {
    dbMock.__seedProject('proj-1', 'user-1', {})
    const res = await request(createApp()).post('/api/save')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .field('project_id', 'proj-1')
      .attach('video', Buffer.from('not-media'), 'take.webm')

    expect(res.status).toBe(415)
    expect(dbMock.__state.uploads).toHaveLength(0)
  })
})

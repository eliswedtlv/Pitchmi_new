'use strict'

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const { userToken } = require('./helpers')

beforeEach(() => dbMock.__reset())

describe('saved take ownership and deletion', () => {
  test('the owner can delete a saved take', async () => {
    dbMock.__state.savedTakes.set('take-1', {
      id: 'take-1',
      user_id: 'user-1',
      storage_path: 'user-1/take-1.webm'
    })

    const res = await request(createApp())
      .delete('/api/takes/take-1')
      .set('Authorization', `Bearer ${userToken('user-1')}`)

    expect(res.status).toBe(204)
    expect(dbMock.__state.savedTakes.has('take-1')).toBe(false)
  })

  test('another anonymous user cannot delete the take', async () => {
    dbMock.__state.savedTakes.set('take-1', {
      id: 'take-1',
      user_id: 'user-1',
      storage_path: 'user-1/take-1.webm'
    })

    const res = await request(createApp())
      .delete('/api/takes/take-1')
      .set('Authorization', `Bearer ${userToken('user-2')}`)

    expect(res.status).toBe(404)
    expect(dbMock.__state.savedTakes.has('take-1')).toBe(true)
  })
})

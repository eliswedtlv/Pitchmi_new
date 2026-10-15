'use strict'

const mockQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  gte: jest.fn()
}
const mockFrom = jest.fn(() => mockQuery)
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mockFrom }) }))
const db = require('../src/lib/db')

beforeEach(() => {
  jest.clearAllMocks()
  mockQuery.select.mockReturnValue(mockQuery)
  mockQuery.eq.mockReturnValue(mockQuery)
  mockQuery.gte.mockResolvedValue({ count: 4, error: null })
})

test('daily quota counts this user’s rhythm events since UTC midnight', async () => {
  const midnight = new Date()
  midnight.setUTCHours(0, 0, 0, 0)
  expect(await db.countRhythmsToday('user-1')).toBe(4)
  expect(mockFrom).toHaveBeenCalledWith('events')
  expect(mockQuery.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  expect(mockQuery.eq.mock.calls).toEqual([['user_id', 'user-1'], ['action', 'rhythm']])
  expect(mockQuery.gte).toHaveBeenCalledWith('ts', midnight.toISOString())
})

test('quota lookup errors propagate rather than bypassing the cap', async () => {
  mockQuery.gte.mockResolvedValue({ count: null, error: new Error('db unavailable') })
  await expect(db.countRhythmsToday('user-1')).rejects.toThrow('db unavailable')
})

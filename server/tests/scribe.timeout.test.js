'use strict'

// T-10010: the Scribe abort timer must cover the BODY read, not just the
// headers. Clearing it as soon as fetch() resolves leaves an upstream that
// sends headers and then stalls able to hang the transcribe handler forever,
// holding the 60MB upload and its temp files. Same defect T-1166 fixed on the
// eval path; it was never applied here.

process.env.ELEVENLABS_API_KEY = 'test-key'

const { transcribe } = require('../src/lib/scribe')

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  delete global.fetch
})

test('headers then a body that never settles rejects on the timer, it does not hang', async () => {
  let aborted = false
  global.fetch = jest.fn(async (url, opts) => {
    opts.signal.addEventListener('abort', () => { aborted = true })
    return {
      ok: true,
      status: 200,
      // A body that never resolves — until the signal fires.
      json: () => new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    }
  })

  const p = transcribe(Buffer.from('audio'), 'audio/mp4')
  const settled = expect(p).rejects.toThrow()

  // Let the fetch mock resolve and the body read start before the clock jumps.
  await Promise.resolve()
  await Promise.resolve()
  jest.advanceTimersByTime(60000)

  await settled
  expect(aborted).toBe(true)
})

test('a normal response still clears the timer and returns the transcript', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ text: 'hello', language_code: 'en', words: [{ text: 'hello', start: 0, end: 0.5, type: 'word' }] })
  }))

  const out = await transcribe(Buffer.from('audio'), 'audio/mp4')
  expect(out.text).toBe('hello')
  expect(jest.getTimerCount()).toBe(0)
})

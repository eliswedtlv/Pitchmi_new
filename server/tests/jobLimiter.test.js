'use strict'

// T-10010: media jobs are admission-controlled. Each /api/evaluate spawns two
// ffmpeg processes (one an x264 encode) while holding a 60MB upload in memory,
// so unbounded concurrency is how a small container gets OOM-killed.

const { createLimiter } = require('../src/lib/jobLimiter')

function deferred () {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: settle }
}

describe('media job limiter', () => {
  test('the second job starts only after the first releases', async () => {
    const limiter = createLimiter({ concurrency: 1, queueMax: 8 })
    const first = deferred()
    const started = []

    const a = limiter.run(async () => { started.push('a'); await first.promise })
    const b = limiter.run(async () => { started.push('b') })

    await Promise.resolve()
    expect(started).toEqual(['a'])

    first.resolve()
    await Promise.all([a, b])
    expect(started).toEqual(['a', 'b'])
  })

  test('a full queue is refused immediately with a 503-mapped error', async () => {
    const limiter = createLimiter({ concurrency: 1, queueMax: 1 })
    const held = deferred()

    const running = limiter.run(() => held.promise)
    const queued = limiter.run(async () => 'queued')
    await Promise.resolve()

    await expect(limiter.run(async () => 'refused')).rejects.toMatchObject({ code: 'busy', status: 503 })

    held.resolve()
    await Promise.all([running, queued])
  })

  test('a job that throws still frees its slot', async () => {
    const limiter = createLimiter({ concurrency: 1, queueMax: 0 })

    await expect(limiter.run(async () => { throw new Error('transcode blew up') }))
      .rejects.toThrow('transcode blew up')

    expect(limiter.stats()).toEqual({ active: 0, queued: 0 })
    await expect(limiter.run(async () => 'next one runs')).resolves.toBe('next one runs')
  })

  test('concurrency is never exceeded under a burst', async () => {
    const limiter = createLimiter({ concurrency: 2, queueMax: 100 })
    let active = 0
    let peak = 0

    await Promise.all(Array.from({ length: 20 }, () => limiter.run(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 1))
      active--
    })))

    expect(peak).toBe(2)
    expect(limiter.stats()).toEqual({ active: 0, queued: 0 })
  })
})

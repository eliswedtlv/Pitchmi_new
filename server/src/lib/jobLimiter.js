'use strict'

// In-process admission control for media (ffmpeg) work — T-10010.
//
// /api/evaluate spawns two ffmpeg processes per request, one of them an libx264
// encode, and holds a 60MB upload in memory the whole time. A handful of
// simultaneous uploads OOM-kills a small Railway container, so the ffmpeg-
// touching section of transcribe/evaluate runs behind a semaphore: at most
// MEDIA_CONCURRENCY at a time, at most MEDIA_QUEUE_MAX more waiting. Anything
// past that is refused immediately with `busy` rather than piling up — a queue
// that never drains is just a slower crash.
//
// Single-process only: Railway runs one container per service today. If the
// server is ever scaled horizontally this becomes a per-instance bound.

const config = require('../config')

class BusyError extends Error {
  constructor () {
    super('busy')
    this.code = 'busy'
    this.status = 503
  }
}

function createLimiter ({ concurrency, queueMax }) {
  let active = 0
  const waiting = []

  function next () {
    if (active >= concurrency) return
    const resolve = waiting.shift()
    if (!resolve) return
    active++
    resolve()
  }

  async function acquire () {
    if (active < concurrency) {
      active++
      return
    }
    if (waiting.length >= queueMax) throw new BusyError()
    await new Promise(resolve => waiting.push(resolve))
  }

  function release () {
    active = Math.max(0, active - 1)
    next()
  }

  // run() is the only intended entry point: the slot is released on EVERY exit
  // path, so a throwing transcode can never leak one.
  async function run (fn) {
    await acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  return { run, stats: () => ({ active, queued: waiting.length }) }
}

const mediaLimiter = createLimiter({
  concurrency: config.MEDIA_CONCURRENCY,
  queueMax: config.MEDIA_QUEUE_MAX
})

// runMedia(fn) — queue or refuse; rejects with a 503-mapped BusyError.
module.exports = {
  runMedia: fn => mediaLimiter.run(fn),
  mediaStats: mediaLimiter.stats,
  createLimiter,
  BusyError
}

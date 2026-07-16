'use strict'

// Surge guard: sliding window over all /api/* calls (in-memory, per instance).
// If more than SURGE_MAX_CALLS land within SURGE_WINDOW_MIN minutes, flip the
// kill switch, log a surge_trip event, and start returning 503.

const config = require('../config')
const db = require('../lib/db')

let hits = []

function surge (req, res, next) {
  const now = Date.now()
  const windowMs = config.SURGE_WINDOW_MIN * 60 * 1000
  hits.push(now)
  hits = hits.filter(t => now - t < windowMs)
  if (hits.length > config.SURGE_MAX_CALLS) {
    db.setServiceEnabled(false).catch(err => console.error('surge disable failed:', err.message))
    db.logEvent({ action: 'surge_trip' })
    return res.status(503).json({ error: 'service_paused' })
  }
  next()
}

// For tests: clear the in-memory window.
surge.reset = function reset () { hits = [] }

module.exports = surge

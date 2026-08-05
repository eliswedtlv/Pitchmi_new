'use strict'

// Per-IP ceilings on the billable / abusable routes (T-10010).
//
// The per-user DAILY_EVAL_LIMIT stays exactly as it was — this is an additional
// layer, not a replacement. It has to be, because anonymous Supabase identities
// are free and unlimited: a script mints a fresh `sub` per request and the
// per-user cap never trips. Keying on the client IP (see `trust proxy` in
// app.js) is what actually bounds spend.

const { rateLimit, MemoryStore } = require('express-rate-limit')
const config = require('../config')
const db = require('../lib/db')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Kept so tests can clear counters between cases; nothing in the app calls it.
const stores = []

function make ({ windowMs, max, error, route }) {
  const store = new MemoryStore()
  stores.push(store)
  return rateLimit({
    windowMs,
    limit: max,
    store,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      // Metadata only (privacy rule): the route that tripped, never the IP and
      // never any request content. `events` has no `route` column and this task
      // adds no migration, so the route rides in the existing `error` text.
      db.logEvent({ action: 'rate_limited', error: route }).catch(() => {})
      res.status(429).json({ error })
    }
  })
}

module.exports = {
  adminLogin: make({ windowMs: 15 * MINUTE, max: 10, error: 'too_many_attempts', route: '/api/admin/login' }),
  consent: make({ windowMs: HOUR, max: 20, error: 'rate_limited', route: '/api/consent' }),
  deleteAccount: make({ windowMs: HOUR, max: 5, error: 'rate_limited', route: '/api/me' }),
  // No `transcribe` limiter: T-10018 deleted /api/transcribe (the typed script
  // seeds its own path, and the re-timing rides on /api/evaluate), so the
  // limiter guarded a route that no longer exists. `/api/evaluate` is now the
  // only billable route and keeps its own unchanged 30/hour ceiling.
  evaluate: make({ windowMs: HOUR, max: config.RATE_LIMIT_EVAL_PER_HOUR, error: 'rate_limited', route: '/api/evaluate' }),
  save: make({ windowMs: HOUR, max: config.RATE_LIMIT_SAVE_PER_HOUR, error: 'rate_limited', route: '/api/save' }),
  __resetAll () { for (const s of stores) s.resetAll() }
}

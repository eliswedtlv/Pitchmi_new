'use strict'

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const config = require('./config')
const db = require('./lib/db')

const killSwitch = require('./middleware/killSwitch')
const surge = require('./middleware/surge')

const health = require('./routes/health')
const ad = require('./routes/ad')
const admin = require('./routes/admin')
const projects = require('./routes/projects')
const transcribe = require('./routes/transcribe')
const pathRoute = require('./routes/path')
const evaluate = require('./routes/evaluate')
const save = require('./routes/save')
const takes = require('./routes/takes')

function createApp () {
  const app = express()
  app.disable('x-powered-by')

  const origins = config.CLIENT_ORIGIN
    ? config.CLIENT_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
    : true
  app.use(cors({ origin: origins, credentials: true }))
  app.use(cookieParser(config.COOKIE_SECRET))
  app.use(express.json({ limit: '1mb' }))

  // Public: health + ad stub (no auth, not gated by the kill switch).
  app.use('/api', health)
  app.use('/api', ad)

  // Admin: own cookie auth; mounted before the gates so it stays reachable
  // even while the service is paused.
  app.use('/api', admin)

  // Global gates, in order (§5): kill switch, then surge counter.
  app.use('/api', killSwitch)
  app.use('/api', surge)

  // Authed feature routes.
  app.use('/api', projects)
  app.use('/api', transcribe)
  app.use('/api', pathRoute)
  app.use('/api', evaluate)
  app.use('/api', save)
  app.use('/api', takes)

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }))

  app.use(errorHandler)
  return app
}

function errorHandler (err, req, res, next) {
  // Upload cap -> 413.
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large', limit_mb: config.MAX_UPLOAD_MB })
  }
  const status = err.status || 500
  if (status >= 500) {
    db.logEvent({ action: 'error', error: String(err && err.message ? err.message : err).slice(0, 500) })
  }
  res.status(status).json({ error: 'server_error', message: err && err.message })
}

module.exports = createApp

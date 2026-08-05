'use strict'

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const config = require('./config')
const db = require('./lib/db')

const killSwitch = require('./middleware/killSwitch')
const surge = require('./middleware/surge')

const health = require('./routes/health')
const ad = require('./routes/ad')
const admin = require('./routes/admin')
const privacy = require('./routes/privacy')
const projects = require('./routes/projects')
const script = require('./routes/script')
const evaluate = require('./routes/evaluate')
const save = require('./routes/save')
const takes = require('./routes/takes')

function createApp () {
  const app = express()
  app.disable('x-powered-by')
  // Railway terminates TLS one hop in front of us; without this every request
  // keys to the proxy's address and the per-IP limiters throttle all users as
  // one. `1` (not `true`) also keeps express-rate-limit's permissive-proxy
  // validation happy.
  app.set('trust proxy', 1)

  // API responses carry the browser-facing baseline too. CSP is deliberately
  // `default-src 'none'`: this service returns JSON/media, never executable UI.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }))
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    next()
  })

  // Fail closed (T-10010): an unset CLIENT_ORIGIN used to mean reflect-any, and
  // combined with `credentials: true` and the SameSite=None admin cookie that is
  // a one-request admin read from any website. No origin -> no cross-origin
  // credentials at all.
  const origins = config.CLIENT_ORIGIN
    ? config.CLIENT_ORIGIN.split(',').map(s => {
      const value = s.trim()
      try { return new URL(value).origin } catch { return value }
    }).filter(Boolean)
    : false
  app.use(cors({ origin: origins, credentials: true }))
  app.use(cookieParser(config.COOKIE_SECRET))
  // Every JSON route is tiny (script max 1,200 chars); a 32KB ceiling prevents
  // unauthenticated/admin parsers from being used as a cheap memory sink.
  app.use(express.json({ limit: '32kb', strict: true }))

  // Public: health + ad stub (no auth, not gated by the kill switch).
  app.use('/api', health)
  app.use('/api', ad)

  // Admin: own cookie auth; mounted before the gates so it stays reachable
  // even while the service is paused.
  app.use('/api', admin)

  // Consent and erasure also remain reachable while the product is paused.
  // Neither invokes a paid provider.
  app.use('/api', privacy)

  // Global gates, in order (§5): kill switch, then surge counter.
  app.use('/api', killSwitch)
  app.use('/api', surge)

  // Authed feature routes.
  app.use('/api', projects)
  app.use('/api', script)
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
  if (err && ['LIMIT_FIELD_VALUE', 'LIMIT_FIELD_COUNT', 'LIMIT_PART_COUNT', 'LIMIT_FILE_COUNT'].includes(err.code)) {
    return res.status(413).json({ error: 'multipart_too_large' })
  }
  // Declared mime the upload filter refused -> 415 (T-10010).
  if (err && err.code === 'UNSUPPORTED_MEDIA_TYPE') {
    return res.status(415).json({ error: 'unsupported_media_type' })
  }
  // Media queue full -> 503, no event row (the limiter is not an error).
  if (err && err.code === 'busy') {
    return res.status(503).json({ error: 'busy' })
  }
  const status = err.status || 500
  if (status >= 500) {
    db.logEvent({ action: 'error', error: String(err && err.message ? err.message : err).slice(0, 500) })
  }
  // Internal/provider errors belong in the metadata log, not in a public
  // response where they can disclose table names, upstream bodies or config.
  res.status(status).json({ error: status >= 500 ? 'server_error' : (err.code || 'request_error') })
}

module.exports = createApp

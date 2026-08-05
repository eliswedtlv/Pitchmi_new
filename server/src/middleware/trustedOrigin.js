'use strict'

const config = require('../config')

function normalizeOrigin (value) {
  try {
    return new URL(value).origin
  } catch {
    return value
  }
}

const allowed = new Set(config.CLIENT_ORIGIN
  ? config.CLIENT_ORIGIN.split(',').map(s => normalizeOrigin(s.trim())).filter(Boolean)
  : [])

// CORS only controls whether JavaScript can read a response; it does not stop a
// browser from sending a credentialed form POST. Cookie-authenticated admin
// mutations therefore require the browser Origin to match the deployed client.
module.exports = function trustedOrigin (req, res, next) {
  // Tests and local server-only work intentionally run without CLIENT_ORIGIN.
  // Production startup refuses that configuration.
  if (allowed.size === 0) return next()
  const origin = req.get('origin')
  if (origin && allowed.has(origin)) return next()
  return res.status(403).json({ error: 'untrusted_origin' })
}

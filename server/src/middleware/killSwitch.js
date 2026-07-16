'use strict'

// Global kill switch: if app_settings.service_enabled is false, reject all
// non-admin API traffic with 503. Admin routes are mounted before this.

const db = require('../lib/db')

module.exports = async function killSwitch (req, res, next) {
  let enabled = true
  try {
    enabled = await db.getServiceEnabled()
  } catch (err) {
    // Fail open: a transient DB read error must not take the whole API down.
    console.error('killSwitch read failed, allowing request:', err.message)
    return next()
  }
  if (!enabled) return res.status(503).json({ error: 'service_paused' })
  next()
}

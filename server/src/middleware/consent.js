'use strict'

const db = require('../lib/db')
const { CONSENT_ACTION, CONSENT_VERSION } = require('../lib/consent')

// Product routes do not trust the browser-only acknowledgement. The anonymous
// JWT must also have a current, timestamped consent receipt in the metadata log.
module.exports = async function requireConsent (req, res, next) {
  try {
    const accepted = await db.hasEvent(req.userId, CONSENT_ACTION)
    if (!accepted) {
      return res.status(403).json({
        error: 'consent_required',
        consent_version: CONSENT_VERSION
      })
    }
    next()
  } catch (err) {
    next(err)
  }
}

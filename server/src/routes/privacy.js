'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const rateLimit = require('../middleware/rateLimit')
const db = require('../lib/db')
const { CONSENT_ACTION, CONSENT_VERSION } = require('../lib/consent')

const router = express.Router()

// POST /api/consent — anonymous, versioned consent receipt. The typed
// acknowledgement stays in the browser; the server stores only anonymous user
// id + event timestamp + this versioned action.
router.post('/consent', rateLimit.consent, auth, async (req, res, next) => {
  try {
    if (!req.body || req.body.version !== CONSENT_VERSION) {
      return res.status(400).json({
        error: 'unsupported_consent_version',
        consent_version: CONSENT_VERSION
      })
    }
    await db.recordConsent(req.userId, CONSENT_ACTION)
    res.status(201).json({ ok: true, consent_version: CONSENT_VERSION })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/me — no login required beyond the current anonymous JWT. Removes
// saved media, project/script rows, metadata events and finally the anonymous
// Supabase user so a signed-out browser cannot accidentally revive the account.
router.delete('/me', rateLimit.deleteAccount, auth, async (req, res, next) => {
  try {
    await db.deleteUserData(req.userId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = router

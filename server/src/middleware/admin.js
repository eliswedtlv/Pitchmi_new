'use strict'

// Gate for /api/admin/* (except login). Requires the signed httpOnly admin
// cookie set by POST /api/admin/login.

module.exports = function requireAdmin (req, res, next) {
  if (req.signedCookies && req.signedCookies.admin === '1') return next()
  return res.status(401).json({ error: 'unauthorized' })
}

'use strict'

// Verifies the Supabase user JWT (HS256, signed with SUPABASE_JWT_SECRET) and
// attaches req.userId. The FE obtains this token via signInAnonymously().

const jwt = require('jsonwebtoken')
const config = require('../config')

module.exports = function auth (req, res, next) {
  const header = req.headers.authorization || ''
  const match = header.match(/^Bearer (.+)$/)
  if (!match) return res.status(401).json({ error: 'unauthorized' })
  try {
    const payload = jwt.verify(match[1], config.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] })
    if (!payload.sub) return res.status(401).json({ error: 'unauthorized' })
    req.userId = payload.sub
    next()
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

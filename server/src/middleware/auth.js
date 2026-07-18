'use strict'

// Verifies the Supabase user JWT and attaches req.userId. The FE obtains this
// token via signInAnonymously(). Modern Supabase projects sign user JWTs with
// asymmetric keys (ES256 + a `kid`) published at the project's JWKS endpoint;
// legacy projects (and the test suite) use a shared HS256 secret. We verify
// against the JWKS when the token uses an asymmetric algorithm, and fall back
// to HS256 + SUPABASE_JWT_SECRET otherwise. The user id is the `sub` claim.

const jwt = require('jsonwebtoken')
const { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } = require('jose')
const config = require('../config')

// Cache the remote key set across requests (jose refreshes it internally).
let jwks = null
function getJwks () {
  if (!jwks && config.SUPABASE_URL) {
    jwks = createRemoteJWKSet(new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  }
  return jwks
}

module.exports = async function auth (req, res, next) {
  const header = req.headers.authorization || ''
  const match = header.match(/^Bearer (.+)$/)
  if (!match) return res.status(401).json({ error: 'unauthorized' })
  const token = match[1]

  // Inspect the token header to pick the verification path.
  let alg
  try {
    alg = decodeProtectedHeader(token).alg
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const keySet = getJwks()
  if (alg && alg !== 'HS256' && keySet) {
    try {
      const { payload } = await jwtVerify(token, keySet)
      if (!payload.sub) return res.status(401).json({ error: 'unauthorized' })
      req.userId = payload.sub
      return next()
    } catch (err) {
      return res.status(401).json({ error: 'unauthorized' })
    }
  }

  // HS256 fallback (legacy projects + tests).
  try {
    const payload = jwt.verify(token, config.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] })
    if (!payload.sub) return res.status(401).json({ error: 'unauthorized' })
    req.userId = payload.sub
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

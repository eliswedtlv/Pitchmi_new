'use strict'

// Auth middleware: verifies Supabase user JWTs via the project JWKS (ES256) and
// falls back to HS256 + SUPABASE_JWT_SECRET. The remote JWKS fetch is mocked to
// return a locally generated ES256 public key.

// Env must be set before ../src/config is loaded (via the middleware require).
process.env.SUPABASE_JWT_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'https://example.supabase.co'

const jwt = require('jsonwebtoken')
const jose = require('jose')

// The middleware's public key resolver; assigned in beforeAll and returned by
// the mocked createRemoteJWKSet.
let mockPublicKey

jest.mock('jose', () => {
  const actual = jest.requireActual('jose')
  return {
    ...actual,
    createRemoteJWKSet: () => async () => mockPublicKey
  }
})

const auth = require('../src/middleware/auth')

let privateKey, wrongPrivateKey

beforeAll(async () => {
  ({ publicKey: mockPublicKey, privateKey } = await jose.generateKeyPair('ES256'))
  const wrong = await jose.generateKeyPair('ES256')
  wrongPrivateKey = wrong.privateKey
})

async function es256Token (key, { sub = 'user-1', ttl = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new jose.SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
    .setSubject(sub)
    .setIssuer('https://example.supabase.co/auth/v1')
    .setAudience('authenticated')
    .setIssuedAt(now - 10)
    .setExpirationTime(now + ttl)
    .sign(key)
}

function invoke (token) {
  return new Promise((resolve) => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }
    const res = {
      statusCode: 200,
      status (code) { this.statusCode = code; return this },
      json (body) { resolve({ status: this.statusCode, body, userId: req.userId }) }
    }
    const next = () => resolve({ status: 200, userId: req.userId })
    auth(req, res, next)
  })
}

test('valid ES256 token verified via JWKS passes and sets userId', async () => {
  const token = await es256Token(privateKey, { sub: 'abc-123' })
  const result = await invoke(token)
  expect(result.status).toBe(200)
  expect(result.userId).toBe('abc-123')
})

test('ES256 token signed with a wrong key is rejected (401)', async () => {
  const token = await es256Token(wrongPrivateKey)
  const result = await invoke(token)
  expect(result.status).toBe(401)
  expect(result.userId).toBeUndefined()
})

test('expired ES256 token is rejected (401)', async () => {
  const token = await es256Token(privateKey, { ttl: -3600 })
  const result = await invoke(token)
  expect(result.status).toBe(401)
})

test('ES256 token from the wrong issuer is rejected (401)', async () => {
  const now = Math.floor(Date.now() / 1000)
  const token = await new jose.SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
    .setSubject('user-1')
    .setIssuer('https://evil.example/auth/v1')
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)
  const result = await invoke(token)
  expect(result.status).toBe(401)
})

test('HS256 token verified with SUPABASE_JWT_SECRET still passes (fallback)', async () => {
  const token = jwt.sign({ sub: 'hs-user', role: 'authenticated' }, 'test-secret', { algorithm: 'HS256' })
  const result = await invoke(token)
  expect(result.status).toBe(200)
  expect(result.userId).toBe('hs-user')
})

test('HS256 token signed with a wrong secret is rejected (401)', async () => {
  const token = jwt.sign({ sub: 'hs-user' }, 'not-the-secret', { algorithm: 'HS256' })
  const result = await invoke(token)
  expect(result.status).toBe(401)
})

test('missing Authorization header is rejected (401)', async () => {
  const result = await invoke(null)
  expect(result.status).toBe(401)
})

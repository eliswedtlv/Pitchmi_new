'use strict'

// Test env must be set before config/app are required. Each test file requires
// this module first.
process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'test-secret'
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin-pass'
process.env.DAILY_EVAL_LIMIT = process.env.DAILY_EVAL_LIMIT || '25'
process.env.MAX_UPLOAD_MB = process.env.MAX_UPLOAD_MB || '60'
process.env.CLIENT_ORIGIN = ''

const jwt = require('jsonwebtoken')

function userToken (sub = 'user-1') {
  return jwt.sign({ sub, role: 'authenticated' }, process.env.SUPABASE_JWT_SECRET, { algorithm: 'HS256' })
}

module.exports = { userToken }

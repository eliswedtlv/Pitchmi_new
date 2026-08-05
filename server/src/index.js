'use strict'

const createApp = require('./app')
const config = require('./config')

// Fail fast on the secrets that gate the admin panel (T-10010). An empty
// ADMIN_COOKIE_SECRET used to fall back to a constant published in this repo,
// which made the admin cookie forgeable by anyone; an empty ADMIN_PASSWORD
// would leave the login comparing against ''. Booting broken is worse than not
// booting. Tests build the app directly and set their own values.
if (process.env.NODE_ENV !== 'test') {
  const required = [
    'ADMIN_COOKIE_SECRET',
    'ADMIN_PASSWORD',
    'CLIENT_ORIGIN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ELEVENLABS_API_KEY'
  ]
  required.push(config.EVAL_PROVIDER === 'gemini' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY')
  const missing = required.filter(k => !config[k])
  if (missing.length) {
    throw new Error(`Refusing to start: ${missing.join(' and ')} must be set (see server/.env.example).`)
  }
  if (!['openrouter', 'gemini'].includes(config.EVAL_PROVIDER)) {
    throw new Error('Refusing to start: EVAL_PROVIDER must be openrouter or gemini.')
  }
  if (config.ADMIN_COOKIE_SECRET.length < 32) {
    console.warn('WARNING: ADMIN_COOKIE_SECRET should be at least 32 characters.')
  }
  if (config.ADMIN_PASSWORD.length < 12) {
    console.warn('WARNING: ADMIN_PASSWORD should be at least 12 characters.')
  }
}

const app = createApp()
app.listen(config.PORT, () => {
  console.log(`PitchMi API listening on :${config.PORT}`)
})

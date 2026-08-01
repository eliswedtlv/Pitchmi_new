'use strict'

// Central config. Reads process.env once with the defaults from .env.example.
// Locally, run with `node --env-file=.env` (see package.json dev script);
// on Railway the env vars are provided by the platform.

function int (v, d) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : d
}

function num (v, d) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : d
}

const config = {
  PORT: int(process.env.PORT, 8080),

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',

  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  EVAL_PROVIDER: (process.env.EVAL_PROVIDER || 'openrouter').toLowerCase(),
  EVAL_MODEL: process.env.EVAL_MODEL || 'google/gemini-3.1-flash-lite',

  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  DAILY_EVAL_LIMIT: int(process.env.DAILY_EVAL_LIMIT, 25),
  SURGE_MAX_CALLS: int(process.env.SURGE_MAX_CALLS, 300),
  SURGE_WINDOW_MIN: int(process.env.SURGE_WINDOW_MIN, 5),
  MAX_UPLOAD_MB: int(process.env.MAX_UPLOAD_MB, 60),
  // Hard take ceiling (T-1172). The tolerance is not slop for the user — it
  // absorbs container rounding and MediaRecorder's imprecise stop, which
  // routinely lands a "30s" take at 30.4s. Reject only above the sum.
  MAX_TAKE_S: int(process.env.MAX_TAKE_S, 30),
  TAKE_TOLERANCE_S: num(process.env.TAKE_TOLERANCE_S, 3),
  // ElevenLabs Scribe list ~$0.24/hr as of 2026-08; override with
  // SCRIBE_USD_PER_MIN when the contract changes.
  SCRIBE_USD_PER_MIN: num(process.env.SCRIBE_USD_PER_MIN, 0.004),

  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '',

  STORAGE_BUCKET: 'videos'
}

// Cookie signing secret for the admin session. Reuses the JWT secret (a
// server-only value) so no extra env var is needed.
config.COOKIE_SECRET = config.SUPABASE_JWT_SECRET || 'pitchmi-dev-cookie-secret'

module.exports = config

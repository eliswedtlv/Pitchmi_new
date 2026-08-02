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
  // Signing key for the admin session cookie. Deliberately its own var with no
  // fallback (T-10010): the previous literal default was published in this repo,
  // so anyone could forge `admin=1`. Startup refuses to boot when it is empty.
  ADMIN_COOKIE_SECRET: process.env.ADMIN_COOKIE_SECRET || '',

  DAILY_EVAL_LIMIT: int(process.env.DAILY_EVAL_LIMIT, 25),
  // Per-IP ceilings on the billable routes (T-10010). Anonymous identities are
  // free and unlimited, so DAILY_EVAL_LIMIT alone is not a spend ceiling.
  RATE_LIMIT_TRANSCRIBE_PER_HOUR: int(process.env.RATE_LIMIT_TRANSCRIBE_PER_HOUR, 30),
  RATE_LIMIT_EVAL_PER_HOUR: int(process.env.RATE_LIMIT_EVAL_PER_HOUR, 30),
  RATE_LIMIT_SAVE_PER_HOUR: int(process.env.RATE_LIMIT_SAVE_PER_HOUR, 20),
  // Media (ffmpeg) job admission control — see lib/jobLimiter.js.
  MEDIA_CONCURRENCY: int(process.env.MEDIA_CONCURRENCY, 2),
  MEDIA_QUEUE_MAX: int(process.env.MEDIA_QUEUE_MAX, 8),
  FFMPEG_TIMEOUT_MS: int(process.env.FFMPEG_TIMEOUT_MS, 60000),
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
  // Typed-script ceiling (T-10018). Also bounds the alignment DP in
  // lib/scriptPath.js, which is O(script words x spoken words).
  MAX_SCRIPT_CHARS: int(process.env.MAX_SCRIPT_CHARS, 1200),
  // Below this share of typed words anchored to a real spoken word, the take
  // was not a delivery of THIS script, so /api/evaluate keeps the stored path
  // rather than re-timing against garbage. 0.5 is a first guess with no data
  // behind it — tune from the coverage logged on every evaluate event.
  MIN_ALIGN_COVERAGE: num(process.env.MIN_ALIGN_COVERAGE, 0.5),
  // Reading rate for the throwaway seed path only (T-10018). CHARACTERS per
  // second, not WPM: word length differs too much between English and Hebrew
  // for a word-based rate to travel. Replaced by measured timings after take 1.
  SEED_CHARS_PER_SECOND: num(process.env.SEED_CHARS_PER_SECOND, 13),

  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '',

  STORAGE_BUCKET: 'videos'
}

config.COOKIE_SECRET = config.ADMIN_COOKIE_SECRET

module.exports = config

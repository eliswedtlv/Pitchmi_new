'use strict'

// ElevenLabs Scribe speech-to-text. Returns word-level timestamps + detected
// language. Uses the global fetch/FormData/Blob available in Node 18+.

const config = require('../config')

const SCRIBE_URL = 'https://api.elevenlabs.io/v1/speech-to-text'

// Hard timeout on the Scribe HTTP call so a stalled upstream can never hang the
// transcribe/evaluate handler (T-1165). The timer is always cleared.
const SCRIBE_TIMEOUT_MS = 60000

// transcribe(audioBuffer, mime) ->
//   { text, language, words: [{ w, start, end }], duration_s }
async function transcribe (audioBuffer, mime = 'audio/mp4') {
  if (!config.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set')

  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  form.append('timestamps_granularity', 'word')
  form.append('file', new Blob([audioBuffer], { type: mime }), 'take.m4a')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('scribe_timeout')), SCRIBE_TIMEOUT_MS)
  let res
  try {
    res = await fetch(SCRIBE_URL, {
      method: 'POST',
      headers: { 'xi-api-key': config.ELEVENLABS_API_KEY },
      body: form,
      signal: ctrl.signal
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Scribe ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  return normalizeScribe(data)
}

function normalizeScribe (data) {
  const words = (data.words || [])
    .filter(w => (w.type ? w.type === 'word' : true))
    .map(w => ({ w: w.text, start: Number(w.start), end: Number(w.end) }))
  const durationS = words.length ? words[words.length - 1].end : 0
  return {
    text: data.text || words.map(w => w.w).join(' '),
    language: data.language_code || data.language || null,
    words,
    duration_s: Number(durationS)
  }
}

module.exports = { transcribe, normalizeScribe }

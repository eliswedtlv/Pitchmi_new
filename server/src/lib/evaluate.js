'use strict'

// AI delivery evaluation (§8). Provider interface with an OpenRouter default
// and a direct Gemini generateContent fallback, switched by EVAL_PROVIDER.
//
//   evaluateVideo(bytes, mime, promptCtx) -> { voice, body, delivery, comments }

const fs = require('fs')
const path = require('path')
const config = require('../config')
const db = require('./db')

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'eval.md')
let PROMPT_TEMPLATE = null
function promptTemplate () {
  if (PROMPT_TEMPLATE == null) PROMPT_TEMPLATE = fs.readFileSync(PROMPT_PATH, 'utf8')
  return PROMPT_TEMPLATE
}

const USE_CASE_GUIDANCE = {
  pitch: 'pitch → tight, energetic, confident.',
  intro: 'intro → warm, relaxed, approachable.',
  sales: 'sales → persuasive, benefit-forward energy.',
  social: 'social → expressive, personality-forward.'
}

function buildPrompt ({ useCase, useCaseCustom, language }) {
  let guidance = USE_CASE_GUIDANCE[useCase]
  if (useCase === 'custom' || !guidance) {
    guidance = `custom → adapt delivery expectations to: ${useCaseCustom || 'the speaker\'s described goal'}.`
  }
  return promptTemplate()
    .replace('{{USE_CASE_GUIDANCE}}', guidance)
    .replace('{{LANGUAGE}}', language || 'the take\'s spoken language')
}

// Pull a JSON object out of raw model text: strip markdown code fences, then
// return the first balanced {...} block, tolerating leading/trailing prose.
function extractJsonBlock (text) {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

// Validate + coerce the model output into the strict shape.
function parseResult (raw) {
  let obj = raw
  if (typeof raw === 'string') {
    const block = extractJsonBlock(raw)
    if (!block) throw new Error('no JSON object in model output')
    obj = JSON.parse(block)
  }
  const clamp = v => Math.max(0, Math.min(100, Math.round(Number(v))))
  const voice = clamp(obj.voice)
  const body = clamp(obj.body)
  const delivery = clamp(obj.delivery)
  let comments = Array.isArray(obj.comments) ? obj.comments.map(String) : []
  comments = comments.slice(0, 3)
  while (comments.length < 3) comments.push('')
  if ([voice, body, delivery].some(n => !Number.isFinite(n))) throw new Error('non-numeric score')
  return { voice, body, delivery, comments }
}

// --- OpenRouter (chat completions with a video content part) ---

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Base64 data-URL video is only accepted by OpenRouter's Vertex Gemini backend;
// the AI-Studio backend takes YouTube URLs only, so an unrestricted request
// 500s whenever OpenRouter load-balances us onto AI Studio (T-1162 §A). Pin the
// request to Vertex and disable fallbacks so we never hit AI Studio.
async function callOpenRouter (bytes, mime, prompt) {
  if (!config.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set')
  // Real per-take mime (video/mp4 from iOS, video/webm from Chrome) — never
  // hardcoded, or Vertex rejects the container.
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
  const body = JSON.stringify({
    model: config.EVAL_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    // Provider routing: base64 video → Vertex only, no silent fallback.
    provider: { only: ['google-vertex'], allow_fallbacks: false },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        // REST API is snake_case `video_url` (the TS SDK camelCases it).
        { type: 'video_url', video_url: { url: dataUrl } }
      ]
    }]
  })

  // Retry transient upstream 5xx (up to 2 extra tries) with short backoff. This
  // is separate from the JSON-body retries in evaluateVideo, which only fire on
  // a 200 that fails to parse.
  let lastStatus
  let lastBody = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body
    })
    if (res.ok) {
      const data = await res.json()
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        // OpenRouter echoes which upstream served the call — metadata only.
        upstream: data.provider || null
      }
    }
    lastStatus = res.status
    lastBody = await res.text().catch(() => '')
    if (res.status >= 500 && attempt < 2) {
      await sleep(250 * (attempt + 1))
      continue
    }
    break
  }
  throw new Error(`OpenRouter ${lastStatus}: ${lastBody.slice(0, 300)}`)
}

// --- Gemini direct (generateContent with inline_data) ---

async function callGemini (bytes, mime, prompt) {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  const model = config.EVAL_MODEL.replace(/^google\//, '')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: bytes.toString('base64') } }
        ]
      }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  return {
    content: data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '',
    upstream: 'gemini-direct'
  }
}

async function callProvider (bytes, mime, prompt) {
  return config.EVAL_PROVIDER === 'gemini'
    ? callGemini(bytes, mime, prompt)
    : callOpenRouter(bytes, mime, prompt)
}

const STRICT_REMINDER = '\n\nReturn ONLY the JSON object, no prose, no fences.'

async function evaluateVideo (bytes, mime, promptCtx) {
  const prompt = buildPrompt(promptCtx || {})
  let lastRaw = ''
  let upstream = null
  // JSON-body retries only: initial, one plain retry, then a stricter retry
  // that appends a terse reminder demanding bare JSON. Transport-level failures
  // (e.g. persistent upstream 5xx) are already retried inside callProvider and
  // must NOT burn these attempts — they surface immediately.
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = attempt === 2 ? prompt + STRICT_REMINDER : prompt
    // Transport failures (persistent 5xx, 4xx) throw straight out of the
    // function — they are not JSON-body failures, so no extra parse retries.
    const { content, upstream: up } = await callProvider(bytes, mime, p)
    upstream = up
    try {
      const parsed = parseResult(content)
      parsed.attempts = attempt + 1
      parsed.upstream = upstream
      return parsed
    } catch (parseErr) {
      lastRaw = content
      if (attempt === 2) {
        // Final parse failure: metadata-only diagnostic. Privacy rule — never the
        // model text itself, only its length, whether it was fenced, the provider.
        await db.logEvent({
          action: 'error',
          error: `eval_parse_fail provider=${config.EVAL_PROVIDER} upstream=${upstream || 'unknown'} len=${lastRaw.length} fenced=${lastRaw.includes('```')}`
        })
        throw parseErr
      }
    }
  }
}

module.exports = { evaluateVideo, buildPrompt, parseResult }

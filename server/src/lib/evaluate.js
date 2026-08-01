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

// Per-attempt upstream timeout and the default total pipeline budget (T-1165).
// A single upstream fetch that stalls past PER_ATTEMPT_MS is aborted and counts
// as a retryable failure; the deadline caps the total time across all retries so
// the handler can never hang until the client's 5-min timeout fires.
const PER_ATTEMPT_MS = 60000
const TOTAL_BUDGET_MS = 240000

// Tagged error the route maps to 504 (eval_upstream_timeout).
function timeoutError () {
  const e = new Error('eval_upstream_timeout')
  e.code = 'eval_upstream_timeout'
  e.status = 504
  return e
}

// fetch with a hard per-attempt timeout. The response BODY is read under the
// same timer, not just the headers (T-1166): a stalled stream after the headers
// arrive would otherwise run unbounded past the deadline — the source of the
// 304s overrun on a 240s budget. Returns { ok, status, text } so the whole
// attempt is capped at timeoutMs and 240s stays a true ceiling. The timer is
// always cleared so no dangling handle survives (keeps Jest's loop clean).
async function fetchWithTimeout (url, opts, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('upstream_timeout')), Math.max(1, timeoutMs))
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } finally {
    clearTimeout(timer)
  }
}

// Base64 data-URL video is only accepted by OpenRouter's Vertex Gemini backend;
// the AI-Studio backend takes YouTube URLs only, so an unrestricted request
// 500s whenever OpenRouter load-balances us onto AI Studio (T-1162 §A). Pin the
// request to Vertex and disable fallbacks so we never hit AI Studio.
async function callOpenRouter (bytes, mime, prompt, deadline) {
  if (!config.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set')
  // Real per-take mime (video/mp4 from iOS, video/webm from Chrome) — never
  // hardcoded, or Vertex rejects the container.
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
  const body = JSON.stringify({
    model: config.EVAL_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    // Ask OpenRouter to return what it actually billed (T-1172). `usage.cost`
    // is real USD, already correct for the model's per-modality rates — never
    // re-derive it from token counts and a hardcoded price table, which would
    // rot the moment OpenRouter reprices.
    usage: { include: true },
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
    // Out of budget before this attempt even starts → stop retrying now.
    if (Date.now() >= deadline) throw timeoutError()
    const perAttempt = Math.min(PER_ATTEMPT_MS, deadline - Date.now())
    let res
    try {
      res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body
      }, perAttempt)
    } catch (err) {
      // Timed out / aborted / network drop — a retryable failure, like a 5xx.
      lastStatus = 'timeout'
      if (attempt < 2 && Date.now() < deadline) {
        await sleep(250 * (attempt + 1))
        continue
      }
      throw timeoutError()
    }
    if (res.ok) {
      const data = JSON.parse(res.text)
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        // OpenRouter echoes which upstream served the call — metadata only.
        upstream: data.provider || null,
        // Absent when the account/model doesn't report it — never throw on it.
        usage: data.usage ?? null
      }
    }
    lastStatus = res.status
    lastBody = res.text || ''
    if (res.status >= 500 && attempt < 2) {
      await sleep(250 * (attempt + 1))
      continue
    }
    break
  }
  throw new Error(`OpenRouter ${lastStatus}: ${lastBody.slice(0, 300)}`)
}

// --- Gemini direct (generateContent with inline_data) ---

async function callGemini (bytes, mime, prompt, deadline) {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  if (Date.now() >= deadline) throw timeoutError()
  const model = config.EVAL_MODEL.replace(/^google\//, '')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`
  const perAttempt = Math.min(PER_ATTEMPT_MS, deadline - Date.now())
  let res
  try {
    res = await fetchWithTimeout(url, {
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
    }, perAttempt)
  } catch (err) {
    throw timeoutError()
  }
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(res.text || '').slice(0, 300)}`)
  }
  const data = JSON.parse(res.text)
  const meta = data.usageMetadata || null
  return {
    content: data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '',
    upstream: 'gemini-direct',
    // The direct Gemini API reports tokens but not spend. cost stays null —
    // inventing a figure here would be a lie in the admin dashboard.
    usage: meta
      ? {
          cost: null,
          prompt_tokens: meta.promptTokenCount ?? 0,
          completion_tokens: meta.candidatesTokenCount ?? 0,
          total_tokens: meta.totalTokenCount ?? 0
        }
      : null
  }
}

async function callProvider (bytes, mime, prompt, deadline) {
  return config.EVAL_PROVIDER === 'gemini'
    ? callGemini(bytes, mime, prompt, deadline)
    : callOpenRouter(bytes, mime, prompt, deadline)
}

const STRICT_REMINDER = '\n\nReturn ONLY the JSON object, no prose, no fences.'

// Every upstream attempt was billed, so a take that needed three parse retries
// really did cost three calls — sum, don't overwrite (T-1172). `cost` stays
// null until some attempt reports one (gemini-direct never does), so a null
// total means "not reported", not "free".
function addUsage (acc, u) {
  if (!u) return acc
  const next = acc || { cost: null, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  if (typeof u.cost === 'number') next.cost = (next.cost ?? 0) + u.cost
  next.prompt_tokens += Number(u.prompt_tokens) || 0
  next.completion_tokens += Number(u.completion_tokens) || 0
  next.total_tokens += Number(u.total_tokens) || 0
  return next
}

async function evaluateVideo (bytes, mime, promptCtx, opts = {}) {
  const deadline = opts.deadline || (Date.now() + TOTAL_BUDGET_MS)
  const prompt = buildPrompt(promptCtx || {})
  let lastRaw = ''
  let upstream = null
  let usage = null
  // JSON-body retries only: initial, one plain retry, then a stricter retry
  // that appends a terse reminder demanding bare JSON. Transport-level failures
  // (e.g. persistent upstream 5xx or timeouts) are already retried inside
  // callProvider and must NOT burn these attempts — they surface immediately.
  for (let attempt = 0; attempt < 3; attempt++) {
    // Never start another parse attempt once the budget is spent.
    if (Date.now() >= deadline) throw timeoutError()
    const p = attempt === 2 ? prompt + STRICT_REMINDER : prompt
    // Transport failures (persistent 5xx, 4xx, timeout) throw straight out of
    // the function — they are not JSON-body failures, so no extra parse retries.
    const { content, upstream: up, usage: u } = await callProvider(bytes, mime, p, deadline)
    upstream = up
    usage = addUsage(usage, u)
    try {
      const parsed = parseResult(content)
      parsed.attempts = attempt + 1
      parsed.upstream = upstream
      parsed.usage = usage
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

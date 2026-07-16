'use strict'

// AI delivery evaluation (§8). Provider interface with an OpenRouter default
// and a direct Gemini generateContent fallback, switched by EVAL_PROVIDER.
//
//   evaluateVideo(bytes, mime, promptCtx) -> { voice, body, delivery, comments }

const fs = require('fs')
const path = require('path')
const config = require('../config')

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

// Validate + coerce the model output into the strict shape.
function parseResult (raw) {
  let obj = raw
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON object in model output')
    obj = JSON.parse(match[0])
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

async function callOpenRouter (bytes, mime, prompt) {
  if (!config.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set')
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.EVAL_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'video_url', video_url: { url: dataUrl } }
        ]
      }]
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
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
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? ''
}

async function callProvider (bytes, mime, prompt) {
  return config.EVAL_PROVIDER === 'gemini'
    ? callGemini(bytes, mime, prompt)
    : callOpenRouter(bytes, mime, prompt)
}

async function evaluateVideo (bytes, mime, promptCtx) {
  const prompt = buildPrompt(promptCtx || {})
  let lastErr
  // One retry on malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callProvider(bytes, mime, prompt)
      return parseResult(raw)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

module.exports = { evaluateVideo, buildPrompt, parseResult }

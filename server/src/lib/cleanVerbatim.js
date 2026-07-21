'use strict'

// Clean-verbatim transcript draft (T-1163 §B). One cheap TEXT-ONLY LLM call that
// turns raw STT output into an industry "clean verbatim" draft in the SAME
// language: remove false starts, stutters, word repetitions and self-corrections,
// fix obvious STT misrecognitions, add standard punctuation and capitalization —
// NEVER paraphrase, summarise, reorder, or translate. The wording stays the
// speaker's own.
//
//   cleanVerbatim(text, language) -> string[] | null
//
// Returns an array of sentences on success, or null on ANY failure so the caller
// can fall back silently to the deterministic filler-stripped text. This feature
// must degrade, never break transcribe.

const config = require('../config')

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

function buildPrompt (text, language) {
  const lang = language || 'the transcript\'s own language'
  return [
    'You are a professional transcriptionist producing a CLEAN VERBATIM draft.',
    `The transcript language is ${lang}. Keep the SAME language — never translate.`,
    '',
    'From the raw speech-to-text below, produce a clean-verbatim version:',
    '- Remove false starts, stutters, word repetitions and self-corrections',
    '  (e.g. "we, we went" -> "we went"; "I think I think" -> "I think").',
    '- Fix speech-to-text misrecognitions ONLY when the correction is obvious',
    '  from context.',
    '- Add standard punctuation and capitalization.',
    '- NEVER paraphrase, summarise, reorder, add, or translate. The wording must',
    '  stay the speaker\'s own words.',
    '',
    'Return ONLY a JSON object of the form {"sentences": ["…", "…"]}, one natural',
    'sentence per array item, in the original spoken order.',
    '',
    'RAW TRANSCRIPT:',
    text
  ].join('\n')
}

// Pull the JSON object out of the model text (tolerate accidental code fences)
// and return the sentences array of non-empty strings, or null if unusable.
function parseSentences (content) {
  if (!content) return null
  let s = String(content).trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  let obj
  try {
    obj = JSON.parse(s.slice(start, end + 1))
  } catch {
    return null
  }
  if (!obj || !Array.isArray(obj.sentences)) return null
  const sentences = obj.sentences
    .map(x => String(x).trim())
    .filter(Boolean)
  return sentences.length ? sentences : null
}

async function cleanVerbatim (text, language) {
  if (!config.OPENROUTER_API_KEY) return null
  if (!text || !text.trim()) return null
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.EVAL_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildPrompt(text, language) }]
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    return parseSentences(content)
  } catch {
    return null
  }
}

module.exports = { cleanVerbatim, parseSentences, buildPrompt }

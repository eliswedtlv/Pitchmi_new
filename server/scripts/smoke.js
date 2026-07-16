'use strict'

// Full-pipeline smoke test against the bundled sample video. Runs ONLY when the
// real external-API keys are present; otherwise it reports "not run" and exits
// 0 (this is intentionally excluded from CI — see spec §13).
//
//   node --env-file=.env scripts/smoke.js

const fs = require('fs')
const path = require('path')
const config = require('../src/config')
const { extractAudio } = require('../src/lib/audio')
const { transcribe } = require('../src/lib/scribe')
const { buildPath } = require('../src/lib/path')
const { scoreTake } = require('../src/lib/score')
const { evaluateVideo } = require('../src/lib/evaluate')
const { combineResult } = require('../src/lib/combine')

async function main () {
  const hasStt = !!config.ELEVENLABS_API_KEY
  const hasEval = config.EVAL_PROVIDER === 'gemini' ? !!config.GEMINI_API_KEY : !!config.OPENROUTER_API_KEY
  if (!hasStt || !hasEval) {
    console.log('smoke: NOT RUN — missing API keys (ELEVENLABS_API_KEY and an eval provider key required).')
    process.exit(0)
  }

  const samplePath = path.join(__dirname, '..', 'tests', 'fixtures', 'sample.mp4')
  const video = fs.readFileSync(samplePath)
  console.log(`sample: ${samplePath} (${(video.length / 1024).toFixed(1)} KB)`)

  console.log('1/4 extracting audio…')
  const audio = await extractAudio(video, 'mp4')

  console.log('2/4 transcribing (Scribe)…')
  const take = await transcribe(audio.buffer, audio.mime)
  console.log(`   language=${take.language} words=${take.words.length} duration=${take.duration_s}s`)

  console.log('3/4 building path + scoring…')
  const { path: pathObj } = buildPath(take.words, take.text, 1)
  const scored = scoreTake(take.words, pathObj)

  console.log('4/4 evaluating delivery (AI)…')
  const delivery = await evaluateVideo(video, 'video/mp4', { useCase: 'pitch', language: take.language })

  const combined = combineResult({
    voice: delivery.voice,
    body: delivery.body,
    delivery: delivery.delivery,
    timing: scored.timing,
    accuracy: scored.accuracy
  })

  const result = {
    overall: combined.overall,
    dimensions: combined.dimensions,
    comments: delivery.comments,
    flags: scored.flags,
    language: take.language
  }
  console.log('\nRESULT:\n' + JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error('smoke FAILED:', err.message)
  process.exit(1)
})

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
const { buildPathFromScript } = require('../src/lib/scriptPath')

async function main () {
  const hasStt = !!config.ELEVENLABS_API_KEY
  if (!hasStt) {
    console.log('smoke: NOT RUN — missing ELEVENLABS_API_KEY.')
    process.exit(0)
  }

  const samplePath = path.join(__dirname, '..', 'tests', 'fixtures', 'sample.mp4')
  const video = fs.readFileSync(samplePath)
  console.log(`sample: ${samplePath} (${(video.length / 1024).toFixed(1)} KB)`)

  console.log('1/3 extracting audio…')
  const audio = await extractAudio(video, 'mp4')

  console.log('2/3 transcribing (Scribe)…')
  const take = await transcribe(audio.buffer, audio.mime)
  console.log(`   language=${take.language} words=${take.words.length} duration=${take.duration_s}s`)

  console.log('3/3 building measured rhythm…')
  const result = buildPathFromScript(take.text, take.words)
  console.log('\nRESULT:\n' + JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error('smoke FAILED:', err.message)
  process.exit(1)
})

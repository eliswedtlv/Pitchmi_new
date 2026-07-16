'use strict'

// Generate tiny bundled fixtures with the ffmpeg-static binary (no system
// ffmpeg): a 3s test-pattern + tone sample video for tests/smoke, and a short
// demo ad clip for the FE wait screen.

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')

function gen (outPath, durationS) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const args = [
    '-f', 'lavfi', '-i', `testsrc=duration=${durationS}:size=320x240:rate=15`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${durationS}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k',
    '-shortest', '-y', outPath
  ]
  const r = spawnSync(ffmpegPath, args, { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${outPath}`)
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1)
  console.log(`wrote ${outPath} (${kb} KB)`)
}

const root = path.join(__dirname, '..', '..')
gen(path.join(__dirname, '..', 'tests', 'fixtures', 'sample.mp4'), 3)
gen(path.join(root, 'client', 'public', 'ads', 'demo.mp4'), 6)
console.log('done')

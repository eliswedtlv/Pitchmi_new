'use strict'

// Generate tiny bundled fixtures with the ffmpeg-static binary (no system
// ffmpeg): a 3s test-pattern + tone sample video for tests/smoke, and a short
// branded demo ad clip for the FE wait screen.

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')

// Pick the first font that exists (macOS build hosts). drawtext needs an
// explicit fontfile because the bundled ffmpeg has no fontconfig.
function findFont (candidates) {
  const hit = candidates.find(p => fs.existsSync(p))
  if (!hit) throw new Error(`no font found among: ${candidates.join(', ')}`)
  return hit
}

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

// Branded ~15s self-promo placeholder: dark diagonal gradient, "PitchMi"
// wordmark + "Nail your minute." tagline, subtle breathing motion. The text
// alpha/position use sin(2*PI*t/DUR) so frame 0 == last frame — seamless loop.
// The AdSlot overlays the "Ad" label + Skip button; nothing is baked in.
function genAd (outPath, durationS) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const wordFont = findFont([
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc'
  ])
  const tagFont = findFont([
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc'
  ])
  const period = `2*PI*t/${durationS}`
  const vf = [
    `drawtext=fontfile=${wordFont}:text='PitchMi':fontcolor=white:fontsize=140` +
      `:x=(w-text_w)/2:y=(h/2)-130+10*sin(${period}):alpha='0.90+0.10*sin(${period})'` +
      ':shadowcolor=black@0.45:shadowx=0:shadowy=5',
    `drawtext=fontfile=${tagFont}:text='Nail your minute.':fontcolor=0xc7d2fe:fontsize=52` +
      `:x=(w-text_w)/2:y=(h/2)+40:alpha='0.80+0.20*sin(${period})'`
  ].join(',')
  const gradient = 'gradients=s=1280x720:c0=0x0a0a1a:c1=0x2a1e63:c2=0x0a0a1a:nb_colors=3' +
    `:x0=0:y0=0:x1=1280:y1=720:speed=0.00001:duration=${durationS}:rate=30`
  const args = [
    '-f', 'lavfi', '-i', gradient,
    '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-crf', '26', '-movflags', '+faststart', '-an', '-t', String(durationS),
    '-y', outPath
  ]
  const r = spawnSync(ffmpegPath, args, { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${outPath}`)
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1)
  console.log(`wrote ${outPath} (${kb} KB)`)
}

const root = path.join(__dirname, '..', '..')
gen(path.join(__dirname, '..', 'tests', 'fixtures', 'sample.mp4'), 3)
genAd(path.join(root, 'client', 'public', 'ads', 'demo.mp4'), 15)
console.log('done')

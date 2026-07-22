'use strict'

// Audio extraction using the bundled ffmpeg-static binary (no system ffmpeg).
// Converts an uploaded webm/mp4 video into mono 16kHz m4a suitable for Scribe.

const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')

// Extract audio from a video buffer. Returns { buffer, mime, ext }.
async function extractAudio (videoBuffer, inputExt = 'webm') {
  const tmp = os.tmpdir()
  const id = randomUUID()
  const inPath = path.join(tmp, `pitchmi-${id}-in.${inputExt}`)
  const outPath = path.join(tmp, `pitchmi-${id}-out.m4a`)
  await fs.writeFile(inPath, videoBuffer)
  try {
    await runFfmpeg(['-i', inPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '64k', '-y', outPath])
    const buffer = await fs.readFile(outPath)
    return { buffer, mime: 'audio/mp4', ext: 'm4a' }
  } finally {
    await fs.rm(inPath, { force: true }).catch(() => {})
    await fs.rm(outPath, { force: true }).catch(() => {})
  }
}

// Minimal video proxy for the AI delivery eval (T-1166). Real takes (60s
// portrait mp4, tens of MB) exceed the ~20MB base64 request ceiling of the
// Gemini/Vertex backend and stall every attempt until it times out. Transcode
// to the smallest payload that still lets the model score delivery: 2fps, 360px
// short side (aspect + rotation preserved), H.264 crf 32, mono AAC 64k (voice
// quality matters for scoring — do not starve the audio), faststart mp4. A 60s
// take lands around 1–3MB. Returns { buffer, mime }.
async function transcodeForEval (videoBuffer, inputExt = 'webm') {
  const tmp = os.tmpdir()
  const id = randomUUID()
  const inPath = path.join(tmp, `pitchmi-${id}-in.${inputExt}`)
  const outPath = path.join(tmp, `pitchmi-${id}-eval.mp4`)
  await fs.writeFile(inPath, videoBuffer)
  try {
    await runFfmpeg([
      '-i', inPath,
      '-vf', "fps=2,scale='if(gt(iw,ih),-2,360)':'if(gt(iw,ih),360,-2)'",
      '-c:v', 'libx264', '-crf', '32', '-preset', 'veryfast',
      '-ac', '1', '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      '-y', outPath
    ])
    const buffer = await fs.readFile(outPath)
    return { buffer, mime: 'video/mp4' }
  } finally {
    await fs.rm(inPath, { force: true }).catch(() => {})
    await fs.rm(outPath, { force: true }).catch(() => {})
  }
}

function runFfmpeg (args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg-static binary not found'))
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))
    })
  })
}

// Best-effort extension from a mime type.
function extForMime (mime) {
  if (!mime) return 'webm'
  if (mime.includes('mp4') || mime.includes('quicktime')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  return 'webm'
}

module.exports = { extractAudio, transcodeForEval, extForMime }

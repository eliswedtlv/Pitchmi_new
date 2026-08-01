'use strict'

// Audio extraction using the bundled ffmpeg-static binary (no system ffmpeg).
// Converts an uploaded webm/mp4 video into mono 16kHz m4a suitable for Scribe.

const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')
const config = require('../config')

// The true container, read from the file's own first bytes (T-10010).
//
// The declared mime cannot decide this. It is attacker-controlled, and it is
// useless even on the happy path: busboy fails to parse the parameterized types
// real browsers send (`video/webm;codecs=vp9,opus`) and reports `text/plain`,
// so multer's `file.mimetype` is `text/plain` for every Chrome and Firefox take.
// Picking the demuxer from that would reject real recordings.
//
// Returns 'webm' | 'mp4' | null.
function sniffContainer (buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  // EBML magic — Matroska / WebM.
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm'
  // ISO-BMFF `ftyp` box at offset 4 — mp4 / m4v / mov.
  if (buffer.toString('latin1', 4, 8) === 'ftyp') return 'mp4'
  return null
}

function unsupportedMedia () {
  const err = new Error('unsupported_media_type')
  err.code = 'UNSUPPORTED_MEDIA_TYPE'
  return err
}

// Input hardening (T-10010). `-i <file>` with no `-f` lets ffmpeg sniff the
// container itself, so an upload declared video/webm that actually holds an HLS
// or concat playlist makes ffmpeg follow file:// and http:// references — and
// the bytes it reads come back to the caller through the transcript. Pin the
// demuxer to the container we identified and allow only the local file protocol.
function inputArgs (container) {
  const demuxer = container === 'mp4' ? 'mp4' : 'matroska,webm'
  return ['-protocol_whitelist', 'file', '-f', demuxer, '-i']
}

// Extract audio from a video buffer. Returns { buffer, mime, ext, duration_s }.
//
// duration_s is the TRUE media duration, read for free from this decode's own
// stderr (T-1172). `ffmpeg -i` header parsing is NOT an option: Chrome's
// MediaRecorder emits a streaming WebM whose header carries no duration and
// ffmpeg reports `Duration: N/A`. The running `time=` progress lines are
// emitted by the full decode we already run, so the last one is the real
// length at zero extra cost. null when no `time=` line was printed.
async function extractAudio (videoBuffer) {
  const container = sniffContainer(videoBuffer)
  if (!container) throw unsupportedMedia()
  const tmp = os.tmpdir()
  const id = randomUUID()
  const inPath = path.join(tmp, `pitchmi-${id}-in.${container}`)
  const outPath = path.join(tmp, `pitchmi-${id}-out.m4a`)
  await fs.writeFile(inPath, videoBuffer)
  try {
    const stderr = await runFfmpeg([...inputArgs(container), inPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '64k', '-y', outPath])
    const buffer = await fs.readFile(outPath)
    return { buffer, mime: 'audio/mp4', ext: 'm4a', duration_s: parseFfmpegDuration(stderr) }
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
async function transcodeForEval (videoBuffer) {
  const container = sniffContainer(videoBuffer)
  if (!container) throw unsupportedMedia()
  const tmp = os.tmpdir()
  const id = randomUUID()
  const inPath = path.join(tmp, `pitchmi-${id}-in.${container}`)
  const outPath = path.join(tmp, `pitchmi-${id}-eval.mp4`)
  await fs.writeFile(inPath, videoBuffer)
  try {
    await runFfmpeg([
      ...inputArgs(container), inPath,
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

// Resolves with the accumulated stderr (the caller may mine it for `time=`
// progress); rejects on a non-zero exit exactly as before.
//
// Two guards (T-10010): `-nostdin` plus an ignored stdin, because an open stdin
// pipe lets a malformed container park ffmpeg on an interactive prompt forever;
// and a hard kill timer, because "resolves only on close" means a wedged child
// also strands the caller's temp files and its 60MB buffer.
function runFfmpeg (args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg-static binary not found'))
    const proc = spawn(ffmpegPath, ['-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let timer = setTimeout(() => {
      timer = null
      proc.kill('SIGKILL')
      reject(new Error('ffmpeg_timeout'))
    }, config.FFMPEG_TIMEOUT_MS)
    const done = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', err => {
      done()
      reject(err)
    })
    proc.on('close', code => {
      done()
      if (code === 0) resolve(stderr)
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))
    })
  })
}

// Last `time=HH:MM:SS.mss` progress value in an ffmpeg stderr dump, in seconds.
// null when the dump has no such line (a very short or silent clip can finish
// before ffmpeg prints one) — callers must fail open on null.
const TIME_RE = /time=(\d+):(\d\d):(\d\d\.\d+)/g

function parseFfmpegDuration (stderr) {
  if (!stderr) return null
  let last = null
  for (const m of String(stderr).matchAll(TIME_RE)) last = m
  if (!last) return null
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3])
}

module.exports = { extractAudio, transcodeForEval, sniffContainer, parseFfmpegDuration }

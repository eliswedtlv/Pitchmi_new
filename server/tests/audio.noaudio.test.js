'use strict'

// Launch blocker 2026-10-15: a video-only take made ffmpeg fail with a generic
// error, which /api/rhythm turned into a 500. Real ffmpeg, no mocks.
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ffmpeg = require('ffmpeg-static')
const { extractAudio } = require('../src/lib/audio')

test('a video-only webm (no audio track) rejects with NO_AUDIO', async () => {
  const out = path.join(os.tmpdir(), `kp-noaudio-${process.pid}.webm`)
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=d=1:s=160x120', '-c:v', 'libvpx', '-f', 'webm', out])
  try {
    await expect(extractAudio(fs.readFileSync(out))).rejects.toMatchObject({ code: 'NO_AUDIO' })
  } finally {
    fs.rmSync(out, { force: true })
  }
}, 20000)

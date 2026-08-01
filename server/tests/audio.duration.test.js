'use strict'

// T-1172: the true media duration is read for free from extractAudio's own
// ffmpeg decode stderr. `ffmpeg -i` header parsing is NOT usable — Chrome's
// MediaRecorder webm has no header duration — so the running `time=` progress
// lines are the source, and the LAST one is the length.

const { parseFfmpegDuration } = require('../src/lib/audio')

describe('parseFfmpegDuration', () => {
  test('returns the LAST time= value, in seconds', () => {
    const stderr = [
      'frame=   30 fps=0.0 q=-1.0 size=      12kB time=00:00:01.02 bitrate=  96.4kbits/s',
      'frame=  600 fps=120 q=-1.0 size=     240kB time=00:00:20.48 bitrate=  96.0kbits/s',
      'frame=  930 fps=120 q=-1.0 Lsize=     372kB time=00:00:31.50 bitrate=  96.7kbits/s'
    ].join('\n')
    expect(parseFfmpegDuration(stderr)).toBeCloseTo(31.5, 5)
  })

  test('parses hours and minutes, not just seconds', () => {
    expect(parseFfmpegDuration('time=01:02:03.25 bitrate=1kbits/s')).toBeCloseTo(3723.25, 5)
  })

  test('no time= line -> null (caller must fail open)', () => {
    expect(parseFfmpegDuration('ffmpeg version 6.0\nDuration: N/A, start: 0.000\n')).toBeNull()
  })

  test('empty / missing stderr -> null', () => {
    expect(parseFfmpegDuration('')).toBeNull()
    expect(parseFfmpegDuration(undefined)).toBeNull()
  })
})

describe('extractAudio on the real 3s fixture', () => {
  // Runs the bundled ffmpeg-static binary for real against tests/fixtures/
  // sample.mp4 (3s, from scripts/make-sample.js).
  jest.setTimeout(30000)

  test('reports duration_s within ±0.2s of the known 3s length', async () => {
    const fs = require('fs')
    const path = require('path')
    const { extractAudio } = require('../src/lib/audio')

    const fixture = path.join(__dirname, 'fixtures', 'sample.mp4')
    const out = await extractAudio(fs.readFileSync(fixture), 'mp4')

    expect(out.mime).toBe('audio/mp4')
    expect(out.buffer.length).toBeGreaterThan(0)
    expect(out.duration_s).not.toBeNull()
    expect(out.duration_s).toBeGreaterThan(2.8)
    expect(out.duration_s).toBeLessThan(3.2)
  })
})

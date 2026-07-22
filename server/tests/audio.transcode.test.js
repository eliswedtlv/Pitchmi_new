'use strict'

// T-1166: transcodeForEval must build the minimal eval proxy with the exact
// ffmpeg args (2fps, 360px short side, H.264 crf 32 veryfast, mono AAC 64k,
// faststart mp4). spawn is mocked so no real ffmpeg runs.

const { EventEmitter } = require('events')

jest.mock('ffmpeg-static', () => '/fake/ffmpeg')

const mockSpawn = jest.fn(() => {
  const proc = new EventEmitter()
  proc.stderr = new EventEmitter()
  // Resolve the ffmpeg run on the next tick with a clean exit code.
  process.nextTick(() => proc.emit('close', 0))
  return proc
})
jest.mock('child_process', () => ({ spawn: (...args) => mockSpawn(...args) }))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(async () => {}),
  readFile: jest.fn(async () => Buffer.from('proxy-video-bytes')),
  rm: jest.fn(async () => {})
}))

const { transcodeForEval } = require('../src/lib/audio')

beforeEach(() => mockSpawn.mockClear())

describe('transcodeForEval — minimal 2fps eval proxy (T-1166)', () => {
  test('invokes ffmpeg-static with the exact compression args', async () => {
    const out = await transcodeForEval(Buffer.from('raw-take'), 'mp4')

    expect(out).toEqual({ buffer: Buffer.from('proxy-video-bytes'), mime: 'video/mp4' })
    expect(mockSpawn).toHaveBeenCalledTimes(1)
    expect(mockSpawn).toHaveBeenCalledWith('/fake/ffmpeg', [
      '-i', expect.stringContaining('-in.mp4'),
      '-vf', "fps=2,scale='if(gt(iw,ih),-2,360)':'if(gt(iw,ih),360,-2)'",
      '-c:v', 'libx264', '-crf', '32', '-preset', 'veryfast',
      '-ac', '1', '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      '-y', expect.stringContaining('-eval.mp4')
    ])
  })
})

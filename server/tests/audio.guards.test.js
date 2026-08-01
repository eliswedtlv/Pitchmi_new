'use strict'

// T-10010: every ffmpeg invocation must carry the input guards, the container
// must come from the file's own bytes rather than a client-supplied header, and
// a child that never exits must be killed instead of stranding the handler.

const { EventEmitter } = require('events')

jest.mock('ffmpeg-static', () => '/fake/ffmpeg')

let lastProc = null
const mockSpawn = jest.fn(() => {
  const proc = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = jest.fn()
  lastProc = proc
  return proc
})
jest.mock('child_process', () => ({ spawn: (...args) => mockSpawn(...args) }))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(async () => {}),
  readFile: jest.fn(async () => Buffer.from('out-bytes')),
  rm: jest.fn(async () => {})
}))

const { extractAudio, transcodeForEval, sniffContainer } = require('../src/lib/audio')

// Minimal buffers that carry a real container signature.
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm-payload-bytes')])
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.from('mp4-payload')])

function closeSoon (code = 0) {
  process.nextTick(() => lastProc && lastProc.emit('close', code))
}

beforeEach(() => {
  mockSpawn.mockClear()
  lastProc = null
})

describe('sniffContainer', () => {
  test('reads the container from magic bytes, not the extension', () => {
    expect(sniffContainer(WEBM)).toBe('webm')
    expect(sniffContainer(MP4)).toBe('mp4')
  })

  test('anything else is unidentifiable', () => {
    expect(sniffContainer(Buffer.from('#EXTM3U\nhttp://evil/'))).toBeNull()
    expect(sniffContainer(Buffer.from('short'))).toBeNull()
    expect(sniffContainer(null)).toBeNull()
  })
})

describe('ffmpeg input guards', () => {
  test('extractAudio pins protocol + demuxer and closes stdin', async () => {
    const p = extractAudio(WEBM)
    closeSoon(0)
    await p

    const [bin, args, opts] = mockSpawn.mock.calls[0]
    expect(bin).toBe('/fake/ffmpeg')
    expect(args[0]).toBe('-nostdin')
    expect(args.slice(1, 5)).toEqual(['-protocol_whitelist', 'file', '-f', 'matroska,webm'])
    expect(args[5]).toBe('-i')
    expect(opts).toEqual({ stdio: ['ignore', 'pipe', 'pipe'] })
  })

  test('transcodeForEval pins them too, with the mp4 demuxer for an mp4 input', async () => {
    const p = transcodeForEval(MP4)
    closeSoon(0)
    await p

    const args = mockSpawn.mock.calls[0][1]
    expect(args.slice(0, 6)).toEqual(['-nostdin', '-protocol_whitelist', 'file', '-f', 'mp4', '-i'])
  })

  test('a playlist declared as a video never reaches ffmpeg', async () => {
    const evil = Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:1\nfile:///etc/passwd')
    await expect(extractAudio(evil)).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
    await expect(transcodeForEval(evil)).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
    expect(mockSpawn).not.toHaveBeenCalled()
  })
})

describe('ffmpeg timeout', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  test('a child that never closes is SIGKILLed and the promise rejects', async () => {
    const p = extractAudio(WEBM)
    // Let the write + spawn settle before the clock jumps.
    await Promise.resolve()
    await Promise.resolve()
    jest.advanceTimersByTime(60000)

    await expect(p).rejects.toThrow('ffmpeg_timeout')
    expect(lastProc.kill).toHaveBeenCalledWith('SIGKILL')
  })

  test('a clean exit clears the timer, so no stray kill fires later', async () => {
    const p = extractAudio(WEBM)
    await Promise.resolve()
    await Promise.resolve()
    lastProc.emit('close', 0)
    await p

    jest.advanceTimersByTime(120000)
    expect(lastProc.kill).not.toHaveBeenCalled()
  })
})

'use strict'

// T-10010 — what may reach ffmpeg, in two layers.
//
// Layer 1 (middleware/upload.js) is a cheap declared-mime gate that keeps an
// obviously-wrong body from being buffered at all. It is deliberately NOT the
// authority: busboy cannot parse the Content-Type real browsers send for a
// MediaRecorder blob and reports `text/plain`, so a strict video/* allowlist
// would reject every Chrome take. Those cases are pinned below so nobody
// "tightens" the list and breaks recording.
//
// Layer 2 (lib/audio.js sniffContainer) is the authority: the container is read
// from the file's own magic bytes, and anything else is a 415 that never spawns
// ffmpeg. See tests/audio.guards.test.js for the arg-level proof.

require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const mockAudio = {
  extractAudio: jest.fn(),
  transcodeForEval: jest.fn()
}
jest.mock('../src/lib/audio', () => mockAudio)
jest.mock('../src/lib/scribe', () => ({ transcribe: jest.fn() }))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')
const rateLimit = require('../src/middleware/rateLimit')
const { userToken } = require('./helpers')

beforeEach(() => {
  dbMock.__reset()
  rateLimit.__resetAll()
  mockAudio.extractAudio.mockReset()
  mockAudio.transcodeForEval.mockReset()
})

function upload (route, contentType, filename = 'take.bin') {
  return request(createApp())
    .post(route)
    .set('Authorization', `Bearer ${userToken('user-1')}`)
    .field('project_id', 'proj-1')
    .attach('video', Buffer.from('not-a-video'), { filename, contentType })
}

describe('declared-mime gate (T-10010)', () => {
  test('text/html -> 415 and ffmpeg is never reached', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const res = await upload('/api/evaluate', 'text/html', 'playlist.html')
    expect(res.status).toBe(415)
    expect(res.body).toEqual({ error: 'unsupported_media_type' })
    expect(mockAudio.extractAudio).not.toHaveBeenCalled()
  })

  test('an m3u8 playlist is refused on /api/evaluate too', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    const res = await upload('/api/evaluate', 'application/vnd.apple.mpegurl', 'evil.m3u8')
    expect(res.status).toBe(415)
    expect(mockAudio.extractAudio).not.toHaveBeenCalled()
    expect(mockAudio.transcodeForEval).not.toHaveBeenCalled()
  })

  test.each([
    ['video/webm', 'take.webm'],
    ['video/mp4', 'take.mp4'],
    ['video/quicktime', 'take.mov'],
    ['video/x-matroska', 'take.mkv'],
    // busboy's fallback for the parameterized types browsers actually send.
    ['text/plain', 'take.webm'],
    ['application/octet-stream', 'take.webm']
  ])('%s reaches the decoder', async (contentType, filename) => {
    dbMock.__seedProject('proj-1', 'user-1')
    mockAudio.extractAudio.mockResolvedValue({ buffer: Buffer.from('a'), mime: 'audio/mp4', duration_s: 5 })
    const res = await upload('/api/evaluate', contentType, filename)
    expect(res.status).not.toBe(415)
    expect(mockAudio.extractAudio).toHaveBeenCalled()
  })

  // The reason `text/plain` is on the allowlist at all. Chrome's blob type is
  // `video/webm;codecs=vp9,opus`; the unquoted comma is not a legal parameter
  // value, busboy's parser gives up and reports text/plain. supertest's
  // form-data drops such a contentType, so the part is built by hand here.
  test('a real Chrome part header (video/webm;codecs=vp9,opus) is not rejected', async () => {
    dbMock.__seedProject('proj-1', 'user-1')
    mockAudio.extractAudio.mockResolvedValue({ buffer: Buffer.from('a'), mime: 'audio/mp4', duration_s: 5 })

    const b = '----pitchmitest'
    const body = [
      `--${b}`,
      'Content-Disposition: form-data; name="project_id"',
      '',
      'proj-1',
      `--${b}`,
      'Content-Disposition: form-data; name="video"; filename="take.webm"',
      'Content-Type: video/webm;codecs=vp9,opus',
      '',
      'fake-video-bytes',
      `--${b}--`,
      ''
    ].join('\r\n')

    const res = await request(createApp())
      .post('/api/evaluate')
      .set('Authorization', `Bearer ${userToken('user-1')}`)
      .set('Content-Type', `multipart/form-data; boundary=${b}`)
      .send(body)

    expect(res.status).not.toBe(415)
    expect(mockAudio.extractAudio).toHaveBeenCalled()
  })
})

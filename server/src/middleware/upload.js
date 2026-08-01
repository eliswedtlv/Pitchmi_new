'use strict'

// Shared multipart handler for video uploads. Files are kept in memory and
// discarded after the request — nothing touches Storage unless the user saves.

const multer = require('multer')
const config = require('../config')

// Declared types we are willing to buffer at all (T-10010). This is a cheap
// early gate that stops an obviously-wrong body before 60MB lands in memory —
// it is NOT the authority on what gets decoded. That is `sniffContainer` in
// lib/audio.js, which reads the file's own magic bytes; the header here is
// attacker-controlled and worthless as a security control.
//
// `text/plain` and `application/octet-stream` have to be on this list: busboy
// fails to parse the parameterized Content-Type every real browser sends for a
// MediaRecorder blob (`video/webm;codecs=vp9,opus` — the comma is not a legal
// unquoted parameter value) and falls back to `text/plain`. An allowlist of
// video/* alone would 415 every Chrome and Firefox take. Verified against
// multer 2.2 / busboy in tests/api.upload.mime.test.js.
const ALLOWED_MIME = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'text/plain',
  'application/octet-stream'
])

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter (req, file, cb) {
    const mime = String(file.mimetype || '').split(';')[0].trim().toLowerCase()
    if (ALLOWED_MIME.has(mime)) return cb(null, true)
    const err = new Error('unsupported_media_type')
    err.code = 'UNSUPPORTED_MEDIA_TYPE'
    cb(err)
  }
})

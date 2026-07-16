'use strict'

// Shared multipart handler for video uploads. Files are kept in memory and
// discarded after the request — nothing touches Storage unless the user saves.

const multer = require('multer')
const config = require('../config')

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 }
})

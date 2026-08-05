'use strict'

const express = require('express')
const { randomUUID } = require('crypto')
const auth = require('../middleware/auth')
const consent = require('../middleware/consent')
const upload = require('../middleware/upload')
const rateLimit = require('../middleware/rateLimit')
const db = require('../lib/db')
const { sniffContainer } = require('../lib/audio')

const router = express.Router()

// POST /api/save — multipart { video, project_id, scores }.
// The ONLY path that persists a video: upload to Storage, insert saved_takes.
router.post('/save', rateLimit.save, auth, consent, upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'missing_video' })
    const projectId = req.body.project_id
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })

    let scores = null
    if (req.body.scores) {
      try { scores = JSON.parse(req.body.scores) } catch { scores = null }
    }
    const durationS = req.body.duration_s ? Number(req.body.duration_s) : null

    const container = sniffContainer(req.file.buffer)
    if (!container) return res.status(415).json({ error: 'unsupported_media_type' })
    const contentType = container === 'mp4' ? 'video/mp4' : 'video/webm'

    const storageTakeId = randomUUID()
    const storagePath = `${req.userId}/${storageTakeId}.${container}`
    await db.uploadVideo(storagePath, req.file.buffer, contentType)

    const take = await db.insertSavedTake({
      projectId,
      userId: req.userId,
      storagePath,
      durationS,
      scores
    })

    await db.logEvent({
      user_id: req.userId,
      action: 'save',
      project_id: projectId,
      duration_s: durationS
    })

    res.status(201).json({ take_id: take.id })
  } catch (err) {
    next(err)
  }
})

module.exports = router

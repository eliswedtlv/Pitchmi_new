'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const upload = require('../middleware/upload')
const db = require('../lib/db')
const config = require('../config')
const { extractAudio, extForMime } = require('../lib/audio')
const { transcribe } = require('../lib/scribe')
const { scoreTake } = require('../lib/score')
const { evaluateVideo } = require('../lib/evaluate')
const { combineResult } = require('../lib/combine')

const router = express.Router()

// POST /api/evaluate — multipart { video, project_id }.
// Daily cap -> Scribe(new take) -> timing/accuracy scoring -> AI delivery eval
// -> combined §9 result. Video bytes are discarded after the response.
router.post('/evaluate', auth, upload.single('video'), async (req, res, next) => {
  const started = Date.now()
  try {
    if (!req.file) return res.status(400).json({ error: 'missing_video' })
    const projectId = req.body.project_id
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const usedToday = await db.countEvaluationsToday(req.userId)
    if (usedToday >= config.DAILY_EVAL_LIMIT) {
      return res.status(429).json({ error: 'daily_limit', limit: config.DAILY_EVAL_LIMIT })
    }

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })
    const path = project.path || { words: [] }

    const ext = extForMime(req.file.mimetype)
    const audio = await extractAudio(req.file.buffer, ext)
    const take = await transcribe(audio.buffer, audio.mime)

    const scored = scoreTake(take.words, path)
    const delivery = await evaluateVideo(req.file.buffer, req.file.mimetype || 'video/webm', {
      useCase: project.use_case,
      useCaseCustom: project.use_case_custom,
      language: take.language || project.language
    })

    const combined = combineResult({
      voice: delivery.voice,
      body: delivery.body,
      delivery: delivery.delivery,
      timing: scored.timing,
      accuracy: scored.accuracy
    })

    const evalsLeft = Math.max(0, config.DAILY_EVAL_LIMIT - (usedToday + 1))
    const costUsd = (take.duration_s / 60) * config.SCRIBE_USD_PER_MIN

    const result = {
      overall: combined.overall,
      dimensions: combined.dimensions,
      comments: delivery.comments,
      flags: scored.flags,
      language: take.language || project.language || null,
      evals_left_today: evalsLeft
    }

    await db.logEvent({
      user_id: req.userId,
      action: 'evaluate',
      project_id: projectId,
      duration_s: take.duration_s,
      language: result.language,
      scores: { ...combined.dimensions, overall: combined.overall },
      latency_ms: Date.now() - started,
      cost_usd: costUsd
    })

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router

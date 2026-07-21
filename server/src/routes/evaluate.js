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

// Total wall-clock budget for the whole evaluate pipeline (T-1165). Kept under
// the client's 5-min timeout so the server always answers first — with a 504
// instead of a Railway 499 client-abort — and never hangs indefinitely.
const EVAL_DEADLINE_MS = 240000

// POST /api/evaluate — multipart { video, project_id }.
// Daily cap -> Scribe(new take) -> timing/accuracy scoring -> AI delivery eval
// -> combined §9 result. Video bytes are discarded after the response.
router.post('/evaluate', auth, upload.single('video'), async (req, res) => {
  const started = Date.now()
  const deadline = started + EVAL_DEADLINE_MS
  const projectId = req.body.project_id
  // Stage timings accumulate so every outcome (success, error, timeout) can log
  // how far the pipeline got — set inside the try, read in the catch.
  let scribeMs = 0
  let evalMs = 0
  try {
    if (!req.file) return res.status(400).json({ error: 'missing_video' })
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const usedToday = await db.countEvaluationsToday(req.userId)
    if (usedToday >= config.DAILY_EVAL_LIMIT) {
      return res.status(429).json({ error: 'daily_limit', limit: config.DAILY_EVAL_LIMIT })
    }

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })
    const path = project.path || { words: [] }

    const ext = extForMime(req.file.mimetype)
    const scribeStart = Date.now()
    const audio = await extractAudio(req.file.buffer, ext)
    const take = await transcribe(audio.buffer, audio.mime)
    scribeMs = Date.now() - scribeStart

    const scored = scoreTake(take.words, path)
    const evalStart = Date.now()
    const delivery = await evaluateVideo(req.file.buffer, req.file.mimetype || 'video/webm', {
      useCase: project.use_case,
      useCaseCustom: project.use_case_custom,
      language: take.language || project.language
    }, { deadline })
    evalMs = Date.now() - evalStart

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
      // Numeric metadata only (privacy rule). `timings` carries per-stage
      // durations so ops can see why an evaluate took 60–120s.
      scores: {
        ...combined.dimensions,
        overall: combined.overall,
        timings: { scribe_ms: scribeMs, eval_ms: evalMs, attempts: delivery.attempts || 1, upstream: delivery.upstream || null }
      },
      latency_ms: Date.now() - started,
      cost_usd: costUsd
    })

    res.status(200).json(result)
  } catch (err) {
    // Guarantee an event row on EVERY failed outcome (error or timeout) with the
    // stage timings reached so far — the hang bug (T-1165) left no row at all.
    const isTimeout = err && err.code === 'eval_upstream_timeout'
    await db.logEvent({
      user_id: req.userId,
      action: 'error',
      project_id: projectId,
      error: isTimeout ? 'eval_upstream_timeout' : String(err && err.message ? err.message : err).slice(0, 500),
      scores: { timings: { scribe_ms: scribeMs, eval_ms: evalMs } },
      latency_ms: Date.now() - started
    }).catch(() => {})

    if (isTimeout) return res.status(504).json({ error: 'eval_upstream_timeout' })
    // Match the global error handler's 500 shape, but respond here so the row
    // above (with timings) is the single logged event for this request.
    return res.status(500).json({ error: 'server_error', message: err && err.message })
  }
})

module.exports = router

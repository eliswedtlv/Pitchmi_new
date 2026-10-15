'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const consent = require('../middleware/consent')
const upload = require('../middleware/upload')
const rateLimit = require('../middleware/rateLimit')
const db = require('../lib/db')
const config = require('../config')
const { runMedia } = require('../lib/jobLimiter')
const { extractAudio } = require('../lib/audio')
const { transcribe } = require('../lib/scribe')
const { buildPathFromScript } = require('../lib/scriptPath')

const router = express.Router()

router.post('/rhythm', rateLimit.rhythm, auth, consent, upload.single('video'), async (req, res) => {
  const started = Date.now()
  const projectId = req.body.project_id
  // Stage timings are available for successful and failed outcomes.
  let scribeMs = 0
  let mediaS = null
  try {
    if (!req.file) return res.status(400).json({ error: 'missing_video' })
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const usedToday = await db.countRhythmsToday(req.userId)
    if (usedToday >= config.DAILY_EVAL_LIMIT) {
      return res.status(429).json({ error: 'daily_limit', limit: config.DAILY_EVAL_LIMIT })
    }

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })

    const audio = await runMedia(() => extractAudio(req.file.buffer))

    // Enforce the 5-minute ceiling before making a billable Scribe call.
    mediaS = typeof audio.duration_s === 'number' ? audio.duration_s : null
    if (mediaS !== null && mediaS > config.MAX_TAKE_S + config.TAKE_TOLERANCE_S) {
      await db.logEvent({
        user_id: req.userId,
        action: 'error',
        project_id: projectId,
        error: 'take_too_long',
        duration_s: mediaS,
        latency_ms: Date.now() - started
      }).catch(() => {})
      return res.status(413).json({
        error: 'take_too_long',
        limit_s: config.MAX_TAKE_S,
        message: {
          en: 'Takes must be 5 minutes or shorter.',
          he: 'ההקלטה חייבת להיות עד 5 דקות.'
        }
      })
    }

    const scribeStart = Date.now()
    const take = await transcribe(audio.buffer, audio.mime)
    scribeMs = Date.now() - scribeStart

    let retimed = null
    let coverage = null
    if (project.script) {
      const aligned = buildPathFromScript(project.script, take.words)
      coverage = aligned.coverage
      const minCoverage = project.path ? config.MIN_ALIGN_COVERAGE : config.MIN_FIRST_RHYTHM_COVERAGE
      if (aligned.path.words.length && coverage >= minCoverage) {
        retimed = aligned.path
        await db.updateProject(projectId, req.userId, { path: retimed })
      }
    }

    const sttCostUsd = ((mediaS ?? take.duration_s) / 60) * config.SCRIBE_USD_PER_MIN
    const result = {
      path: retimed,
      coverage,
      language: take.language || project.language || null,
      rhythms_left_today: Math.max(0, config.DAILY_EVAL_LIMIT - (usedToday + 1))
    }

    // Existing JSON metadata column, with no script, transcript or media.
    await db.logEvent({
      user_id: req.userId,
      action: 'rhythm',
      project_id: projectId,
      duration_s: mediaS ?? take.duration_s,
      language: result.language,
      scores: {
        coverage,
        retimed: Number(!!retimed),
        timings: { scribe_ms: scribeMs },
        cost: { stt_usd: sttCostUsd, media_duration_s: mediaS }
      },
      latency_ms: Date.now() - started,
      cost_usd: sttCostUsd
    })

    res.status(200).json(result)
  } catch (err) {
    const isBusy = err && err.code === 'busy'
    const isBadMedia = err && err.code === 'UNSUPPORTED_MEDIA_TYPE'
    const isNoAudio = err && err.code === 'NO_AUDIO'
    await db.logEvent({
      user_id: req.userId,
      action: 'error',
      project_id: projectId,
      error: isBusy ? 'busy' : isBadMedia ? 'unsupported_media_type' : isNoAudio ? 'no_audio' : 'server_error',
      scores: { timings: { scribe_ms: scribeMs } },
      latency_ms: Date.now() - started
    }).catch(() => {})

    // Media queue full: retryable, not a server fault (T-10010).
    if (isBusy) return res.status(503).json({ error: 'busy' })
    // Unrecognized containers use the existing unsupported-media response.
    if (isBadMedia) return res.status(415).json({ error: 'unsupported_media_type' })
    // A take with no usable audio (video-only recording) has no rhythm to read.
    if (isNoAudio) {
      return res.status(422).json({
        error: 'no_audio',
        message: {
          en: 'This take has no sound, so we couldn’t read its rhythm.',
          he: 'בטייק הזה אין קול, אז לא הצלחנו לקרוא את הקצב שלו.'
        }
      })
    }
    // Match the global error handler's 500 shape, but respond here so the row
    // above (with timings) is the single logged event for this request.
    return res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router

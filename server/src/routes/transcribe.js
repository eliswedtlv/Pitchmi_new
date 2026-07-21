'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const upload = require('../middleware/upload')
const db = require('../lib/db')
const config = require('../config')
const { extractAudio, extForMime } = require('../lib/audio')
const { transcribe } = require('../lib/scribe')
const { stripFillers } = require('../lib/fillers')
const { cleanVerbatim } = require('../lib/cleanVerbatim')

const router = express.Router()

// POST /api/transcribe — multipart { video, project_id }.
// Extract audio -> Scribe -> store script+language on the project.
// The video bytes are discarded after the response.
router.post('/transcribe', auth, upload.single('video'), async (req, res, next) => {
  const started = Date.now()
  try {
    const projectId = req.body.project_id
    if (!req.file) return res.status(400).json({ error: 'missing_video' })
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })

    const ext = extForMime(req.file.mimetype)
    const audio = await extractAudio(req.file.buffer, ext)
    const result = await transcribe(audio.buffer, audio.mime)

    // Fillers must never reach the editable transcript (T-1162 §C). Strip
    // disfluencies from the script text but keep the FULL word list as
    // original_words — their timestamps remain valid pause evidence for /api/path.
    const deterministic = stripFillers(result.words)

    // Clean-verbatim draft (T-1163 §B): one cheap text-only LLM pass turns the
    // raw STT into a readable draft (sentences, punctuation, no stutters/repeats)
    // in the same language. Degrades silently to the deterministic text on any
    // failure — transcribe must never break because cleanup did.
    const cleanStarted = Date.now()
    const sentences = await cleanVerbatim(deterministic, result.language)
    const cleanMs = Date.now() - cleanStarted
    const script = sentences ? sentences.join('\n') : deterministic

    await db.updateProject(projectId, req.userId, {
      script,
      language: result.language,
      // Persist original word timings so /api/path can rebuild the path later
      // (schema addition beyond §4 — see STATUS deviations).
      original_words: result.words
    })

    const costUsd = (result.duration_s / 60) * config.SCRIBE_USD_PER_MIN
    await db.logEvent({
      user_id: req.userId,
      action: 'transcribe',
      project_id: projectId,
      duration_s: result.duration_s,
      language: result.language,
      latency_ms: Date.now() - started,
      clean_ms: cleanMs,
      cost_usd: costUsd
    })

    res.status(200).json({
      text: script,
      language: result.language,
      words: result.words,
      duration_s: result.duration_s
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

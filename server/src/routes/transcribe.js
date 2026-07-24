'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const upload = require('../middleware/upload')
const db = require('../lib/db')
const config = require('../config')
const { extractAudio, extForMime } = require('../lib/audio')
const { transcribe } = require('../lib/scribe')
const { stripFillers, isFiller, taggedDisfluency } = require('../lib/fillers')
const { buildSubtitles } = require('../lib/subtitles')

const router = express.Router()

// POST /api/transcribe — multipart { video, project_id }.
// Extract audio -> Scribe -> strip fillers -> build the karaoke subtitle
// structure directly from the surviving words' REAL timestamps (T-1169: no
// editor, no re-pacing). Store script + language + subtitle path on the project.
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

    // Strip fillers (אה/אמ/um/uh…) so the subtitles read clean. A dropped filler
    // just leaves a natural gap between its neighbours — the surviving words keep
    // their ORIGINAL Scribe start/end (T-1169). No LLM rewrite: an edited wording
    // would desync words from their real timings.
    const survivors = (result.words || []).filter(w => !taggedDisfluency(w) && !isFiller(w.w))
    const path = buildSubtitles(survivors)
    const script = stripFillers(result.words)

    // Nothing usable to prompt from (silent / too-short take): surface the
    // standard "we couldn't hear you" error instead of navigating to an empty
    // karaoke screen.
    if (!path.words.length) {
      await db.logEvent({
        user_id: req.userId,
        action: 'transcribe',
        project_id: projectId,
        duration_s: result.duration_s,
        language: result.language,
        latency_ms: Date.now() - started,
        error: 'no_speech'
      })
      return res.status(422).json({ error: 'no_speech' })
    }

    await db.updateProject(projectId, req.userId, {
      script,
      language: result.language,
      path
    })

    const costUsd = (result.duration_s / 60) * config.SCRIBE_USD_PER_MIN
    await db.logEvent({
      user_id: req.userId,
      action: 'transcribe',
      project_id: projectId,
      duration_s: result.duration_s,
      language: result.language,
      latency_ms: Date.now() - started,
      cost_usd: costUsd
    })

    res.status(200).json({
      script,
      language: result.language,
      path,
      duration_s: result.duration_s
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

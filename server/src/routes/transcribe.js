'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const upload = require('../middleware/upload')
const rateLimit = require('../middleware/rateLimit')
const db = require('../lib/db')
const config = require('../config')
const { runMedia } = require('../lib/jobLimiter')
const { extractAudio } = require('../lib/audio')
const { transcribe } = require('../lib/scribe')
const { stripFillers, isFiller, taggedDisfluency } = require('../lib/fillers')
const { buildSubtitles } = require('../lib/subtitles')

const router = express.Router()

// POST /api/transcribe — multipart { video, project_id }.
// Extract audio -> Scribe -> strip fillers -> build the karaoke subtitle
// structure directly from the surviving words' REAL timestamps (T-1169: no
// editor, no re-pacing). Store script + language + subtitle path on the project.
// The video bytes are discarded after the response.
router.post('/transcribe', rateLimit.transcribe, auth, upload.single('video'), async (req, res, next) => {
  const started = Date.now()
  try {
    const projectId = req.body.project_id
    if (!req.file) return res.status(400).json({ error: 'missing_video' })
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })

    // Behind the media semaphore (T-10010): the decode is the memory- and
    // CPU-heavy part of this handler. A full queue rejects with `busy` (503),
    // and a buffer that is not a real webm/mp4 container rejects with 415.
    const audio = await runMedia(() => extractAudio(req.file.buffer))

    // Hard 30s cap, enforced server-side (T-1172). The browser cap is only a
    // browser cap; curl and the drag-and-drop path bypass it entirely. The
    // check pays the already-necessary decode above to avoid a billable Scribe
    // call. Reject only past the tolerance, and fail open when the probe found
    // no `time=` line — a parse regression must degrade to the old behaviour.
    const mediaS = typeof audio.duration_s === 'number' ? audio.duration_s : null
    const capS = config.MAX_TAKE_S + config.TAKE_TOLERANCE_S
    if (mediaS !== null && mediaS > capS) {
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
          en: 'Takes must be 30 seconds or shorter.',
          he: 'ההקלטה חייבת להיות עד 30 שניות.'
        }
      })
    }

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

    // Vendors bill submitted audio duration, so the probed media length is the
    // correct basis; `result.duration_s` (the end of the LAST RECOGNISED WORD)
    // under-bills a take with trailing silence and is only the fallback.
    // `cost_usd` is the USD incurred by THIS request; rows are summed across
    // requests, never deduplicated — /api/transcribe and /api/evaluate bill two
    // different videos through two separate Scribe calls.
    const billableS = mediaS ?? result.duration_s
    const costUsd = (billableS / 60) * config.SCRIBE_USD_PER_MIN
    await db.logEvent({
      user_id: req.userId,
      action: 'transcribe',
      project_id: projectId,
      duration_s: result.duration_s,
      language: result.language,
      latency_ms: Date.now() - started,
      // Numeric metadata only (privacy rule): which number produced the figure.
      scores: {
        cost: {
          stt_usd: costUsd,
          eval_usd: null,
          media_duration_s: mediaS,
          basis: mediaS !== null ? 'media' : 'words'
        }
      },
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

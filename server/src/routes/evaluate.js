'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const upload = require('../middleware/upload')
const db = require('../lib/db')
const config = require('../config')
const { extractAudio, transcodeForEval, extForMime } = require('../lib/audio')
const { transcribe } = require('../lib/scribe')
const { scoreTake } = require('../lib/score')
const { evaluateVideo } = require('../lib/evaluate')
const { combineResult } = require('../lib/combine')

const router = express.Router()

// Total wall-clock budget for the whole evaluate pipeline (T-1165). Kept under
// the client's 5-min timeout so the server always answers first — with a 504
// instead of a Railway 499 client-abort — and never hangs indefinitely.
const EVAL_DEADLINE_MS = 240000

// Hard ceiling on the eval proxy payload (T-1166). At 2fps/360p/crf32 a 60s take
// lands ~1–3MB, so this guard should never fire; it only stops a pathological
// proxy from being pushed at the base64-limited upstream.
const EVAL_MAX_BYTES = 18 * 1024 * 1024

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
  let transcodeMs = 0
  let videoBytesIn = 0
  let videoBytesEval = 0
  let mediaS = null
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

    // Hard 30s cap, enforced server-side (T-1172). Sits AFTER the daily-limit
    // check so quota semantics don't change, and BEFORE Scribe so a rejected
    // take costs nothing but the decode we already ran. Fails open when the
    // probe found no `time=` line.
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
          en: 'Takes must be 30 seconds or shorter.',
          he: 'ההקלטה חייבת להיות עד 30 שניות.'
        }
      })
    }

    const take = await transcribe(audio.buffer, audio.mime)
    scribeMs = Date.now() - scribeStart

    const scored = scoreTake(take.words, path)

    // Shrink the take to a minimal eval proxy before the upstream call (T-1166).
    // Real takes exceed the base64 request ceiling and stall every attempt; the
    // proxy is what the model sees. The original take stays untouched for Scribe
    // (above) and /api/save.
    const transcodeStart = Date.now()
    const proxy = await transcodeForEval(req.file.buffer, ext)
    transcodeMs = Date.now() - transcodeStart
    videoBytesIn = req.file.size || req.file.buffer.length
    videoBytesEval = proxy.buffer.length
    if (videoBytesEval > EVAL_MAX_BYTES) {
      await db.logEvent({
        user_id: req.userId,
        action: 'error',
        project_id: projectId,
        error: 'take_too_large',
        scores: { timings: { scribe_ms: scribeMs, transcode_ms: transcodeMs, video_bytes_in: videoBytesIn, video_bytes_eval: videoBytesEval } },
        latency_ms: Date.now() - started
      }).catch(() => {})
      return res.status(413).json({
        error: 'take_too_large',
        message: {
          en: 'This take is too large to evaluate. Please record a shorter clip and try again.',
          he: 'ההקלטה גדולה מדי להערכה. נסו להקליט קטע קצר יותר ולנסות שוב.'
        }
      })
    }

    const evalStart = Date.now()
    const delivery = await evaluateVideo(proxy.buffer, 'video/mp4', {
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

    // Real cost of THIS request (T-1172): STT billed on the submitted audio
    // duration (falling back to the last-word-end only when the probe failed),
    // plus what OpenRouter actually charged for the model call — roughly 45% of
    // a pass, and invisible until now. `cost_usd` is the row total; rows are
    // summed across requests, never deduplicated.
    const billableS = mediaS ?? take.duration_s
    const sttCostUsd = (billableS / 60) * config.SCRIBE_USD_PER_MIN
    const evalCostUsd = delivery.usage?.cost ?? null
    const costUsd = sttCostUsd + (evalCostUsd ?? 0)

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
        timings: { scribe_ms: scribeMs, transcode_ms: transcodeMs, eval_ms: evalMs, video_bytes_in: videoBytesIn, video_bytes_eval: videoBytesEval, attempts: delivery.attempts || 1, upstream: delivery.upstream || null },
        cost: {
          stt_usd: sttCostUsd,
          eval_usd: evalCostUsd, // null on gemini-direct or a usage-less 200
          media_duration_s: mediaS, // null if the probe failed
          basis: mediaS !== null ? 'media' : 'words',
          eval_prompt_tokens: delivery.usage?.prompt_tokens ?? null,
          eval_completion_tokens: delivery.usage?.completion_tokens ?? null
        }
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
      scores: { timings: { scribe_ms: scribeMs, transcode_ms: transcodeMs, eval_ms: evalMs, video_bytes_in: videoBytesIn, video_bytes_eval: videoBytesEval } },
      latency_ms: Date.now() - started
    }).catch(() => {})

    if (isTimeout) return res.status(504).json({ error: 'eval_upstream_timeout' })
    // Match the global error handler's 500 shape, but respond here so the row
    // above (with timings) is the single logged event for this request.
    return res.status(500).json({ error: 'server_error', message: err && err.message })
  }
})

module.exports = router

'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const db = require('../lib/db')
const config = require('../config')
const { buildSeedPath } = require('../lib/scriptPath')

const router = express.Router()

// POST /api/script — { project_id, text }. The text-first entry point
// (T-10018): the user types their script and goes straight to the prompter.
// No media, so no rate limiter and no media semaphore.
//
// The returned path is a SEED — a throwaway estimate at a fixed rate, good
// enough to rehearse against once. /api/evaluate replaces it with the user's
// real, measured timings after every take.
router.post('/script', auth, async (req, res, next) => {
  try {
    const { project_id: projectId, text } = req.body || {}
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'missing_text' })
    }
    // Checked on the RAW length, before tokenizing: this is also what bounds
    // the O(n*m) alignment DP that /api/evaluate will run over this script.
    if (text.length > config.MAX_SCRIPT_CHARS) {
      return res.status(400).json({
        error: 'script_too_long',
        limit_chars: config.MAX_SCRIPT_CHARS,
        message: {
          en: `Scripts must be ${config.MAX_SCRIPT_CHARS} characters or shorter.`,
          he: `הטקסט חייב להיות עד ${config.MAX_SCRIPT_CHARS} תווים.`
        }
      })
    }

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })

    const path = buildSeedPath(text)
    if (path.words.length < 3) {
      return res.status(400).json({
        error: 'script_too_short',
        message: {
          en: 'Write at least a few words before you record.',
          he: 'כתבו לפחות כמה מילים לפני ההקלטה.'
        }
      })
    }

    // Storing the fresh seed alongside the text is what invalidates the OLD
    // timings: editing the script must never leave the user rehearsing against
    // anchors measured for different words. `projects.script` and
    // `projects.path` are existing columns — no migration.
    await db.updateProject(projectId, req.userId, { script: text, path })

    res.status(200).json({
      path,
      word_count: path.words.length,
      est_duration_s: path.total_s
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

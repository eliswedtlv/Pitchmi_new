'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const consent = require('../middleware/consent')
const db = require('../lib/db')
const config = require('../config')
const { scriptTokens } = require('../lib/subtitles')

const router = express.Router()

// Store the script and clear timings measured for any previous text.
router.post('/script', auth, consent, async (req, res, next) => {
  try {
    const { project_id: projectId, text } = req.body || {}
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'missing_text' })
    }
    // Checked on the RAW length, before tokenizing: this is also what bounds
    // the O(n*m) alignment DP that /api/rhythm will run over this script.
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

    const wordCount = scriptTokens(text).length
    if (wordCount < 3) {
      return res.status(400).json({
        error: 'script_too_short',
        message: {
          en: 'Write at least a few words before you record.',
          he: 'כתבו לפחות כמה מילים לפני ההקלטה.'
        }
      })
    }

    await db.updateProject(projectId, req.userId, { script: text, path: null })

    res.status(200).json({ word_count: wordCount })
  } catch (err) {
    next(err)
  }
})

module.exports = router

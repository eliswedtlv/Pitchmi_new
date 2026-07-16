'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const db = require('../lib/db')

const router = express.Router()

const USE_CASES = ['pitch', 'intro', 'sales', 'social', 'custom']

// POST /api/projects — create a project.
router.post('/projects', auth, async (req, res, next) => {
  try {
    const { title, use_case: useCase, use_case_custom: useCaseCustom } = req.body || {}
    if (useCase && !USE_CASES.includes(useCase)) {
      return res.status(400).json({ error: 'bad_use_case' })
    }
    const project = await db.createProject({
      userId: req.userId,
      title,
      useCase: useCase || 'pitch',
      useCaseCustom
    })
    res.status(201).json(project)
  } catch (err) {
    next(err)
  }
})

module.exports = router

'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const db = require('../lib/db')
const { buildPath } = require('../lib/path')

const router = express.Router()

// POST /api/path — { project_id, edited_script, speed }
// Recompute the karaoke path from the original take words + edited script.
router.post('/path', auth, express.json(), async (req, res, next) => {
  try {
    const { project_id: projectId, edited_script: editedScript, speed } = req.body || {}
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' })

    const project = await db.getProject(projectId, req.userId)
    if (!project) return res.status(404).json({ error: 'project_not_found' })

    const originalWords = project.original_words || []
    const spd = clamp(Number(speed) || project.speed || 1, 0.75, 1.25)
    const result = buildPath(originalWords, editedScript || '', spd)

    await db.updateProject(projectId, req.userId, {
      script: editedScript,
      path: result.path,
      speed: spd
    })

    await db.logEvent({
      user_id: req.userId,
      action: 'path',
      project_id: projectId,
      duration_s: result.est_duration_s
    })

    res.status(200).json({
      path: result.path,
      fits: result.fits,
      est_duration_s: result.est_duration_s,
      warning: result.warning
    })
  } catch (err) {
    next(err)
  }
})

function clamp (n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

module.exports = router

'use strict'

const express = require('express')
const auth = require('../middleware/auth')
const db = require('../lib/db')

const router = express.Router()

// GET /api/takes/:id/url — signed playback URL (60 min) for the owner's take.
router.get('/takes/:id/url', auth, async (req, res, next) => {
  try {
    const take = await db.getSavedTake(req.params.id, req.userId)
    if (!take) return res.status(404).json({ error: 'take_not_found' })
    const url = await db.signVideoUrl(take.storage_path, 3600)
    res.status(200).json({ url })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/takes/:id — removes both the private object and its DB row.
router.delete('/takes/:id', auth, async (req, res, next) => {
  try {
    const deleted = await db.deleteSavedTake(req.params.id, req.userId)
    if (!deleted) return res.status(404).json({ error: 'take_not_found' })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = router

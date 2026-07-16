'use strict'

// Ad config stub (§5). Public — the wait screen fetches this before auth
// context matters. Designed to be swapped for a real ad network later without
// touching the FE flow (see <AdSlot/>).

const express = require('express')
const router = express.Router()

router.get('/ad', (req, res) => {
  res.status(200).json({ type: 'demo', url: '/ads/demo.mp4', skippable_after_s: 5 })
})

module.exports = router

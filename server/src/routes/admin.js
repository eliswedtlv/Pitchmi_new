'use strict'

const express = require('express')
const config = require('../config')
const requireAdmin = require('../middleware/admin')
const surge = require('../middleware/surge')
const db = require('../lib/db')

const router = express.Router()

const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000 // 12h

// POST /api/admin/login — password -> signed httpOnly cookie.
router.post('/admin/login', express.json(), (req, res) => {
  const { password } = req.body || {}
  if (!config.ADMIN_PASSWORD || password !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  res.cookie('admin', '1', {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE
  })
  res.status(200).json({ ok: true })
})

// GET /api/admin/logs — paged events.
router.get('/admin/logs', requireAdmin, async (req, res, next) => {
  try {
    const { from, to, action, user } = req.query
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500)
    const offset = parseInt(req.query.offset, 10) || 0
    const rows = await db.queryEvents({ from, to, action, user, limit, offset })
    res.status(200).json({ events: rows, limit, offset })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/aggregates?days=30 — per-day rollup.
router.get('/admin/aggregates', requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 30, 365)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const rows = await db.eventsForAggregates(since)
    res.status(200).json({ days, aggregates: rollup(rows) })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/service — re-arm / disarm the kill switch.
router.post('/admin/service', requireAdmin, express.json(), async (req, res, next) => {
  try {
    const enabled = req.body && req.body.enabled === true
    await db.setServiceEnabled(enabled)
    if (enabled) surge.reset() // clear the surge window when re-arming
    res.status(200).json({ enabled })
  } catch (err) {
    next(err)
  }
})

function rollup (rows) {
  const byDay = new Map()
  for (const r of rows) {
    const day = String(r.ts).slice(0, 10)
    if (!byDay.has(day)) {
      byDay.set(day, { day, evals: 0, users: new Set(), scoreSum: 0, cost_usd: 0, stt_usd: 0, eval_usd: 0, errors: 0, latencySum: 0, latencyCount: 0 })
    }
    const d = byDay.get(day)
    if (r.user_id) d.users.add(r.user_id)
    if (r.action === 'evaluate') {
      d.evals++
      if (r.scores && typeof r.scores.overall === 'number') d.scoreSum += r.scores.overall
    }
    if (r.action === 'error') d.errors++
    if (typeof r.cost_usd === 'number') d.cost_usd += r.cost_usd
    // STT/eval split (T-1172). Rows written before that change carry no
    // `scores.cost`; they contribute 0 to the split but still land in
    // total_cost_usd, so historical days render without NaN.
    const c = r.scores && r.scores.cost
    if (c) {
      if (typeof c.stt_usd === 'number') d.stt_usd += c.stt_usd
      if (typeof c.eval_usd === 'number') d.eval_usd += c.eval_usd
    }
    if (typeof r.latency_ms === 'number') {
      d.latencySum += r.latency_ms
      d.latencyCount++
    }
  }
  return [...byDay.values()]
    .map(d => ({
      day: d.day,
      evals: d.evals,
      unique_users: d.users.size,
      avg_score: d.evals ? Math.round(d.scoreSum / d.evals) : 0,
      total_cost_usd: Math.round(d.cost_usd * 10000) / 10000,
      total_stt_usd: Math.round(d.stt_usd * 10000) / 10000,
      total_eval_usd: Math.round(d.eval_usd * 10000) / 10000,
      errors: d.errors,
      avg_latency_ms: d.latencyCount ? Math.round(d.latencySum / d.latencyCount) : 0
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
}

module.exports = router

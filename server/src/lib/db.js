'use strict'

// Data-access layer over Supabase (service-role). Everything that touches the
// database or Storage goes through here, which keeps the service-role key on
// the server and gives tests a single module to mock.

const { createClient } = require('@supabase/supabase-js')
const config = require('../config')

let client = null
function sb () {
  if (!client) {
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }
  return client
}

// --- app_settings (kill switch) ---

async function getServiceEnabled () {
  const { data, error } = await sb()
    .from('app_settings').select('value').eq('key', 'service_enabled').maybeSingle()
  if (error) throw error
  if (!data) return true
  // value is stored as jsonb boolean
  return data.value === true || data.value === 'true'
}

async function setServiceEnabled (enabled) {
  const { error } = await sb()
    .from('app_settings').upsert({ key: 'service_enabled', value: enabled })
  if (error) throw error
}

// --- events (append-only ops log; metadata only) ---

async function logEvent (evt) {
  try {
    await sb().from('events').insert(evt)
  } catch (err) {
    // Logging must never break a request.
    console.error('logEvent failed:', err.message)
  }
}

async function countEvaluationsToday (userId) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const { count, error } = await sb()
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'evaluate')
    .gte('ts', start.toISOString())
  if (error) throw error
  return count || 0
}

async function queryEvents ({ from, to, action, user, limit = 100, offset = 0 }) {
  let q = sb().from('events').select('*').order('ts', { ascending: false })
  if (from) q = q.gte('ts', from)
  if (to) q = q.lte('ts', to)
  if (action) q = q.eq('action', action)
  if (user) q = q.eq('user_id', user)
  q = q.range(offset, offset + limit - 1)
  const { data, error } = await q
  if (error) throw error
  return data
}

async function eventsForAggregates (sinceIso) {
  const { data, error } = await sb()
    .from('events').select('ts,user_id,action,scores,cost_usd,latency_ms').gte('ts', sinceIso)
  if (error) throw error
  return data
}

// --- projects ---

async function createProject ({ userId, title, useCase, useCaseCustom }) {
  const row = { user_id: userId, use_case: useCase || 'pitch' }
  if (title) row.title = title
  if (useCaseCustom) row.use_case_custom = useCaseCustom
  const { data, error } = await sb().from('projects').insert(row).select().single()
  if (error) throw error
  return data
}

async function getProject (id, userId) {
  const { data, error } = await sb()
    .from('projects').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

async function updateProject (id, userId, fields) {
  const { data, error } = await sb()
    .from('projects').update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId).select().single()
  if (error) throw error
  return data
}

// --- saved_takes + storage ---

async function uploadVideo (storagePath, buffer, contentType) {
  const { error } = await sb().storage
    .from(config.STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false })
  if (error) throw error
}

async function insertSavedTake ({ projectId, userId, storagePath, durationS, scores }) {
  const { data, error } = await sb().from('saved_takes').insert({
    project_id: projectId,
    user_id: userId,
    storage_path: storagePath,
    duration_s: durationS,
    scores
  }).select().single()
  if (error) throw error
  return data
}

async function getSavedTake (id, userId) {
  const { data, error } = await sb()
    .from('saved_takes').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

async function signVideoUrl (storagePath, expiresSec = 3600) {
  const { data, error } = await sb().storage
    .from(config.STORAGE_BUCKET).createSignedUrl(storagePath, expiresSec)
  if (error) throw error
  return data.signedUrl
}

module.exports = {
  getServiceEnabled,
  setServiceEnabled,
  logEvent,
  countEvaluationsToday,
  queryEvents,
  eventsForAggregates,
  createProject,
  getProject,
  updateProject,
  uploadVideo,
  insertSavedTake,
  getSavedTake,
  signVideoUrl
}

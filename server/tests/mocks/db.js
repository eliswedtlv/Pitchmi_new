'use strict'

// In-memory stand-in for src/lib/db, wired in via jest.mock. Exposes __state,
// __reset and __seedProject so tests can arrange and assert.

const state = {
  serviceEnabled: true,
  events: [],
  projects: new Map(),
  savedTakes: new Map(),
  uploads: [],
  evalCountToday: 0,
  consentGranted: true,
  deletedUsers: []
}

let takeSeq = 0

module.exports = {
  __state: state,
  __reset () {
    state.serviceEnabled = true
    state.events = []
    state.projects = new Map()
    state.savedTakes = new Map()
    state.uploads = []
    state.evalCountToday = 0
    state.consentGranted = true
    state.deletedUsers = []
    takeSeq = 0
  },
  __seedProject (id, userId, overrides = {}) {
    const project = { id, user_id: userId, use_case: 'pitch', speed: 1, ...overrides }
    state.projects.set(id, project)
    return project
  },

  async getServiceEnabled () { return state.serviceEnabled },
  async setServiceEnabled (v) { state.serviceEnabled = v },
  async logEvent (e) { state.events.push(e) },
  async recordConsent (userId, action) { state.events.push({ user_id: userId, action }) },
  async countEvaluationsToday () { return state.evalCountToday },
  async hasEvent (userId, action) {
    return state.consentGranted || state.events.some(e => e.user_id === userId && e.action === action)
  },
  async queryEvents () { return state.events },
  async eventsForAggregates () { return state.events },

  async createProject ({ userId, title, useCase, useCaseCustom }) {
    const id = `proj-${state.projects.size + 1}`
    const project = {
      id,
      user_id: userId,
      title: title || 'Untitled',
      use_case: useCase || 'pitch',
      use_case_custom: useCaseCustom || null,
      speed: 1
    }
    state.projects.set(id, project)
    return project
  },
  async getProject (id, userId) {
    const p = state.projects.get(id)
    return p && p.user_id === userId ? p : null
  },
  async updateProject (id, userId, fields) {
    const p = state.projects.get(id)
    if (!p || p.user_id !== userId) return null
    Object.assign(p, fields)
    return p
  },

  async uploadVideo (storagePath, buffer, contentType) {
    state.uploads.push({ storagePath, size: buffer.length, contentType })
  },
  async insertSavedTake ({ projectId, userId, storagePath, durationS, scores }) {
    const id = `take-${++takeSeq}`
    const row = { id, project_id: projectId, user_id: userId, storage_path: storagePath, duration_s: durationS, scores }
    state.savedTakes.set(id, row)
    return row
  },
  async getSavedTake (id, userId) {
    const t = state.savedTakes.get(id)
    return t && t.user_id === userId ? t : null
  },
  async signVideoUrl (storagePath) {
    return `https://signed.example/${storagePath}?token=abc`
  },
  async deleteSavedTake (id, userId) {
    const take = state.savedTakes.get(id)
    if (!take || take.user_id !== userId) return false
    state.savedTakes.delete(id)
    return true
  },
  async deleteUserData (userId) {
    for (const [id, project] of state.projects) {
      if (project.user_id === userId) state.projects.delete(id)
    }
    for (const [id, take] of state.savedTakes) {
      if (take.user_id === userId) state.savedTakes.delete(id)
    }
    state.events = state.events.filter(event => event.user_id !== userId)
    state.deletedUsers.push(userId)
  }
}

/**
 * API client — all fetch calls to the Express server go through here.
 * Uses Bearer JWT from anonymous Supabase session.
 */

import { ensureAuth } from "./supabase"

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

async function authHeaders(): Promise<Record<string, string>> {
  const token = await ensureAuth()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw Object.assign(new Error(body.message ?? body.error ?? "Request failed"), {
      status: res.status,
      body,
    })
  }
  return res.json() as Promise<T>
}

// ── Health ─────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/api/health`)
  return handleResponse(res)
}

// ── Ad ─────────────────────────────────────────────────────────────────────

export interface AdConfig {
  type: string
  url: string
  skippable_after_s: number
}

export async function getAd(): Promise<AdConfig> {
  const res = await fetch(`${BASE}/api/ad`)
  return handleResponse(res)
}

// ── Projects ───────────────────────────────────────────────────────────────

export interface Project {
  id: string
  user_id: string
  title: string
  use_case: string
  use_case_custom?: string
  language?: string
  script?: string
  path?: KaraokePath
  speed: number
  created_at: string
  updated_at: string
}

export async function createProject(data: {
  title?: string
  use_case: string
  use_case_custom?: string
}): Promise<Project> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

// ── Transcribe ─────────────────────────────────────────────────────────────

export interface TranscribeResult {
  text: string
  language: string
  words: Array<{ w: string; start: number; end: number }>
  duration_s: number
}

export async function transcribeVideo(
  video: File | Blob,
  projectId: string,
): Promise<TranscribeResult> {
  const headers = await authHeaders()
  const form = new FormData()
  form.append("video", video)
  form.append("project_id", projectId)
  const res = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    headers,
    body: form,
  })
  return handleResponse(res)
}

// ── Path ───────────────────────────────────────────────────────────────────

export interface KaraokeWord {
  w: string
  t_start: number
  t_end: number
  line: number
}

export interface KaraokeLine {
  index: number
  text: string
  t_start: number
  t_end: number
}

export interface KaraokePath {
  words: KaraokeWord[]
  lines: KaraokeLine[]
  total_s: number
}

export interface PathResult {
  path: KaraokePath
  fits: boolean
  est_duration_s: number
  warning?: string
}

export async function getPath(data: {
  project_id: string
  edited_script: string
  speed: number
}): Promise<PathResult> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/path`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

// ── Evaluate ───────────────────────────────────────────────────────────────

export interface EvalResult {
  overall: number
  dimensions: {
    voice: number
    body: number
    delivery: number
    timing: number
    accuracy: number
  }
  comments: string[]
  flags: Array<{ type: string; line?: number }>
  language: string
  evals_left_today: number
}

export async function evaluateVideo(
  video: File | Blob,
  projectId: string,
): Promise<EvalResult> {
  const headers = await authHeaders()
  const form = new FormData()
  form.append("video", video)
  form.append("project_id", projectId)
  const res = await fetch(`${BASE}/api/evaluate`, {
    method: "POST",
    headers,
    body: form,
  })
  return handleResponse(res)
}

// ── Save ───────────────────────────────────────────────────────────────────

export async function saveTake(data: {
  video: File | Blob
  projectId: string
  scores: EvalResult
  duration_s?: number
}): Promise<{ take_id: string }> {
  const headers = await authHeaders()
  const form = new FormData()
  form.append("video", data.video)
  form.append("project_id", data.projectId)
  form.append("scores", JSON.stringify(data.scores))
  if (data.duration_s !== undefined) {
    form.append("duration_s", String(data.duration_s))
  }
  const res = await fetch(`${BASE}/api/save`, {
    method: "POST",
    headers,
    body: form,
  })
  return handleResponse(res)
}

// ── Takes ──────────────────────────────────────────────────────────────────

export async function getTakeUrl(takeId: string): Promise<{ url: string }> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/takes/${takeId}/url`, { headers })
  return handleResponse(res)
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function adminLogin(password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
  await handleResponse(res)
}

export async function getAdminLogs(params?: {
  from?: string
  to?: string
  action?: string
  user?: string
  limit?: number
  offset?: number
}): Promise<Record<string, unknown>[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString()
  const res = await fetch(`${BASE}/api/admin/logs${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  })
  const data = await handleResponse<{ events: Record<string, unknown>[] }>(res)
  return data.events ?? []
}

export async function getAdminAggregates(days = 30): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/api/admin/aggregates?days=${days}`, {
    credentials: "include",
  })
  const data = await handleResponse<{ aggregates: Record<string, unknown>[] }>(res)
  return data.aggregates ?? []
}

export async function setServiceEnabled(enabled: boolean): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/service`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
  await handleResponse(res)
}

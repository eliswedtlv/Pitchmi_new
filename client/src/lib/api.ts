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
    throw Object.assign(new Error(errorMessage(body)), { status: res.status, body })
  }
  return res.json() as Promise<T>
}

/**
 * The server's localized 413s (`take_too_long`, `take_too_large`) send
 * `message` as `{ en, he }`. Unwrapped it stringifies to "[object Object]" in
 * every error surface, so pick the English copy; the `body` rides along on the
 * thrown error for any caller that wants the other language.
 */
function errorMessage(body: { message?: unknown; error?: string }): string {
  const m = body.message
  if (typeof m === "string") return m
  if (m && typeof m === "object" && typeof (m as { en?: unknown }).en === "string") {
    return (m as { en: string }).en
  }
  return body.error ?? "Request failed"
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

export async function createProject(data?: { title?: string }): Promise<Project> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  })
  return handleResponse(res)
}

// ── Script ─────────────────────────────────────────────────────────────────

export interface ScriptResult {
  /**
   * A SEED path (T-10018) — a throwaway estimate at a fixed rate, good enough
   * to rehearse against once. /api/evaluate replaces it with the user's own
   * measured timings after every take.
   */
  path: KaraokePath
  word_count: number
  est_duration_s: number
}

export async function saveScript(projectId: string, text: string): Promise<ScriptResult> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/script`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, text }),
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

// Karaoke playback state shared across screens. `path` is the subtitle
// structure from /api/script (seeded) or /api/evaluate (re-timed from a real
// take); the other fields are kept for the session/UI contract — there is no
// fit check, the estimate is only a hint and the 30s cap is the real gate.
export interface PathResult {
  path: KaraokePath
  fits: boolean
  est_duration_s: number
  warning?: string
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
  /**
   * The prompter re-timed from THIS take (T-10018), present only when the take
   * matched the script closely enough to trust. The next rehearsal follows the
   * user's own measured pace instead of the seed estimate.
   */
  path?: KaraokePath
}

/** Evaluate is slow (Scribe + video eval + JSON retries: ~60–120s, worst case
 *  more). Give the request 5 minutes before we ever consider it dead. */
export const EVAL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Uploads the take and waits for the AI evaluation.
 *
 * Uses the plain fetch transport proven on iOS Safari — the T-1160
 * XMLHttpRequest rewrite silently failed on
 * iPhone (the POST never left the browser after the CORS preflight, and no XHR
 * handler ever fired, so the wait screen spun forever). Reliability wins over
 * byte-level upload progress here.
 *
 * An AbortController enforces the {@link EVAL_TIMEOUT_MS} ceiling so a dead
 * request always surfaces as an error instead of an eternal spinner. `onSent`
 * fires once the request has been dispatched (used only to advance the honest
 * "uploading" → "analyzing" label; never to imply the response has arrived).
 */
export async function evaluateVideo(
  video: File | Blob,
  projectId: string,
  onSent?: () => void,
): Promise<EvalResult> {
  const headers = await authHeaders()
  const form = new FormData()
  form.append("video", video)
  form.append("project_id", projectId)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EVAL_TIMEOUT_MS)

  let res: Response
  try {
    const request = fetch(`${BASE}/api/evaluate`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    })
    onSent?.()
    res = await request
  } catch (e) {
    if (controller.signal.aborted) {
      throw Object.assign(new Error("Evaluation timed out"), { status: 0 })
    }
    throw Object.assign(new Error("Network error"), { status: 0 })
  } finally {
    clearTimeout(timer)
  }

  return handleResponse<EvalResult>(res)
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

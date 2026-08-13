import type { SupabaseClient, User } from "@supabase/supabase-js"
import { GOOGLE_AUTH_ENABLED } from "./featureFlags"
import { ensureAuth, getSupabaseClient } from "./supabase"

export type AccountState =
  | { kind: "guest" }
  | { kind: "anonymous" }
  | { kind: "permanent"; name: string | null; email: string | null }

function cleanProfileValue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 80) : null
}

export function accountStateFromUser(user: User | null): AccountState {
  if (!user) return { kind: "guest" }
  if (user.is_anonymous) return { kind: "anonymous" }

  return {
    kind: "permanent",
    name:
      cleanProfileValue(user.user_metadata?.full_name) ??
      cleanProfileValue(user.user_metadata?.name),
    email: cleanProfileValue(user.email),
  }
}

export async function getCurrentAccount(
  client: SupabaseClient | null = getSupabaseClient(),
): Promise<AccountState> {
  if (!client) return { kind: "guest" }

  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) return { kind: "guest" }

  // getUser verifies the locally stored session with Supabase. Its result is
  // used only for this user's own account UI; authorization remains on the API.
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  return accountStateFromUser(data.user)
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/account"
  try {
    const base = new URL("https://killerpitch.local")
    const resolved = new URL(value, base)
    if (resolved.origin !== base.origin) return "/account"
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return "/account"
  }
}

function callbackUrl(nextPath: string): string {
  const url = new URL("/auth/complete", window.location.origin)
  url.searchParams.set("next", safeNextPath(nextPath))
  return url.toString()
}

export function safeOAuthDestination(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const destination = new URL(value)
    const isLocalDevelopment =
      destination.protocol === "http:" &&
      (destination.hostname === "localhost" || destination.hostname === "127.0.0.1")
    if (destination.protocol !== "https:" && !isLocalDevelopment) return null
    return destination.toString()
  } catch {
    return null
  }
}

async function followOAuthUrl(url: string | null | undefined) {
  const destination = safeOAuthDestination(url)
  if (!destination) {
    throw new Error("Google returned an unsafe authentication address.")
  }

  window.location.assign(destination)
}

export async function startGoogleUpgrade(nextPath = "/account") {
  if (!GOOGLE_AUTH_ENABLED) {
    throw new Error("Google saving is not enabled yet.")
  }

  const token = await ensureAuth()
  const client = getSupabaseClient()
  if (!token || !client) {
    throw new Error("A private KillerPitch session could not be started. Try again.")
  }

  const { data, error } = await client.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: callbackUrl(nextPath),
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  await followOAuthUrl(data.url)
}

export async function startGoogleSignIn(nextPath = "/account") {
  if (!GOOGLE_AUTH_ENABLED) {
    throw new Error("Google sign-in is not enabled yet.")
  }

  const client = getSupabaseClient()
  if (!client) throw new Error("Google sign-in is unavailable. Try again.")

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(nextPath),
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  await followOAuthUrl(data.url)
}

export async function signOutCurrentDevice() {
  const client = getSupabaseClient()
  if (!client) return
  const { error } = await client.auth.signOut({ scope: "local" })
  if (error) throw error
}

export function callbackErrorCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    const search = parsed.searchParams
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""))
    return (
      search.get("error_code") ??
      search.get("error") ??
      hash.get("error_code") ??
      hash.get("error")
    )
  } catch {
    return "invalid_callback"
  }
}

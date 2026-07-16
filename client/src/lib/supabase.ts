import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

/**
 * Returns a lazy-initialized Supabase client.
 * Returns null when env vars are not set (build-time safety).
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  if (!_client) {
    _client = createClient(url, key)
  }
  return _client
}

/**
 * Ensures the user is signed in anonymously and returns their access token.
 * Returns null if Supabase is not configured.
 */
export async function ensureAuth(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) return session.access_token

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.session) return null
  return data.session.access_token
}

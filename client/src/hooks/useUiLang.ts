"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { strings, type UiLang, type UiStrings } from "@/lib/i18n"

/**
 * The UI language (KP-D). A tiny external store rather than a provider, so every
 * screen (and every test that renders one) shares it without wiring. SSR — and
 * the hydration pass — render English; the client switches right after mount.
 *
 * Default: `navigator.language` (he* → he, else en). A choice from the header
 * toggle is persisted under `killerpitch:lang`.
 */

export const UI_LANG_KEY = "killerpitch:lang"

let current: UiLang | null = null
const listeners = new Set<() => void>()

function readStored(): UiLang | null {
  try {
    const v = window.localStorage.getItem(UI_LANG_KEY)
    return v === "he" || v === "en" ? v : null
  } catch {
    return null
  }
}

export function detectUiLang(): UiLang {
  if (typeof window === "undefined") return "en"
  const stored = readStored()
  if (stored) return stored
  const nav = typeof navigator === "undefined" ? "" : navigator.language ?? ""
  return nav.toLowerCase().startsWith("he") ? "he" : "en"
}

function getSnapshot(): UiLang {
  if (current === null) current = detectUiLang()
  return current
}

function getServerSnapshot(): UiLang {
  return "en"
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Mirror the UI language onto <html lang dir>. */
export function applyDocumentLang(lang: UiLang) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === "he" ? "rtl" : "ltr"
}

export function setUiLang(lang: UiLang) {
  current = lang
  try {
    window.localStorage.setItem(UI_LANG_KEY, lang)
  } catch {
    /* private mode — the choice lasts for this page only */
  }
  applyDocumentLang(lang)
  listeners.forEach((l) => l())
}

/** Test helper: forget the in-memory choice so the next read re-detects. */
export function resetUiLangForTests() {
  current = null
  listeners.forEach((l) => l())
}

export function useUiLang(): { lang: UiLang; t: UiStrings; setLang: (lang: UiLang) => void } {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  useEffect(() => {
    applyDocumentLang(lang)
  }, [lang])
  const setLang = useCallback((next: UiLang) => setUiLang(next), [])
  return { lang, t: strings(lang), setLang }
}

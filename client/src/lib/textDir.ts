/**
 * Text-direction resolution (T-1164). The detected language is the source of
 * truth, but if it is missing (e.g. the project was created before transcribe
 * populated it) we fall back to sniffing the script text itself so Hebrew still
 * renders right-to-left instead of reversed.
 */

export type Dir = "ltr" | "rtl"

// Languages whose script is right-to-left.
const RTL_LANGS = ["he", "ar", "fa", "ur"]

// Strong RTL characters: Hebrew, Arabic (+ supplements), Syriac, Thaana, and the
// Arabic presentation forms. A single one is enough to call a run RTL.
const RTL_STRONG = /[֐-׿؀-ۿ܀-ݏހ-޿ࠀ-ࣿיִ-﷿ﹰ-﻿]/

// Direction implied by a language code, or null when the code is missing/unknown.
export function dirForLang(lang?: string | null): Dir | null {
  if (!lang) return null
  return RTL_LANGS.includes(lang) ? "rtl" : "ltr"
}

// Direction sniffed from the content: any strong RTL char in the first 100
// characters makes the whole run RTL. Defaults to LTR for empty/Latin text.
export function dirForText(text?: string | null): Dir {
  if (!text) return "ltr"
  return RTL_STRONG.test(text.slice(0, 100)) ? "rtl" : "ltr"
}

// Prefer the language; fall back to the content only when the language is absent.
export function resolveDir(lang?: string | null, text?: string | null): Dir {
  return dirForLang(lang) ?? dirForText(text)
}

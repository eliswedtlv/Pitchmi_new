/**
 * Minimal localized string table (T-1162 §B). Keyed by the language code the
 * server returns from Scribe. English is the fallback for any other language.
 */

type Lang = "en" | "he"

const PROMPTER_HINT: Record<Lang, string> = {
  en: "Follow the highlighted word — it moves at your pace",
  he: "עקבו אחרי המילה המודגשת — היא נעה בקצב שלכם",
}

// Shown on the wait/error screen when the evaluation upstream times out
// (server 504, T-1165) — a plain retry message, never raw JSON.
const EVAL_TOO_LONG: Record<Lang, string> = {
  en: "The AI took too long — try again.",
  he: "ה-AI לקח יותר מדי זמן — נסו שוב.",
}

// Save-to-cloud feedback (T-1167 §C): confirmation toast + the inline link that
// takes the user to their saved videos, plus the saved button label.
const SAVED_TOAST: Record<Lang, string> = {
  en: "Saved to your videos",
  he: "נשמר לסרטונים שלכם",
}

const MY_VIDEOS: Record<Lang, string> = {
  en: "My videos",
  he: "הסרטונים שלי",
}

const SAVED_BUTTON: Record<Lang, string> = {
  en: "Saved ✓",
  he: "נשמר ✓",
}

function pick<T>(table: Record<Lang, T>, lang?: string | null): T {
  return table[(lang as Lang) in table ? (lang as Lang) : "en"]
}

export function prompterHint(lang?: string | null): string {
  return pick(PROMPTER_HINT, lang)
}

export function savedToast(lang?: string | null): string {
  return pick(SAVED_TOAST, lang)
}

export function myVideosLabel(lang?: string | null): string {
  return pick(MY_VIDEOS, lang)
}

export function savedButton(lang?: string | null): string {
  return pick(SAVED_BUTTON, lang)
}

export function evalTooLong(lang?: string | null): string {
  return pick(EVAL_TOO_LONG, lang)
}

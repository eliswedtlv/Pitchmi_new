/**
 * Minimal localized string table (T-1162 §B). Keyed by the language code the
 * server returns from Scribe. English is the fallback for any other language.
 */

import type { WaitStage } from "./waitStages"

type Lang = "en" | "he"

const PROMPTER_HINT: Record<Lang, string> = {
  en: "Follow the highlighted word — it moves at your pace",
  he: "עקבו אחרי המילה המודגשת — היא נעה בקצב שלכם",
}

// Take-1 teleprompter hint (KP-B): it follows the reader, not a clock.
const TELEPROMPTER_HINT: Record<Lang, string> = {
  en: "Read at your own pace — tap or swipe to move ahead",
  he: "קראו בקצב שלכם — הקישו או החליקו כדי להתקדם",
}

// Wait-screen stage labels (KP-B). The take is only transcribed to learn its
// rhythm — never scored.
const WAIT_STAGE: Record<Lang, Record<WaitStage, string>> = {
  en: {
    uploading: "Uploading your take…",
    learning: "Learning your rhythm…",
    done: "Done",
    error: "Something went wrong",
  },
  he: {
    uploading: "מעלים את הטייק…",
    learning: "לומדים את הקצב שלכם…",
    done: "סיום",
    error: "משהו השתבש",
  },
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

export function teleprompterHint(lang?: string | null): string {
  return pick(TELEPROMPTER_HINT, lang)
}

export function waitStageLabel(stage: WaitStage, lang?: string | null): string {
  return pick(WAIT_STAGE, lang)[stage]
}

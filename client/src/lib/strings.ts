/**
 * Minimal localized string table (T-1162 §B). Keyed by the language code the
 * server returns from Scribe. English is the fallback for any other language.
 */

type Lang = "en" | "he"

const PROMPTER_HINT: Record<Lang, string> = {
  en: "Follow the highlighted word — it moves at your pace",
  he: "עקבו אחרי המילה המודגשת — היא נעה בקצב שלכם",
}

export function prompterHint(lang?: string | null): string {
  return PROMPTER_HINT[(lang as Lang) in PROMPTER_HINT ? (lang as Lang) : "en"]
}

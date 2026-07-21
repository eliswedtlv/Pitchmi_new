/**
 * Minimal localized string table (T-1162 §B). Keyed by the language code the
 * server returns from Scribe. English is the fallback for any other language.
 */

type Lang = "en" | "he"

const PROMPTER_HINT: Record<Lang, string> = {
  en: "Follow the highlighted word — it moves at your pace",
  he: "עקבו אחרי המילה המודגשת — היא נעה בקצב שלכם",
}

// Shown under the editor title: the transcript arrives as a clean-verbatim draft
// (T-1163 §B), so tell the user to fix anything the cleanup got wrong.
const EDITOR_CLEANUP_CAPTION: Record<Lang, string> = {
  en: "We cleaned up your transcript — fix anything we got wrong.",
  he: "ניקינו את התמלול שלכם — תקנו כל מה שפספסנו.",
}

function pick<T>(table: Record<Lang, T>, lang?: string | null): T {
  return table[(lang as Lang) in table ? (lang as Lang) : "en"]
}

export function prompterHint(lang?: string | null): string {
  return pick(PROMPTER_HINT, lang)
}

export function editorCleanupCaption(lang?: string | null): string {
  return pick(EDITOR_CLEANUP_CAPTION, lang)
}

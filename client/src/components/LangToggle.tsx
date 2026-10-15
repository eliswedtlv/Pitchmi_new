"use client"

import { useUiLang } from "@/hooks/useUiLang"
import { cn } from "@/lib/utils"
import type { UiLang } from "@/lib/i18n"

const OPTIONS: { lang: UiLang; label: string; name: string }[] = [
  { lang: "en", label: "EN", name: "English" },
  { lang: "he", label: "עב", name: "עברית" },
]

/** EN / עב switch for the header of every product screen (KP-D). */
export function LangToggle({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  const { lang, t, setLang } = useUiLang()
  return (
    <div
      role="group"
      aria-label={t.langToggleLabel}
      // Always EN first, on the left: the control itself is not text.
      dir="ltr"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border p-0.5 text-micro font-semibold",
        inverse ? "border-white/15 bg-black/45 backdrop-blur-sm" : "border-line bg-surface",
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = o.lang === lang
        return (
          <button
            key={o.lang}
            type="button"
            lang={o.lang}
            aria-label={o.name}
            aria-pressed={active}
            onClick={() => setLang(o.lang)}
            className={cn(
              "min-w-8 rounded-full px-2 py-1 leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              // Neutral fill, never the accent: the accent is spent on each
              // screen's one primary action.
              active
                ? inverse
                  ? "bg-white text-black"
                  : "bg-fg text-canvas"
                : inverse
                  ? "text-white/70 hover:text-white"
                  : "text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

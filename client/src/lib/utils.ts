import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's OWN scale names. Every token this app
 * defines in `globals.css` (T-10022) is invisible to it, and an unknown `text-*`
 * value is guessed to be a font size — so `text-primary-fg` and `text-body`
 * landed in the same conflict group and the colour was silently dropped,
 * rendering a black label on a black button. The custom scales have to be
 * declared here or every token-vs-token merge is a coin flip.
 *
 * If you add a colour, radius or type step to `globals.css`, add it here too.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      colors: [
        "canvas", "surface", "raised",
        "line", "line-strong", "track",
        "fg", "fg-muted", "fg-subtle",
        "primary", "primary-fg",
        "danger", "danger-fg",
        "media", "media-fg",
        "good", "good-fg", "good-soft",
        "warn", "warn-fg", "warn-soft",
        "bad", "bad-fg", "bad-soft",
      ],
      borderRadius: ["control", "panel"],
    },
    classGroups: {
      "font-size": [{ text: ["micro", "meta", "body", "lead", "title", "display"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

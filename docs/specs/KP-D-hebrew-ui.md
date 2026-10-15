# KP-D — Hebrew UI end to end (T-5540)

Product: `docs/` + KillerPitch definition ("Any language including Hebrew"); Eli decided 2026-10-01 that every TLVG app ships a complete Hebrew UI. English is the base text; Hebrew is a translation of it (Eli, 2026-10-15).
Should take ~60 min. If it takes much longer, stop, commit what works, push and report.
Scope: `client/` only (+ one `docs/STATUS.md` bullet). Do not touch `server/` or the karaoke/teleprompter/burn-in logic (`lib/burnIn.ts`, `lib/teleprompter.ts`, `hooks/useSpeechFollow.ts`, `lib/clock.ts`) beyond passing a language in.

## What to build
1. **One UI dictionary** `client/src/lib/i18n.ts`: `type UiLang = "en" | "he"`, a typed `en` table holding EVERY user-visible string of the product screens (home/composer, consent form, karaoke/teleprompter chrome and hints, wait screen, results, privacy page, account/auth pages, delete-my-data, error messages, aria-labels, button titles), and a `he` table with the same keys (TypeScript must fail if a key is missing). Fold the existing `lib/strings.ts` tables into it (keep exports used elsewhere working or update the callers).
2. **Language choice**: default from `navigator.language` (`he*` → he, else en), persisted in localStorage (`killerpitch:lang`, wrapped in try/catch), overridable by a small EN / עב toggle in the header of every product screen. Expose via a tiny React context/hook `useUiLang()`; SSR renders English, then the client switches after mount without layout jump beyond the text itself.
3. **Direction**: when he, set `document.documentElement.lang="he"` and `dir="rtl"`; en → `lang="en"`, `dir="ltr"`. Fix every layout that breaks in RTL: use logical properties (`ms-/me-/ps-/pe-/start/end`, `text-start`), mirror directional icons (arrows/chevrons) where they mean "forward/back", keep the video player's scrubber and time readout LTR (time runs left→right in both), keep numbers LTR (`dir="ltr"` / `.nums`). Use the Heebo font already loaded for Hebrew text.
4. **Script direction stays content-driven**: the teleprompter/karaoke/burn-in direction keeps coming from the script text (`resolveDir`), independent of UI language — an English pitch in the Hebrew UI still reads LTR and vice versa.
5. **Privacy page**: translate fully into Hebrew (same meaning, plain Hebrew, no new claims).
6. Hebrew copy: natural, plural-gender-neutral form as the existing strings do ("הקליטו", "קראו"), short, no machine-translation tone. Product name stays "KillerPitch" in Latin letters.
7. Metadata/OG stay English (out of scope).

## Done when
- `cd client && npx vitest run` green, with new tests: missing-key type guard (compile-time is fine), toggle switches `lang`/`dir` and persists, `navigator.language="he-IL"` defaults to Hebrew, an English script in Hebrew UI keeps the prompter LTR.
- `npm run build` exits 0.
- `grep` for English UI literals left in JSX of the product screens returns only intentional ones (brand name, numbers).
- Run the Playwright layout specs in `client/tests-layout/` if they run headless in your environment; otherwise skip and say so.
- Commit on branch `kp-d`, push it (never main, never force). Report: what changed, tests, anything left in English and why.

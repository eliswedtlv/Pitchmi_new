# KP-E — Karaoke never "stuck" at the start (Ariela bug 1, 2026-10-15)

Should take ~25 min. If it takes much longer, stop, push what works and report.
Scope: `server/src/lib/scriptPath.js` (+ its tests) and the karaoke lead-in cue in `client/src/components/Prompter.tsx` / `client/src/app/karaoke/page.tsx` only. A parallel task edits `client/src/hooks/useRecorder.ts` and another edits `client/src/app/results/page.tsx` + `client/src/lib/i18n.ts` — do not touch those files (if you need a new string, hard-code nothing: reuse an existing i18n key or render a non-text cue).

## Bug
Tester on iPhone: on take 2 the karaoke "doesn't play, stays stuck". Cause: the rhythm keeps take 1's leading silence. Take 1 is a teleprompter the person advances by tapping, so they often start talking 5–10 s after recording starts. Take 2's karaoke then shows a static first line with no highlight for those seconds and looks frozen.

## Fix
1. **Server** (`buildPathFromScript`): after timings are built, shift the whole path so the first word starts at `LEAD_IN_S = 1.0` s when it would start later (never shift later; never negative). Apply to words AND lines, and recompute `total_s`. Keep `enforceMonotonic` semantics. Regression tests: a take whose first word is at 9.4 s → path first `t_start` 1.0, gaps between words unchanged, `total_s` reduced by 8.4; a take whose first word is at 0.4 s → unchanged.
2. **Client cue**: during a karaoke take, before the first word's `t_start`, show a visible lead-in on the first word/line (e.g. a thin progress bar under the active line filling until the first word, or a pulsing first word) so the screen never looks frozen. Use the existing clock (elapsed vs `words[0].t_start`); add a small test.

## Done when
- `cd server && npx jest` green, `npx standard` clean; `cd client && npx vitest run` green, `npm run build` 0.
- Commit on branch `kp-e`, push it (never main, never force). Short report.

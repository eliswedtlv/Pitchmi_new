# KP-G — Results: clear next step, no "where's my score?", explain the rhythm lock (Ariela bugs 3–4, 2026-10-15)

Should take ~30 min. If it takes much longer, stop, push what works and report.
Scope: `client/src/app/results/page.tsx`, `client/src/lib/i18n.ts` (EN base + HE translation) and their tests only. Parallel tasks edit `useRecorder.ts`, `karaoke/page.tsx`, `Prompter.tsx` — do not touch them.

## Feedback (tester, iPhone, Hebrew UI)
- "What happens next? Where is the rating button? How do I continue from here?"
- "What is the 'rhythm locked' button for?"

KillerPitch deliberately has NO score (product rule: "No score: the camera is a mirror"). The screen must say so in one line and make the next step obvious.

## Change
1. Under the video, one short line that sets the expectation, e.g. EN "No score here — watch yourself like in a mirror. Happy with it? Share it. Want it smoother? Take it again." (HE translation in the same plural voice as the rest of `i18n.ts`.)
2. The primary action must be visible without scrolling on a 390×844 phone together with the video: make the video area shorter on phones if needed (max ~45svh) and keep "Try again" as the single primary button directly under it, with Share next to it as the second action. Edit text / New video stay as quieter secondary actions.
3. Next-take explainer: one line that says what the next take will do: first time "Next take: the words light up on the rhythm you just set." etc. (reuse/rename the existing noteNew/noteEarlier/noteTeleprompter strings).
4. Rhythm lock: keep it (product change 4) but explain it in place. Button label "Keep this rhythm" + helper text right under it: "Your next takes follow this take's pace instead of updating each time." When locked: "Rhythm locked — your next takes follow this take's pace." with "Unlock". Hebrew equivalents.
5. Tests: results renders the no-score line, primary Try again, lock helper text, EN and HE.

## Done when
- `cd client && npx vitest run` green, `npm run build` 0.
- Commit on branch `kp-g`, push it (never main, never force). Short report with a phone-size screenshot description of the final layout.

# T-1161 — Mobile UX overhaul + evaluate-transport bug (CC /goal)

Read CLAUDE.md and docs/update_status.md first. After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, commit and push the changes.

- **Task ID:** T-1161
- **Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
- **Priority:** A is P0 (feature is unusable on iPhone); B/C/D are P1 mobile UX.

## A. P0 — evaluate request never reaches the server (INVESTIGATE FIRST, then fix)

Production evidence (2026-07-19, iPhone iOS Safari):
- Railway edge log: `OPTIONS /api/evaluate → 204` at 15:51:57, then **no POST /api/evaluate ever arrives** (nothing logged — not 499, not 413, nothing).
- The SAME recording uploads fine moments earlier to `POST /api/transcribe` (18–29s total) — so network, size cap, and CORS are fine.
- Key difference: T-1160 (`0935613`) rewrote ONLY the evaluate call from fetch to XMLHttpRequest (`client/src/lib/api.ts`, `evaluateVideo`, 5-min timeout + upload progress). Transcribe still uses fetch and works. The XHR path is the prime suspect (iOS Safari + XHR + FormData/Blob quirks, or an error path that never surfaces).
- Meanwhile the wait screen advanced through timer-driven labels to "Scoring your delivery" and sat there forever — the labels lied about actual state.

Investigation deliverable (write findings into docs/STATUS.md under Known issues before fixing): current behavior, reproduction (desktop Chrome + iOS Safari if possible via responsive mode caveats), root cause with file references, chosen fix.

Fix requirements, whatever the root cause turns out to be:
1. Make the evaluate upload use a transport proven on this app — simplest: the same fetch transport transcribe uses, with AbortController for the 5-minute ceiling. Upload-progress % is nice-to-have; reliability wins. If you keep XHR, prove every handler (onload/onerror/ontimeout/onabort) routes to UI state.
2. Any transport failure/timeout MUST surface to the user as the standard error screen — never an eternal spinner.
3. Stage labels must be state-driven, not clock-driven past reality: "Uploading" until the request body is fully sent, then at most a single honest "Analyzing your take… (can take ~2 minutes)" until the response arrives. Never display a stage implying later progress ("Scoring") before a server response exists.

## B. Portrait video on phones

Recording currently comes out landscape. On mobile (portrait viewport), getUserMedia constraints and the recorded output must be portrait (e.g. ideal 720×1280, aspectRatio to match), preview fills the portrait frame edge-to-edge; desktop keeps landscape 16:9. Results playback and saved takes must show the correct aspect (no letterboxed sideways video). Inspect `useRecorder`, recorder/karaoke screens, results player.

## C. Karaoke subtitles ON the video, not below it

During the karaoke re-record the camera preview must stay fully in view and the prompter renders OVER it, karaoke-style: bottom third of the frame, semi-transparent dark scrim, large high-contrast text, current word highlighted, 2–3 lines visible, countdown overlaid too. Same overlay treatment for the take-1 recorder countdown. No layout where text pushes the video off-screen or sits under it.

## D. Hebrew / RTL is broken on script text ("titles")

Hebrew renders wrong in script-bearing UI (prompter lines, transcript editor, results). Fix with proper bidi handling:
- `dir="auto"` (or explicit `dir` from the project's detected `language`) on: editor textarea, every prompter line, transcript/accuracy displays, project titles, coach comments.
- Wrap word-level spans with unicode-bidi isolation (`<bdi>` or `unicode-bidi: isolate`) so per-word highlighting in the prompter cannot scramble RTL order, including mixed tokens (numbers, Latin brand names) inside Hebrew sentences.
- Text alignment follows direction (right-aligned for RTL) on those elements; UI chrome stays LTR English.
- Verify the §6 path/line-breaking output renders in correct logical order in the overlay for a Hebrew script fixture.

## Do not touch

Server API contracts, scoring math, eval prompt/rubric, auth, DB schema, the ad stub contract, admin.

## Verification

- `cd client && npx vitest run` green, `npm run build` exit 0; `cd server && npx jest` green, `npx standard` clean (server likely untouched — still run).
- New client tests: (1) evaluate transport — success routes to results; simulated network error and timeout both route to the error screen (no infinite wait); (2) stage-label state machine never emits a post-response label before a response; (3) an RTL Hebrew line renders with `dir` set and word spans bidi-isolated; (4) recorder constraint helper returns portrait dimensions for portrait viewports, landscape for desktop.
- Append to the manual QA checklist in docs/STATUS.md: iPhone Hebrew karaoke take end-to-end with overlay subtitles, portrait output plays correctly in results and after download.

git diff --stat review before commit, then git add -A && git commit -m "Mobile UX: portrait capture, overlay karaoke, RTL, evaluate transport fix (T-1161)" && git push.

REMINDER: Do not forget to commit, push, and update docs/STATUS.md and docs/TASKS.md.

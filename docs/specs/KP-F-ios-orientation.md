# KP-F — First iPhone take recorded sideways (Ariela bug 2, 2026-10-15)

Should take ~30 min. If it takes much longer, stop, push what works and report.
Scope: `client/src/hooks/useRecorder.ts`, `client/src/lib/recorderConstraints.ts` and their tests only. Parallel tasks edit `client/src/app/karaoke/page.tsx`, `client/src/components/Prompter.tsx`, `client/src/app/results/page.tsx`, `client/src/lib/i18n.ts` — do not touch them.

## Bug
iPhone Safari, portrait: the FIRST take ever recorded plays back rotated 90° (landscape frame, person sideways) on the results screen; the second take is fine. Classic iOS Safari behaviour: right after the camera-permission prompt, the first `getUserMedia` track starts with landscape dimensions/rotation and settles a moment later; MediaRecorder started on that track bakes the wrong orientation into the file.

## Fix
- After `getUserMedia` and before `MediaRecorder.start()`, wait until the preview has real frames (`loadedmetadata` + a `requestVideoFrameCallback`/short poll) and check the orientation: on a portrait viewport (`isPortraitViewport()`), require `videoHeight > videoWidth` (or `track.getSettings()` width < height). If it is landscape, wait up to ~1.5 s for it to settle (re-check on `resize` of the video element); if it still doesn't, stop the tracks and call `getUserMedia` once more with the same constraints, then proceed regardless (never block recording forever).
- The countdown already covers this time — do the wait during the countdown, don't add visible delay when the stream is already correct.
- Unit tests with mocked MediaDevices/video element: landscape-then-portrait settles without re-request; stuck landscape triggers exactly one re-request; desktop (landscape viewport) never waits.

## Done when
- `cd client && npx vitest run` green, `npm run build` 0.
- Commit on branch `kp-f`, push it (never main, never force). Short report, including what you could not verify without a real iPhone.

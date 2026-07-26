# T-1170 — Timing-offset normalization + results-screen actions (CC /goal)

Read CLAUDE.md and docs/update_status.md first. After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, commit and push the changes.

- **Task ID:** T-1170
- **Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`

## A. P0 — timing scoring penalizes constant lead/lag (PROVEN bug)

PM reproduced against production (2026-07-26), controlled tests:
- Evaluate the SAME clip that set the subtitles → timing 100, no flags. (Scorer math per-word is fine.)
- Evaluate a take with IDENTICAL rhythm shifted uniformly +1.2s (prepended silence) → timing 66, ALL lines flagged `dragged_line`.
- Real tester (Ariella) saw timing 31 with all 5 lines `Rushing` — the mirror case (uniformly ahead).

Root cause in `server/src/lib/score.js`: per-word `offset = actual_start − target_start` is measured against absolute subtitle timestamps, and per-line/overall timing + rushing/dragging flags use that raw offset. A constant global lead or lag (user simply starts a beat early/late but speaks at the same pace) is NOT a rhythm error, yet it shifts every word's offset the same way → every line flags and the score collapses.

Fix:
1. After aligning take words to subtitle words, compute `medianOffset` = median of all matched `(actual_start − target_start)`.
2. Define `relOffset = offset − medianOffset` for every matched word. Use `relOffset` (NOT raw offset) for: per-line mean offset, the overall timing score, drift-slope, and the `rushed_line`/`dragged_line`/`long_pause` flags.
3. Timing score = 100 at mean |relOffset| ≤ 0.3s, linear to 0 at ≥ 3.0s (same curve, now on relative offset). Constant lead/lag no longer penalized.
4. Keep `off_script` (accuracy-based) and `skipped_line` (coverage-based) unchanged — they don't depend on offset.
5. `long_pause` should also use relative timing: flag a gap only if it exceeds the expected gap by > 2× AFTER offset normalization, so a uniformly shifted take doesn't spuriously flag pauses.

Tests (server/tests): identical take → timing 100, no flags (regression); uniform +1.2s shift → timing ≥ 95, zero rushing/dragging flags (the proven case); a genuinely rushed single line (one line delivered 1.5s fast relative to the rest) → that ONE line flags `rushed_line` and others don't; genuine progressive rush (accelerating) → drift slope still detected.

## B. Results-screen actions (Ariella feedback, Eli-approved)

In `client/src/app/results/page.tsx`:
1. **Primary button = "Try again"** (green, prominent) — re-records the karaoke take against the same subtitles (the most common improve-my-pitch action). Demote Save-to-cloud from green primary.
2. **Consolidate to a single "Share" action** using the OS share sheet (Web Share API with the video file — `navigator.share`/`canShare` with files). The native sheet already offers both "share to app" AND "save to files/photos", so it covers sharing + download in one. REMOVE the separate **Download** and **Save to cloud** buttons.
3. Final button set on results: **Try again** (green primary), **New video** (secondary), **Share** (secondary, OS sheet). Nothing else.
4. Consequence of removing Save-to-cloud: nothing writes to cloud storage anymore, so the **"My videos" entry/nav becomes dead — hide it** from the UI (home + anywhere it's linked). Keep the `/videos` screen, `/api/save`, `/api/takes/:id/url`, and the storage bucket code in place but unlinked (v2 feed/publish will reintroduce saving). Note this in STATUS.md as a deliberate MVP decision, not a deletion.
5. Web Share with files is unsupported on some desktop browsers — when `navigator.canShare({files})` is false, fall back to a direct download of the video file so the button always does something.

## Do not touch

Auth, DB schema, evaluate/provider pipeline, transcribe/subtitles (T-1169), prompt/persona, RTL renderer, admin, the dormant save/videos code (leave functional, just unlinked).

## Verification

- Server: `npx jest` green incl. the new timing-normalization tests above; `npx standard` clean.
- Client: `npx vitest run` green — new tests: results shows Try-again as the primary/green button; only Try again / New video / Share render (no Download or Save-to-cloud); Share calls `navigator.share` when files supported and falls back to download when not; My-videos nav hidden. `npm run build` exit 0; `npm run test:layout` 2/2.
- STATUS.md: timing root-cause writeup (with the +1.2s repro), results-actions change, My-videos-unlinked deviation. TASKS.md updated.

git diff --stat review before commit, then git add -A && git commit -m "Timing: normalize constant offset; results: Try-again primary + single OS Share (T-1170)" && git push.

REMINDER: Do not forget to commit, push, and update docs/STATUS.md and docs/TASKS.md.

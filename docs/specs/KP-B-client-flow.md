# KP-B — Client: teleprompter take 1, karaoke from take 2, rhythm lock, no score, 5-min cap

Product definition: `/Users/eliswed/Dropbox/Code/tlvg-launch-plan/apps/killerpitch.md` (changes 1–4 client half, and "camera stays as a mirror").
Should take ~60 min. If it takes much longer, stop and report.
Scope: `client/` only (+ `docs/STATUS.md`). Do NOT touch `server/` — a parallel task (KP-A) changes it to the contract below. Do NOT build the burned-in video export — a parallel task (KP-C) creates `client/src/lib/burnIn.ts`; leave Share/Download sharing the raw take blob as today.

## Server contract after KP-A (code against this)
- `POST /api/script {project_id, text}` → `{ word_count }`. No path anymore (path is null server-side).
- `POST /api/evaluate` is GONE. New `POST /api/rhythm` multipart `{video, project_id}` → `{ path: KaraokePath | null, coverage: number | null, language: string | null, rhythms_left_today: number }`. `path` null = the take didn't match the script; keep the previous rhythm. Errors: 413 take_too_long, 415, 429 daily_limit `{limit}`, 503 busy, 500.

## The new flow
1. **Home**: type script → consent (unchanged) → `createProject` + `saveScript` → `/karaoke` in **teleprompter mode** (no rhythm yet).
2. **Take 1 = teleprompter that follows the reader.** No timed karaoke. Show the script in the existing prompter look (3 lines, reading line, RTL-correct as `Prompter.tsx` does today). Advance as the person reads:
   - Where `SpeechRecognition`/`webkitSpeechRecognition` exists, run it continuous + interim results in the script's language (`he-IL` when the script is RTL, else `en-US`; or `navigator.language`), match recognized words forward against the script tokens (tolerant fuzzy match, never move backwards, allow skipped words) and move the active word/line.
   - Always also allow manual advance: tap/click or swipe/scroll on the prompter, arrow/space keys on desktop. If recognition errors or is missing, manual mode is all there is — never block recording.
   - The recording itself (MediaRecorder, mic audio) must keep working while recognition runs; if starting recognition breaks recording on a platform, skip recognition there.
3. **After any take** (not locked): go to `/wait`, upload with `POST /api/rhythm`. On `path` → that take becomes the rhythm (`pathResult`). On null path → keep the old rhythm, show a quiet note on results ("This take didn't match your script closely, so your rhythm stayed the same."). If there was no rhythm yet (take 1) and path is null, the next take is again a teleprompter take.
4. **Take 2+ = karaoke** on the current rhythm (existing `Prompter` + `useKaraokeClock`, unchanged behaviour).
5. **Results screen** (`/results`): remove the score, dimensions, comments, flags, "evaluations left" — everything from the AI eval. Keep: playback of the take, Try again (→ `/karaoke`), Edit text (→ home with script), Share / Download (raw blob, as today), Save-to-cloud if it is there today. Add **"Keep this rhythm"** toggle: locks the rhythm used for the NEXT takes to this take's rhythm. While locked: label reads "Rhythm locked" with an Unlock action; takes skip `/wait` and the upload entirely (no speech-to-text) and go straight to `/results`. Unlock → next take updates the rhythm again. Lock lives in the session store (no server change).
   - Make it clear on results which take's rhythm is in use (e.g. "Next take follows this take's rhythm" vs "Next take follows your locked rhythm").
6. **Wait screen**: keep the ad slot and `WaitView`; relabel stages from evaluating/analyzing to "Learning your rhythm" (en; Hebrew via existing strings helpers). Remove eval-specific copy (`evalTooLong`, `evalStages` if orphaned).
7. **Cap 5 min**: `MAX_TAKE_S = 300` in `lib/limits.ts`; teleprompter take max = 300 s; karaoke take max = `min(300, path.total_s + grace)`. Fix any copy that says 30 seconds in the flow (do NOT change the slogan/brand line — that is change 6, out of scope). Set `videoBitsPerSecond: 1_500_000` (and `audioBitsPerSecond: 64_000`) on the MediaRecorder so a 5-min take stays well under the 200 MB upload cap.
8. **Mirror**: the live camera preview on `/karaoke` is mirrored (CSS `scale-x-[-1]`) like a mirror; the recorded file is not. Playback on results is mirrored too (the person sees themselves as in the mirror).
9. Remove dead client code your change orphans: `evaluateVideo`, `EvalResult`, `EVAL_TIMEOUT_MS`, eval stages, score components. Keep `AdSlot`.

## Done when
- `cd client && npx vitest run` green (update/remove results/wait/karaoke tests; add tests for: rhythm lock skips upload, null path keeps old rhythm, teleprompter mode when no rhythm, manual advance moves the active line).
- `npm run build` exits 0.
- Check it in a browser against a local server is NOT required (server is changing in parallel); unit tests with a mocked `api.ts` are enough.
- `docs/STATUS.md`: one bullet (KP-B). Commit on your branch and push the branch to origin (never main, never force).

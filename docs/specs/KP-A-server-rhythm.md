# KP-A — Server: 5-minute cap, no AI evaluation, rhythm-only speech-to-text

Product definition: `/Users/eliswed/Dropbox/Code/tlvg-launch-plan/apps/killerpitch.md` (changes 1–3, server half).
Should take ~40 min. If it takes much longer, stop and report.
Scope: `server/` only (+ `docs/STATUS.md`). Do NOT touch `client/` — a parallel task owns it.

## Changes
1. **Cap 30 s → 5 min.** `config.MAX_TAKE_S` default 300. Fix the 413 `take_too_long` message (en/he) to "5 minutes". Raise `MAX_UPLOAD_MB` default to 200 and `MAX_SCRIPT_CHARS` default to 6000 (5 min of speech). Update the comments that say 30 s.
2. **Remove the Gemini/OpenRouter video evaluation and all scoring.** Delete `src/lib/evaluate.js`, `src/lib/score.js`, `src/lib/combine.js`, `transcodeForEval` in `audio.js` (if nothing else uses it), the `EVAL_PROVIDER`/OpenRouter/Gemini config keys, and their tests. Remove `POST /api/evaluate`.
3. **New `POST /api/rhythm`** (same middleware chain as the old evaluate: `rateLimit.evaluate` (rename to `rateLimit.rhythm` is fine), `auth`, `consent`, `upload.single('video')`). Multipart `{ video, project_id }`. Steps: daily cap (`DAILY_EVAL_LIMIT`, keep the env key) → `extractAudio` → duration cap check (above) → Scribe `transcribe` → `buildPathFromScript(project.script, take.words)` → if `coverage >= MIN_ALIGN_COVERAGE` and words exist, `db.updateProject(... { path })`.
   Response 200: `{ path: KaraokePath | null, coverage: number | null, language: string | null, rhythms_left_today: number }`. `path` is null when the take did not match the script well enough (client keeps its previous rhythm).
   Errors keep the existing shapes: 400 missing_video / missing_project_id, 404 project_not_found, 413 take_too_long, 415 unsupported_media_type, 429 daily_limit, 503 busy, 500 server_error. Remove the 504 eval timeout path.
   Event row: `action: 'rhythm'`, numeric metadata only (duration_s, language, coverage, retimed, scribe_ms, stt cost). Check `routes/admin.js` / db aggregates still work with the new action name (no score columns assumed).
4. **No seed path.** `POST /api/script` stores the script and sets `path: null` (remove `buildSeedPath` and its tests). Still reject `script_too_short` (< 3 tokens; tokenize with the existing tokenizer) and `script_too_long`. Response: `{ word_count }`.
5. Delete now-dead helpers only if your change orphaned them. Keep `/api/save`, `/api/takes`, consent, privacy, admin, ad routes unchanged.

## Done when
- `cd server && npx jest` green (rewrite `api.evaluate*` tests as `api.rhythm` tests: success with path, low coverage → path null, too long → 413, daily limit → 429; delete score/eval tests).
- `npx standard` clean.
- `grep -rn "openrouter\|gemini\|scoreTake\|buildSeedPath\|combineResult" server/src` returns nothing.
- `docs/STATUS.md`: one bullet under "Recently shipped" (KP-A). Commit on your branch and push the branch to origin (never main, never force).

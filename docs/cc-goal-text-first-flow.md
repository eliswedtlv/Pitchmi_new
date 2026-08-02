# T-10018 — Text-first flow: type your script, rehearse, and the path learns your pace

Read `CLAUDE.md` and `docs/update_status.md` first. After completing all changes, update `docs/STATUS.md` by following `docs/update_status.md`, update `docs/TASKS.md` if task state changes, commit and push the changes.

**Task ID:** T-10018
**Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Time budget:** ~2 hours. If you pass 3, stop and report what is done and what is left rather than pushing through.

---

## Why this exists

Today the product opens with "record a take". You improvise, the app transcribes you, and your recorded words become the karaoke subtitles. Eli's judgment after testing: **people cannot edit by speaking again.** To change a word you have to re-perform the whole thing.

So the entry point becomes text. You type or paste your script and rehearse against it immediately.

That raises the one hard problem: **karaoke needs a timestamp per word, and typed text has none.** The answer here is a two-stage path:

1. **Seed** — the first karaoke pass runs on an estimated even pace. Plausible, not personal.
2. **Learn** — every karaoke take is already transcribed by `/api/evaluate` for scoring. After scoring, align that transcript back to the typed script and **replace the path with the user's real word timings**. From take 2 onward they rehearse against their own rhythm, and it keeps converging.

Nothing extra is recorded, and no take is wasted — the take that teaches the app your pace is the same take that gets scored.

**Read this before writing the seed pacer.** T-1167 and T-1168 built an elaborate pacing engine (`lib/path.js` — `layUniform`, `layAnchored`, `smoothRates`, anchor coverage, comfort bias, LCS) and it was rejected twice as "too fast" and "not my rhythm"; T-1169 deleted it. The seed here is deliberately a fraction of that: even distribution by character length plus fixed punctuation pauses, roughly 40 lines. **No anchoring, no stretching, no rate smoothing, no coverage thresholds.** It is disposable by design — it survives exactly one take. If you find yourself rebuilding any part of the deleted engine, stop; that is a failure of this task.

---

## The flow being built

```
/           type or paste the script     → POST /api/projects, POST /api/script (returns seed path)
/karaoke    rehearse on camera           → (unchanged)
/wait       evaluate                     → POST /api/evaluate now also re-times the path
/results    score + Try again / Edit text → Try again rehearses against the LEARNED path
```

Removed: `/recorder` (the improvise-first screen), the home upload-a-video path, and `POST /api/transcribe` in its entirety — nothing transcribes separately any more, because `/api/evaluate` already runs Scribe on every take.

---

## Stack facts you need

- `server/` — Node 22, Express 4.22, **JavaScript ES6, StandardJS (no semicolons, single quotes, 2-space indent)**. Jest + Supertest, 142 green. `npx standard` must stay clean.
- `client/` — Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4. Vitest + Testing Library, 82 green, plus a Playwright layout proof (`npm run test:layout`, 2 green). `npm run build` must exit 0.
- State: Zustand, **in-memory only** (`client/src/store/session.ts`) — no persistence; every screen guards on `project` and bounces to `/` when absent. Keep that pattern.
- Auth: Supabase anonymous sign-in; `authHeaders()` at `client/src/lib/api.ts:10-14`.

---

## Part A — Server

### A1. New `server/src/lib/scriptPath.js`

Two exported functions. This module is the whole algorithmic core of the task.

#### `buildSeedPath(scriptText)` → `{ words, lines, total_s }`

The disposable first-pass timeline.

1. Tokenize with `segmentWords(scriptText)` from `server/src/lib/text.js:46-65` — already language-aware (Intl.Segmenter, CJK grapheme fallback) and it returns `[{ w, clauseBreak, sentenceEnd }]`, which is exactly what the pauses below need. Do not write a new tokenizer.
2. Give each word a duration proportional to `charLen(w)` (`text.js:17-19`) at `SEED_CHARS_PER_SECOND` (config, default **13**).
3. Insert fixed gaps after each word: `WORD_GAP` 80 ms, `CLAUSE_GAP` 150 ms when `clauseBreak`, `SENTENCE_PAUSE` 350 ms when `sentenceEnd`. These three numbers come from T-1168, which tuned them against real speech; reuse them rather than inventing new ones. Gaps are fixed and never scaled.
4. Emit `[{ w, start, end }]` and hand it to `buildSubtitles` (below).

Pace by **characters, not words per minute**, because word length varies enormously between English and Hebrew while characters-per-second is far more stable. `SEED_CHARS_PER_SECOND = 13` is approximately 150 wpm in English. **It is an estimate and will be wrong for many speakers — say so in STATUS.** That is acceptable precisely because it survives one take.

#### `buildPathFromTake(scriptText, spokenWords)` → `{ path, coverage, matched, total }`

The learned timeline — the user's real pace, recovered from a take.

1. Tokenize the typed script exactly as above.
2. **Align.** `align(pathNorm, spoken)` is **already exported** from `server/src/lib/score.js:193` — a Levenshtein DP over normalized tokens returning ascending `{ pi, si }` pairs for zero-cost diagonal matches. Call it as:

   ```js
   const pathNorm = tokens.map(t => normalize(t.w))
   const spoken = (spokenWords || []).map(s => ({
     norm: normalize(s.w),
     start: Number(s.start),
     end: Number(s.end),
     filler: isFiller(s.w)
   }))
   const { matches } = align(pathNorm, spoken)
   ```

   `scoreTake` builds its own `spoken` array at `score.js:26-30` and **drops `end`** — you need `end`, so build your own as above. `align` never reads `start`/`end`, so **do not modify `align`**. A spoken filler can never anchor a typed word (`eq`, `score.js:75`); that is correct, leave it.

3. **Assign timestamps.** Matched typed words take the real `spoken[si].start` / `.end`. Unmatched typed words — mis-heard, skipped, fumbled — are **interpolated**:
   - Between two anchors: distribute the gap in proportion to `charLen`.
   - Before the first anchor: back-extrapolate at the mean rate of the matched region, floored at `t_start >= 0`.
   - After the last anchor: forward-extrapolate at that same rate.
   - An interpolated word's `end` is the next word's `start`; the last word's `end` is the last spoken `end`.
   - `t_start` must be **strictly non-decreasing** across the whole array. `client/src/lib/clock.ts:18-28` scans for the last word whose `t_start <= elapsed` and early-`break`s — a non-monotonic array breaks highlighting **silently**, with no error anywhere.

4. Hand the result to `buildSubtitles(words)` and return it with `coverage = matched / total`.

#### Both functions end at `buildSubtitles`

`server/src/lib/subtitles.js:133-166` takes `[{ w, start, end }]` (note: `start`/`end`, **not** `t_start`/`t_end` — that is the input contract) and emits `{ words: [{w,t_start,t_end,line}], lines: [{index,text,t_start,t_end}], total_s }` — the shape the Prompter, the karaoke clock and `scoreTake` already consume. It does the line breaking. **Reuse it verbatim from both functions; do not reimplement line breaking.** Using it in both places is also what guarantees the lines don't reflow when the path is replaced mid-session.

### A2. New route `POST /api/script`

```
POST /api/script      { project_id, text }
 200  { path, word_count, est_duration_s }
 400  missing_project_id | missing_text | script_too_short | script_too_long
 404  project_not_found
```

- Auth required. No media, so **no rate limiter and no media semaphore**.
- Validation: `word_count < 3` → `400 script_too_short`; raw length > `MAX_SCRIPT_CHARS` (config, default **1200**) → `400 script_too_long`. That ceiling also bounds the O(n·m) alignment DP.
- Builds the seed path and writes both:
  ```js
  await db.updateProject(projectId, req.userId, { script: text, path: seedPath })
  ```
  via the existing generic `db.updateProject` (`server/src/lib/db.js:98-104`). `projects.script` and `projects.path` are existing columns — **no migration**. `script` is written by transcribe today and read by nothing, so nothing else depends on it.
- Re-posting a script for the same project overwrites both — that is how "Edit text" discards a learned path, which it must, since the timings belonged to different words.
- `est_duration_s` is the seed path's `total_s`. A script whose estimate exceeds 30 s is **not** rejected — the client flags it (B1) and the existing 30-second cap on the real take is the honest gate.
- User-triggerable errors carry a localized `message: { en, he }` alongside `error`, matching the convention at `server/src/routes/transcribe.js:53-58` (read it before deleting that file).

### A3. `/api/evaluate` learns the pace

`server/src/routes/evaluate.js` already has everything needed: it runs Scribe on the take (`:87`), and the project carries `script`. Add one step **after scoring and before responding**:

```js
const scored = scoreTake(take.words, path)          // :90 — UNCHANGED, scores against the path they rehearsed against
// ... then, after scoring:
const relearned = buildPathFromTake(project.script, take.words)
if (project.script && relearned.coverage >= config.MIN_ALIGN_COVERAGE) {
  await db.updateProject(projectId, req.userId, { path: relearned.path })
}
```

- **Order matters.** Score against the old path first — that is the path the user was actually following. Only then replace it. Getting this backwards scores people against a timeline they never saw.
- **Coverage guard.** `MIN_ALIGN_COVERAGE` (config, default **0.5**). If the take wandered far from the script, keep the existing path rather than poisoning it with a bad alignment. **State plainly in STATUS that 0.5 is a first guess with no data behind it**, and log `coverage` on the evaluate event so it can be tuned from real takes.
- Add the new path to the response so the client can rehearse against it immediately: `path: relearned.path` when it was replaced, omitted otherwise.
- A project with no script (there should be none after this change, but be defensive) simply skips the step.
- Everything else in the route — the daily cap, the 30-second `413`, the eval proxy transcode, the model call, `combineResult`, the error paths and their event rows — is **unchanged**.

### A4. Delete

- `server/src/routes/transcribe.js` and its mount in `server/src/app.js`. Nothing replaces it; `/api/evaluate` is now the only route that calls Scribe.
- Its rate limiter entry in `server/src/middleware/rateLimit.js`. **Leave the evaluate and save limiters exactly as they are** (T-10010).

---

## Part B — Client

### B1. `/` — the script screen (rewrite `client/src/app/page.tsx`)

Keep the use-case picker exactly as it is. Replace the record button and the drag-and-drop upload zone with:

- A large `<textarea>`, `dir` from `resolveDir(null, text)` (`client/src/lib/textDir.ts`) so Hebrew right-aligns as it is typed.
- A live estimate beneath it (`~18s`), from a new `client/src/lib/estimate.ts` exporting `SEED_CHARS_PER_SECOND = 13` and `estimateSeconds(text)`. Mirror the server constant and say in a comment that the two must move together. Label it in the UI as an estimate.
- **Over-length flagging — the app flags, the user cuts. It never rewrites their words** (Eli's ruling). When the estimate exceeds `MAX_TAKE_S`, show it in amber with a line like "About 8 seconds over — trim it a little", and dim the tail of the text past the 30-second point so they can see roughly what has to go. **No AI rewrite, no AI suggestions, no auto-trim.** It does **not** block the button — the estimate is approximate and the real take decides.
- A primary "Start rehearsing" button → `createProject(...)` → `saveScript(...)` → store the returned path → `router.push("/karaoke")`.

### B2. `/karaoke` — one line changes

It already reads the path from the store and records video. The only change: when `/results` sends the user back for another take, it must use the **learned** path from the evaluate response, not the seed. That falls out of storing the returned path in `setPathResult` on the wait screen.

`useRecorder` is **not** modified in this task. No audio-only mode, no `getUserMedia` change. The T-10010 fixes (cancellable countdown in `countdownTimerRef`, try/catch around `beginRecording`) stay exactly as they are.

### B3. `/wait` — store the learned path

`client/src/app/wait/page.tsx` already calls `evaluateVideo` and stores the result. When the response carries a `path`, also `setPathResult({ path, fits: true, est_duration_s: path.total_s })` so the next karaoke take uses it.

### B4. `/results` gains "Edit text"

Alongside the existing three buttons (Try again / New video / Share), add **Edit text** → `/` with the script pre-filled. Saving edited text writes a fresh seed path (A2), so the learned pace is correctly discarded along with the words it belonged to. Keep the other three buttons' behaviour and hierarchy unchanged — Try again stays the green primary.

Worth a small line of copy on this screen after the first take, since the behaviour is otherwise invisible: something like "The prompter now follows your pace." Localize EN/HE via `lib/strings.ts`, following the existing `Record<Lang, string>` + `pick()` convention (`strings.ts:37-39`).

### B5. `lib/api.ts`

- Add `saveScript(projectId, text)` → `POST /api/script`, returning `{ path, word_count, est_duration_s }`.
- Add optional `path?: KaraokePath` to `EvalResult`.
- Delete `transcribeVideo` (`:101-115`) and the `TranscribeResult` type.
- Add `script?: string` to the session store so Edit text can pre-fill.

### B6. Delete

- `client/src/app/recorder/page.tsx` and `client/src/app/__tests__/recorder.test.tsx`.
- The home upload path: `probeDuration` (`page.tsx:53-67`), `handleUpload` (`:69-104`), `handleDrop` (`:106-111`), the drop-zone JSX (`:168-193`), and the `HomePage — upload duration precheck (T-1172)` suite (`home.test.tsx:40-134`).
- `client/src/lib/recorderConstraints.ts` **stays** — `/karaoke` still records video and still needs it.

---

## Non-scope — do not do these

- **Do not rebuild the deleted pacing engine.** No anchoring to previous takes, no stretching of inserted runs, no rate smoothing, no comfort bias, no coverage-driven layout switching, no speed slider. The seed is even distribution plus three fixed pauses; the learned path is real timestamps plus proportional interpolation. Nothing more.
- **Do not add any AI rewriting, shortening, or suggesting of the user's script.** The product coaches delivery, never content, and `prompts/eval.md` enforces that. Length is flagged; the user cuts.
- Do not modify `align`, `scoreTake`, `timingScore` or `buildFlags` in `server/src/lib/score.js`, or any scoring behaviour.
- Do not modify `buildSubtitles` or `breakIntoLines`.
- Do not modify `useRecorder`, `Prompter.tsx`, `useKaraokeClock` or `lib/clock.ts`. The Prompter is agnostic to where words came from and must keep working unchanged, including the RTL majority-flip guard.
- Do not touch the eval model call, `lib/evaluate.js`, `prompts/eval.md`, or the results scoring display.
- Do not touch the DB schema or write a migration. `original_words` and `speed` stay dead where they are.
- Do not touch auth, CORS, rate limiter values, the media semaphore, the kill switch or the surge middleware (all T-10010 work).
- Do not re-link `/videos` or revive `POST /api/save`.

---

## Edge cases

- **First take against a badly wrong seed.** A slow speaker on a 13 chars/s seed will lag the prompter throughout. Timing scores low on take 1 and recovers on take 2. That is the designed behaviour, but make sure the take is still *usable* — the karaoke auto-stop is `path.total_s + 3`, so a seed much faster than the speaker cuts them off mid-script. Consider whether the grace period is still right and report what you find; do not silently change it.
- **A word the STT mis-hears** has no anchor and is interpolated. What must not happen is a stall — interpolate proportionally, never leave a run flat.
- **A take that wanders off script** falls under the coverage guard and leaves the path alone. Test at 40%, 60% and 90% coverage.
- **The script estimate exceeds 30 s.** Allowed. The client flags it; the take hits the existing `413 take_too_long`, whose message points at trimming the script.
- **Hebrew.** `segmentWords`, `normalize` and `breakIntoLines` all handle Hebrew, but verify the seed pace is not wildly off for a real Hebrew script — that is the case where a character-based rate is most likely to disappoint. Report the measured seed vs actual duration for one Hebrew script.
- **Duplicate words** ("really really good") — the DP handles it, but verify anchors do not cross and `t_start` stays monotonic.
- **A 3-word script** — legal; must not crash on a single-line path.
- **Refresh mid-session** loses the in-memory store and bounces to `/`, per the existing pattern. Do not add persistence in this task.

---

## Regression risks

- `scoreTake` reads `path.words[].t_start`. A path from either new function must be shape-identical to one from `buildSubtitles`, or evaluation silently scores against garbage. This is the highest-value check in the task.
- Scoring against the wrong path is the subtlest possible bug here: re-time **after** `scoreTake`, never before.
- The karaoke clock early-`break`s on the first word past `elapsed` — non-monotonic timestamps break highlighting with no error.
- Deleting `/api/transcribe` touches `api.ratelimit.test.js`, `api.duration.cap.test.js` and `transcribe.test.js`. The duration-cap tests still matter for `/api/evaluate` — keep that half and do not weaken what it asserts.
- `subtitles.test.js` and `lineChunker.test.js` guard the line breaker that both new functions depend on. They must stay green untouched.

---

## Acceptance criteria

| # | Check | Command / assertion |
|---|---|---|
| 1 | Seed path is monotonic and plausible | Jest: 40-word script → `t_start` non-decreasing, `total_s` within ±20% of `chars/13` |
| 2 | Seed honours punctuation pauses | Jest: word before a full stop is followed by a ≥350 ms gap; before a comma ≥150 ms |
| 3 | Seed shape | Jest: `{words:[{w,t_start,t_end,line}], lines:[{index,text,t_start,t_end}], total_s}` |
| 4 | Perfect take → exact timestamps | Jest: `buildPathFromTake` on a take matching the script → every word's `t_start` equals its spoken `start` |
| 5 | Skipped word interpolated | Jest: 5-word script, take omits word 3 → word 3 lands strictly between words 2 and 4 |
| 6 | Mis-heard word interpolated | Jest: word 2 mis-transcribed → anchored between neighbours, coverage reflects the miss |
| 7 | Monotonic guarantee | Jest: property check over a fuzzed script/take pair → `t_start` never decreases |
| 8 | Leading/trailing unmatched runs | Jest: first two and last two words unmatched → finite, ordered, non-negative times |
| 9 | Coverage maths | Jest: 8 of 10 typed words matched → `coverage === 0.8` |
| 10 | Line grouping stable across seed and learned | Jest: `buildSeedPath(text).lines.map(l=>l.text)` equals `buildPathFromTake(text, cleanTake).path.lines.map(l=>l.text)` |
| 11 | Hebrew end-to-end | Jest: Hebrew script + Hebrew take → coverage > 0.8, monotonic, lines non-empty |
| 12 | `POST /api/script` happy path | Supertest: 200 with a path; `projects.script` and `projects.path` both written |
| 13 | Script validation | Supertest: 2 words → 400 `script_too_short`; 1300 chars → 400 `script_too_long` |
| 14 | Re-posting a script resets the path | Supertest: script → evaluate (path learned) → script again → path is the fresh seed, not the learned one |
| 15 | Evaluate scores against the OLD path | Supertest: seed path in place, take matches the script but not the seed timing → the returned `timing` reflects the seed comparison, not a self-comparison of 100 |
| 16 | Evaluate re-times the path | Supertest: after evaluate, the stored path's `t_start` values equal the take's spoken starts |
| 17 | Low coverage leaves the path alone | Supertest: Scribe mocked to unrelated words → stored path unchanged, response carries no `path` |
| 18 | Evaluate response carries the learned path | Supertest: good take → response includes `path` with the new timings |
| 19 | 30s cap still fires before Scribe on evaluate | Supertest: 45 s take → 413 `take_too_long`, Scribe never called (keep this half of `api.duration.cap.test.js`) |
| 20 | Daily cap and rate limits unchanged | Supertest: 26th evaluate → 429; 31st evaluate from one IP → 429 |
| 21 | Home renders the script screen | Vitest: textarea present, no upload drop zone, no "Record a take" |
| 22 | Estimate and over-length flag | Vitest: ~40 words → estimate shown; ~120 words → amber flag, button still enabled |
| 23 | No AI rewrite anywhere | `grep -ri "rewrite\|shorten" client/src server/src` returns no call sending the script to a model |
| 24 | Script screen navigates to karaoke | Vitest: Start rehearsing → `saveScript` called → path stored → `/karaoke` |
| 25 | Wait stores the learned path | Vitest: evaluate resolves with a `path` → `setPathResult` called with it |
| 26 | Results Edit text | Vitest: Edit text navigates to `/` with the script pre-filled; other three buttons unchanged |
| 27 | Karaoke and Prompter untouched | Vitest: existing `karaoke.test.tsx`, `Prompter.test.tsx`, `useRecorder.test.ts` green with no edits |
| 28 | Server suite green + lint | `cd server && npx jest && npx standard` |
| 29 | Client suite green + build | `cd client && npx vitest run && npm run build && npm run test:layout` |

---

## Manual verification after deploy (add to the STATUS checklist for Eli)

- Type an English pitch, rehearse once: the prompter runs at a generic pace and the timing score reflects that. Rehearse again — the highlight now lands where you actually said each word.
- Same in Hebrew: right-aligned textarea, RTL prompter, and report whether the seed pace felt roughly sane or badly off.
- Deliberately wander off script on one take: the path should not get worse for the next take.
- Paste something far too long: the estimate flags it and the tail is dimmed; rehearse it anyway and the 30-second cap stops you with the trim message.
- Edit the text from results: you get a fresh seed, not a stale learned path.

---

## Wrap-up

- Run `git diff --stat` and review it before committing.
- Commit with `git add -A && git commit -m "T-10018: text-first flow — typed script, seeded pace, path learned from each take"`.
- Push to `origin main`. Resolve your own push blockers — do not stop and hand a terminal command back.
- Record every deviation in `docs/STATUS.md` under Known issues / deviations, with the reason. In particular report: the measured seed-vs-actual duration for one English and one Hebrew script, how the interpolation behaved on a messy take, and whether `MIN_ALIGN_COVERAGE = 0.5` held up.
- **You do not allocate task IDs.** Any follow-up you discover is filed as a slug (e.g. `FU-SEED-PACE-TUNING`) in `docs/TASKS.md`; the PM converts it to a real ID.

REMINDER: Do not forget to commit, push, and update STATUS.md.

# T-1172 — 30-second hard cap + real cost accounting

**Project:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Supersedes:** T-1171 (PITCHMI-COST-ACCOUNTING) — folded in here, do not run separately.
**Priority:** P1
**Type:** one cohesive CC task, one branch.

> **Read `CLAUDE.md`/`AGENTS.md` and `docs/update_status.md` first. After completing all changes, update `docs/STATUS.md` by following `docs/update_status.md`, update `docs/TASKS.md` if task state changes, commit and push the changes.**

---

## 0. Why this is one task, not two

Both halves answer the same question — *what does one pass cost and what stops it running away* — and both land in `server/src/config.js`, `server/src/lib/audio.js`, `server/src/routes/transcribe.js` and `server/src/routes/evaluate.js`. Splitting them would mean two passes over the same four files and a guaranteed merge conflict. The duration probe added for the cap is also the correct billing basis for the cost fix, so the halves share an implementation, not just a file list.

---

## 1. Product decision (verbatim, from Eli)

> "If you can't say it in 30 seconds, you can't say it."

30 seconds is the taught elevator-pitch standard. The cap is **hard**: recording auto-stops at 30.000s. **No grace period. No soft target. No trimming to the last complete word.** The constraint is the product.

Two facts that shape the implementation:

- **The 60s limit today is browser-only.** There is no server-side duration check anywhere. The only server bound is `MAX_UPLOAD_MB: 60` (`server/src/config.js:35`), a byte guard, not a time guard. A hand-rolled `curl` or the drag-and-drop upload path can push a video of any length straight into Scribe. If cost control is the motive for the cap, **the missing server check is the part that actually matters.**
- **~24% of real take-1s already run past 30s.** Prod `events`, `action='transcribe'`, n=17: median 18.3s, avg 19.5s, max 38.8s; four takes over 30s (38.8, 38.7, 36.0, 31.5). So the cap will bite real users on roughly one take in four, and it must fail loudly rather than silently.

**Why silent truncation is the one unacceptable outcome:** take 1 *defines the script*. `/api/transcribe` builds the karaoke subtitle path from take 1's Scribe word timestamps and persists it to `projects.path`. Every subsequent rehearsal is scored against that path. A take cut off mid-sentence produces a severed script that poisons every rehearsal after it, and the user has no way to tell why their timing score is wrong. So the hard stop must be **announced**, with an explicit choice, before the take is transcribed.

---

## 2. Context from code inspection

Verified on `main` @ `c1f7ee2`. Line numbers are as-read; re-verify before editing.

### Where the 60s cap currently lives (client only)

| File | Line | Current |
|---|---|---|
| `client/src/app/recorder/page.tsx` | 13 | `const MAX_S = 60` |
| `client/src/hooks/useRecorder.ts` | 41 | `maxDurationS = 60,` |
| `client/src/app/page.tsx` | 152 | `<span …>≤ 60 seconds · webm / mp4 / mov</span>` |
| `client/src/app/karaoke/page.tsx` | 29 | `maxDurationS: (path?.total_s ?? 60) + gracePeriod,` |

`useRecorder` already auto-stops via `autoStopTimerRef` at `(maxDurationS + graceAfterS) * 1000` (`useRecorder.ts:144-151`) with `graceAfterS = 0` by default — **so the hard-stop mechanism already exists**; what is missing is the *number*, a *server* equivalent, and any signal to the caller that the stop was involuntary.

`karaoke/page.tsx:29` derives its limit from take 1's real length (`path.total_s`) plus a deliberate 3s `gracePeriod`. **That grace is correct and stays** — it exists so a rehearsal can finish the last subtitle word, and it is bounded by take 1, which this task caps. Only the `?? 60` fallback changes.

### The recording countdown that already exists

`recorder/page.tsx:94-115` renders an SVG ring timer at `top-4 right-4`: r=44, `strokeDashoffset` driven by `pct`, numeric `Math.ceil(remaining)` in the centre, stroke flipping to `#ef4444` when `remaining < 10`. It works. At a 60s cap, "red for the last 10 seconds" is the final sixth of the take; at 30s the same threshold is the final **third**, which reads as permanent alarm. The thresholds need rescaling, not a new component.

### Cost accounting as it stands

`server/src/config.js:36`
```js
SCRIBE_USD_PER_MIN: num(process.env.SCRIBE_USD_PER_MIN, 0.007),
```
`0.007/min` = **$0.42/hr**. ElevenLabs Scribe currently bills ~**$0.004/min ($0.24/hr)**. Scribe is over-stated ~75%.

`server/src/routes/transcribe.js:64` and `server/src/routes/evaluate.js:105`, identical line in both:
```js
const costUsd = (take.duration_s / 60) * config.SCRIBE_USD_PER_MIN
```

Three problems, and **one non-problem that an earlier note got wrong**:

1. **The rate is wrong** (above).
2. **The Gemini/eval spend is never logged at all.** `cost_usd` on an `evaluate` row is computed from the Scribe rate only. The upstream model call — roughly 45% of a pass — is invisible to the admin dashboard. `server/src/lib/evaluate.js` discards the provider response's `usage` object entirely (`callOpenRouter` returns only `{ content, upstream }`, `evaluate.js:174-179`).
3. **The billing basis is the wrong number.** `take.duration_s` comes from `lib/scribe.js` and is *the end timestamp of the last recognised word*, not the audio length. A take with three seconds of trailing silence is billed short. Vendors bill submitted audio duration.
4. **NOT a bug — correcting an earlier claim:** an earlier note asserted `cost_usd` was double-counted because it is written on both the `transcribe` and the `evaluate` row. That is wrong. `routes/transcribe.js:32` transcribes **take 1**; `routes/evaluate.js:56` transcribes **the new rehearsal take**. Two separate videos, two separate billable Scribe calls. Summing them in `routes/admin.js:80` is correct. **Do not "fix" this. Do not add a migration to split the column.** The right semantic — which this task documents in code — is: *`cost_usd` on a row is the USD incurred by that one request.* Once the eval spend is added, the naive daily sum in `rollup()` becomes correct.

### The ffmpeg probe gotcha (read this before implementing)

The obvious implementation of a server-side duration check — `ffmpeg -i <upload>` and parse the `Duration:` header — **fails on the primary recording path**. Chrome's `MediaRecorder` emits a streaming WebM whose header carries no duration; ffmpeg reports `Duration: N/A`. Do not build on it.

Use this instead: `extractAudio()` (`server/src/lib/audio.js:14`) already runs a **full decode** of the upload before Scribe on both routes. ffmpeg prints running `time=HH:MM:SS.mss` progress lines to stderr, and `runFfmpeg` already accumulates stderr (`audio.js:65`). **The last `time=` value in that stderr is the true media duration, obtained at zero extra cost.** No new ffmpeg invocation, no new dependency, no `ffprobe-static` (which would add ~30MB to the image for nothing).

---

## 3. Scope A — the 30-second hard cap

### A1. Client constants

- `client/src/app/recorder/page.tsx:13` — `MAX_S` `60` → `30`.
- `client/src/hooks/useRecorder.ts:41` — default `maxDurationS` `60` → `30`.
- `client/src/app/page.tsx:152` — copy `≤ 60 seconds` → `≤ 30 seconds`. Hebrew equivalent if that string has a translated sibling; if the home screen is English-only today, leave it English-only (do not introduce i18n here).
- `client/src/app/karaoke/page.tsx:29` — fallback `?? 60` → `?? 30`. **Leave `gracePeriod = 3` and the `+ gracePeriod` alone** (see §2).

Define the number **once** and import it — a bare `30` in four files is how the current 60 got out of sync with reality. Put `export const MAX_TAKE_S = 30` in a shared client module (`client/src/lib/limits.ts` or the existing constants module if one exists — check before creating) and import it in all four sites.

### A2. Countdown, rescaled for 30s

Keep the existing SVG ring in `recorder/page.tsx:94-115`. Change only the urgency thresholds and add a final-seconds cue:

- stroke `#ffffff` while `remaining > 10`
- stroke `#f59e0b` (amber) when `remaining <= 10`
- stroke `#ef4444` (red) when `remaining <= 5`
- when `remaining <= 3`, add a subtle scale pulse on the ring group (CSS transform, ~1s cycle). **Do not use `animate-ping`** — it is already used full-screen for the 3-2-1 pre-roll countdown (`recorder/page.tsx:88`) and reusing it here reads as a second start cue.

The numeric readout stays `Math.ceil(remaining)`. Do not move, resize, or restyle the ring beyond the above — its position is safe-area-tested.

### A3. Announce the involuntary stop (this is the part that protects the script)

`useRecorder` currently gives the caller no way to distinguish "user tapped Stop" from "the timer fired".

- Add `stopReason: "user" | "limit" | null` to `UseRecorderReturn`, held in state.
- `stop()` (the exported callback, `useRecorder.ts:67`) sets `"user"`.
- The `autoStopTimerRef` callback (`useRecorder.ts:144-151`) sets `"limit"`.
- Reset to `null` in `start()`.
- Pass the reason to `onStop`: `onStop?.(blob, reason)`. Update the `UseRecorderOptions.onStop` type. Both existing call sites (`recorder/page.tsx:23`, `karaoke/page.tsx:30`) must keep compiling; **karaoke ignores the reason** — a rehearsal hitting its ceiling is expected and harmless, it does not define the script.

In `recorder/page.tsx`, when `reason === "limit"`, **do not transcribe immediately.** Render a blocking interstitial over the stopped preview:

> **Time's up — 30 seconds.**
> If your pitch got cut off, record it again. Your subtitles are built from this take, so a half-finished take means a half-finished script.
>
> `[ Record again ]` (primary) · `[ Use this take ]` (secondary)

`Record again` → reset and `start()`. `Use this take` → the existing transcribe path. When `reason === "user"` the flow is unchanged: straight to transcribe, no interstitial.

**PM note for Eli, flag it in the CC summary:** this interstitial is a judgment call layered on top of "hard stop, no grace". It does not extend recording by a millisecond — it just refuses to silently ship a severed script into `projects.path`. If Eli would rather it go straight through, deleting the interstitial is a two-line revert and the rest of the task is unaffected.

### A4. Upload path precheck (`client/src/app/page.tsx`)

`handleUpload` (`page.tsx:49`) validates `file.type.startsWith("video/")` and nothing else — **a two-hour video currently goes straight to `/api/transcribe`.** Add a duration precheck before `createProject`:

- Load the file into a detached `<video>` via `URL.createObjectURL`, await `loadedmetadata`, read `video.duration`, always `URL.revokeObjectURL` in a `finally`.
- `duration > MAX_TAKE_S` → set the existing `error` state to "Videos must be 30 seconds or shorter." and return, **before** the project is created and before any upload happens.
- `duration` is `NaN`/`Infinity`/unreadable → **fail open**, proceed to upload. The server check (A5) is the real gate; a metadata quirk in one browser must not block a legitimate user.

### A5. Server-side duration cap (the enforcement that does not exist today)

**`server/src/config.js`** — add:
```js
MAX_TAKE_S: int(process.env.MAX_TAKE_S, 30),
TAKE_TOLERANCE_S: num(process.env.TAKE_TOLERANCE_S, 3),
```
The tolerance is not slop for the user — it absorbs container rounding and `MediaRecorder`'s imprecise stop, which routinely lands a "30s" take at 30.4s. **Reject only above `MAX_TAKE_S + TAKE_TOLERANCE_S` (33s).** Do not reject at exactly 30.

**`server/src/lib/audio.js`** —
- Change `runFfmpeg` to resolve with the accumulated `stderr` string (it currently resolves with nothing; stderr is already captured at line 65). Keep the reject-on-nonzero behaviour exactly as-is.
- Add `parseFfmpegDuration(stderr)`: return the **last** `time=(\d+):(\d+):(\d+\.\d+)` match as seconds, or `null` if absent.
- `extractAudio` now returns `{ buffer, mime, ext, duration_s }` where `duration_s` is the parsed value or `null`. `transcodeForEval`'s signature is unchanged.

**`server/src/routes/transcribe.js`** and **`server/src/routes/evaluate.js`** — after `extractAudio`, before `transcribe(...)`:
- `audio.duration_s !== null && audio.duration_s > config.MAX_TAKE_S + config.TAKE_TOLERANCE_S` → log an event row (`action: 'error'`, `error: 'take_too_long'`, `duration_s: audio.duration_s`) and return **413**:
  ```js
  { error: 'take_too_long', limit_s: config.MAX_TAKE_S,
    message: { en: 'Takes must be 30 seconds or shorter.',
               he: 'ההקלטה חייבת להיות עד 30 שניות.' } }
  ```
  Match the EN/HE message shape already used for `take_too_large` (`evaluate.js:79-85`).
- `audio.duration_s === null` → **fail open**, carry on. A parse regression must degrade to today's behaviour, never to a hard block.
- **Scribe must not be called on a rejected take.** That is the entire point — the check pays one already-necessary ffmpeg decode to avoid a billable STT call.

**Client** must map `413 take_too_long` to a readable message wherever `413 take_too_large` is already handled (find it in `client/src/lib/api.ts` and the error surfaces in `recorder/page.tsx` / `page.tsx`).

---

## 4. Scope B — real cost accounting (absorbs T-1171)

### B1. Fix the Scribe rate and its basis

- `server/src/config.js:36` — `SCRIBE_USD_PER_MIN` default `0.007` → `0.004`. Add a comment: *ElevenLabs Scribe list ~$0.24/hr as of 2026-08; override with `SCRIBE_USD_PER_MIN` when the contract changes.*
- Both routes: compute STT cost from `audio.duration_s` (real media duration) when available, falling back to `take.duration_s` when the probe returned `null`. Log the basis used so a future reader can tell which number produced the figure.

### B2. Capture what the model actually cost

**`server/src/lib/evaluate.js`, `callOpenRouter` (line ~124):** add usage accounting to the request body alongside the existing `model` / `temperature` / `response_format` / `provider` keys:
```js
usage: { include: true }
```
OpenRouter then returns a `usage` object on the response carrying `prompt_tokens`, `completion_tokens`, `total_tokens` and — the value we want — **`cost`, the real USD OpenRouter billed for that call**, already correct for the model's per-modality rates. Do not re-derive cost from token counts and a hardcoded price table; that table would rot the moment OpenRouter repriced, and it is exactly the class of error this task exists to fix.

- `callOpenRouter` returns `{ content, upstream, usage }` (`usage` = `data.usage ?? null`).
- `callGemini` returns `{ content, upstream, usage }` where `usage` is derived from `data.usageMetadata` (`promptTokenCount`, `candidatesTokenCount`) with **`cost: null`** — the direct Gemini API does not report spend, and inventing one would be a lie. Gemini-direct is a fallback path (`EVAL_PROVIDER=gemini`), not the default.
- `evaluateVideo` threads `usage` onto its return value next to the existing `attempts` / `upstream` (`evaluate.js:256-258`). **On a JSON-parse retry, accumulate: every upstream attempt was billed, so sum `cost` and the token counts across attempts rather than keeping only the last.** A take that needed three attempts really did cost three calls, and hiding that would defeat the task.

### B3. Log the split

**`server/src/routes/evaluate.js`** — replace line 105:
```js
const sttCostUsd  = (billableS / 60) * config.SCRIBE_USD_PER_MIN
const evalCostUsd = delivery.usage?.cost ?? null
const costUsd     = sttCostUsd + (evalCostUsd ?? 0)
```
Keep `cost_usd` as the row total and add the breakdown to the existing `scores` jsonb (no migration — `scores` is already a free-form jsonb and the privacy rule permits numeric metadata only, which this is):
```js
scores: {
  ...combined.dimensions,
  overall: combined.overall,
  timings: { /* unchanged */ },
  cost: {
    stt_usd: sttCostUsd,
    eval_usd: evalCostUsd,              // null on gemini-direct
    media_duration_s: audio.duration_s, // null if the probe failed
    eval_prompt_tokens: …, eval_completion_tokens: …
  }
}
```
**`server/src/routes/transcribe.js`** — same STT basis fix; `cost_usd` stays STT-only, which is the whole cost of that request. Add a one-line comment stating the invariant: *`cost_usd` is the USD incurred by this request; rows are summed, never deduplicated.*

### B4. Surface it in admin

`server/src/routes/admin.js`, `rollup()` (line 67): keep `total_cost_usd` summing `r.cost_usd` unchanged, and add `total_stt_usd` / `total_eval_usd` accumulated from `r.scores?.cost` where present. Rows predating this change have no `scores.cost` — they must contribute `0` to the split lines and still contribute to `total_cost_usd`, so historical days render without `NaN`. Add the two columns to the admin dashboard table.

---

## 5. Non-scope — do not do these

- **Do not add a `media_resolution` parameter anywhere.** There is no saving there. On Gemini 3.x, `media_resolution_low` and `media_resolution_medium` are *identical* for video at 70 tokens/frame, and that is already the unspecified default; only `high` (280) differs, and it costs **more**. An earlier recommendation to set `low` for a ~35% cut was wrong and is retracted.
- **Do not swap the STT provider.** Groq `whisper-large-v3-turbo` at ~$0.036/hr against Scribe's $0.24/hr is the single biggest remaining lever, but it requires a Hebrew word-timestamp quality A/B first. Separate task.
- **Do not add a DB migration.** No new columns. `scores` jsonb carries the breakdown.
- **Do not deduplicate `cost_usd` across `transcribe` and `evaluate` rows** — see §2.4.
- **Do not change `MAX_UPLOAD_MB`.** 60MB is a byte guard against pathological uploads and is orthogonal to duration; lowering it risks rejecting legitimate high-bitrate iOS takes.
- **Do not change `DAILY_EVAL_LIMIT`.** The 30s cap already cuts the per-user daily ceiling from ~$0.17 to ~$0.09; retuning the count is a separate product call.
- **Do not touch** `gracePeriod`/`+ gracePeriod` in `karaoke/page.tsx`, the eval prompt (`server/src/prompts/eval.md`), `lib/score.js`, `lib/subtitles.js`, `lib/fillers.js`, the RTL `Prompter`, auth/JWKS, the provider pin (`provider: { only: ['google-vertex'], allow_fallbacks: false }`), or the T-1165/T-1166 deadline and proxy logic.

---

## 6. Edge cases

- Take lands at 30.4s from `MediaRecorder` imprecision → accepted (inside the 3s tolerance). Take at 45s via `curl` → 413.
- `extractAudio` stderr has no `time=` line (very short or silent clip) → `duration_s: null` → cap fails open, cost falls back to `take.duration_s`.
- Silent take → the existing `422 no_speech` path (`transcribe.js:45-56`) must still fire, and must still fire **after** the duration check, not before.
- User taps Stop at 29.9s → `stopReason: "user"`, no interstitial.
- Timer fires while the user's finger is already on Stop → whichever sets `stopReason` first wins; guard `recorderRef.current?.state === "recording"` as the existing code already does, and do not let the second path overwrite the reason.
- OpenRouter returns 200 with no `usage` key → `eval_usd: null`, `cost_usd` = STT only. Must not throw.
- Eval succeeded on attempt 3 → `eval_usd` is the **sum** of all three billed calls.
- `EVAL_PROVIDER=gemini` → `eval_usd: null`, token counts still logged.
- Admin dashboard over a date range spanning the deploy → old rows show `total_eval_usd: 0`, new rows show real values. Acceptable and expected; note it in STATUS.

---

## 7. Regression risks to check explicitly

- `useRecorder`'s `onStop` signature change touches **both** consumers. Karaoke must be verified end-to-end, not just type-checked.
- `extractAudio`'s return shape changed — grep every caller (`routes/transcribe.js`, `routes/evaluate.js`, `tests/*`) before assuming two.
- `runFfmpeg` now resolves a value; `transcodeForEval` awaits it and ignores the value. Confirm the reject-on-nonzero path is untouched, or T-1166's `take_too_large` guard silently stops working.
- Adding `usage: { include: true }` to the OpenRouter body must not disturb the Vertex provider pin. If the request 400s with usage accounting on the pinned provider, **drop the flag and fall back to token-count logging with `cost: null`** — the pin is load-bearing (T-1162) and must not be traded away for a cost number.
- The duration check sits between `extractAudio` and `transcribe` on **both** routes. On `/api/evaluate` it must sit *after* the `DAILY_EVAL_LIMIT` check so quota semantics don't change.

---

## 8. Acceptance criteria

1. Recording auto-stops at 30.0s. No grace. No trimming.
2. The ring countdown reads white → amber ≤10s → red ≤5s → pulse ≤3s, and shows the correct integer seconds remaining throughout.
3. A take stopped by the timer shows the "Time's up" interstitial with Record again / Use this take, and does **not** transcribe until the user chooses.
4. A take stopped by the user transcribes immediately, exactly as today.
5. Uploading a >30s file is rejected client-side before any project is created or any byte is uploaded.
6. `POST /api/transcribe` and `POST /api/evaluate` return `413 take_too_long` for media over 33s, **without calling Scribe**, and log an event row.
7. A 30s take and a 32s take both still succeed.
8. `SCRIBE_USD_PER_MIN` defaults to `0.004` and STT cost is computed from real media duration when available.
9. An `evaluate` event row carries `cost_usd` = STT + eval, and `scores.cost` with `stt_usd`, `eval_usd`, `media_duration_s` and token counts.
10. The admin dashboard shows `total_stt_usd` and `total_eval_usd` alongside `total_cost_usd`, and renders historical (pre-change) days without `NaN`.
11. `npm test` + `npm run lint` green in `server/`; vitest + `npm run build` + `npm run test:layout` green in `client/`.

## 9. Tests

**Server (Jest, `server/tests/`)**
- `audio.duration.test.js` — `parseFfmpegDuration` returns the last `time=` value; returns `null` on stderr with no match; `extractAudio` on the existing sample fixture (`scripts/make-sample.js`) returns a `duration_s` within ±0.2s of the known length.
- `api.duration.cap.test.js` — over-limit upload → 413 `take_too_long` on **both** routes, Scribe mock **not** called, event row written; 32s upload → passes; `duration_s: null` → passes (fail-open).
- `cost.test.js` — STT cost uses probed duration at the configured rate; `evaluate` row `cost_usd` = stt + eval with a mocked OpenRouter `usage.cost`; missing `usage` → `eval_usd: null` and no throw; multi-attempt parse-retry sums the cost across attempts.
- Extend `api.admin.test.js` — split totals; rows without `scores.cost` contribute 0 and do not produce `NaN`.
- Existing `api.evaluate.test.js`, `api.evaluate.proxy.test.js`, `api.evaluate.errors.test.js`, `transcribe.test.js` must stay green — update fixtures for the new `extractAudio` shape, do not weaken assertions.

**Client (vitest)**
- `useRecorder` reports `stopReason: "limit"` on timer fire and `"user"` on manual stop, and passes it to `onStop`.
- Recorder page renders the interstitial on `"limit"` and not on `"user"`.
- Upload precheck rejects a >30s duration and fails open on `NaN`.
- Existing karaoke tests green with the new `onStop` arity.

## 10. Before commit

Run `git diff --stat` and review it. Expect roughly: 4 client files + 1 new client constants module, 5 server files, ~4 test files. Anything outside that list is scope creep — check it before committing.

```
git add -A && git commit -m "30s hard cap (client + server enforcement) + real cost accounting (T-1172, absorbs T-1171)"
```
Then push.

Finally: update `docs/STATUS.md` per `docs/update_status.md` (prepend a dated `T-1172` bullet; note under *Known issues* that pre-change event rows have no `scores.cost` and report `total_eval_usd: 0`), and update `docs/TASKS.md` — mark T-1172 done and mark T-1171 superseded-by-T-1172.

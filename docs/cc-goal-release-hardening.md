# T-10010 — PitchMi public-release hardening

Read `CLAUDE.md` and `docs/update_status.md` first. After completing all changes, update `docs/STATUS.md` by following `docs/update_status.md`, update `docs/TASKS.md` if task state changes, commit and push the changes.

**Task ID:** T-10010
**Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Time budget:** this is a server-heavy task with a small client slice. Expect ~60–90 minutes. If it is taking materially longer, stop and report what is done and what is left.

## Why this exists

PitchMi ships publicly with no ads and no signup. A PM code audit of `server/` and `client/` found ten defects that gate release: one lets an anonymous internet user take over the admin panel, three are unmetered-cost or denial-of-service vectors, two are upstream-hang vectors, and two are client dead-ends real users will hit on day one. Every item below was read in the actual code — file and line references are accurate as of `main`.

Everything in scope is a hardening change. **No product behaviour changes, no UI redesign, no new screens.**

## Stack facts you need

- `server/` — Node 22, Express 4.22, **JavaScript ES6, StandardJS (no semicolons, single quotes, 2-space indent)**. Tests: Jest + Supertest, currently 75 green. `npx standard` must stay clean.
- `client/` — Next.js 15 App Router, React 19, TypeScript strict. Tests: Vitest + Testing Library (63 green) + a Playwright layout proof (`npm run test:layout`, 2 green). `npm run build` must exit 0.
- Auth: Supabase anonymous sign-in. Server verifies user JWTs against the project JWKS (ES256, `jose` v5 `createRemoteJWKSet`) with an HS256 + `SUPABASE_JWT_SECRET` fallback — see `server/src/middleware/auth.js`.
- Deploy: Railway, two services (root `client/`, root `server/`). Server start is `server/Procfile` → `web: npm start`.
- Media: `ffmpeg-static` npm binary, invoked via `spawn` in `server/src/lib/audio.js`.

Existing server style, for reference (`server/src/middleware/killSwitch.js` shape):

```js
'use strict'

const db = require('../lib/db')

module.exports = async function killSwitch (req, res, next) {
  ...
}
```

## Scope — the ten items

### 1. Admin cookie secret is a hardcoded constant (CRITICAL)

`server/src/config.js:52`:

```js
config.COOKIE_SECRET = config.SUPABASE_JWT_SECRET || 'pitchmi-dev-cookie-secret'
```

The admin gate is only `req.signedCookies.admin === '1'` (`server/src/middleware/admin.js:7`). The production Supabase project issues ES256/JWKS tokens, so `SUPABASE_JWT_SECRET` is very likely unset on Railway — making the cookie signing key a constant published in this repo. Anyone can compute `cookie-parser`'s HMAC for `admin=1` and get `/api/admin/logs` plus `POST /api/admin/service` (which can disable the whole product).

**Build:** introduce a dedicated `ADMIN_COOKIE_SECRET` env var. `config.COOKIE_SECRET = process.env.ADMIN_COOKIE_SECRET || ''`. Remove the `SUPABASE_JWT_SECRET` reuse and the literal fallback entirely. Add a startup validation in `server/src/index.js` that **throws and exits non-zero** when `ADMIN_COOKIE_SECRET` or `ADMIN_PASSWORD` is empty, unless `NODE_ENV === 'test'` (tests set their own values). Add both vars to `server/.env.example` with empty values and a one-line comment.

### 2. Paid endpoints are unmetered; the eval quota is bypassable (CRITICAL)

`server/src/routes/evaluate.js` counts today's `events` rows per `req.userId` against `DAILY_EVAL_LIMIT`. Anonymous Supabase identities are free and unlimited, so a script mints a fresh `sub` per request and the cap is meaningless. `POST /api/transcribe` (a billable ElevenLabs Scribe call plus two ffmpeg decodes) and `POST /api/save` (up to 60 MB into Storage, permanently) have **no quota at all**. There is no IP rate limiting anywhere in `server/src/app.js`.

**Build:** add `express-rate-limit` (latest 7.x) as a server dependency. Trust the Railway proxy — set `app.set('trust proxy', 1)` in `createApp` so the limiter keys on the real client IP, not the proxy's.

Apply per-IP limiters:

| Route | Window | Max | Response |
|---|---|---|---|
| `POST /api/admin/login` | 15 min | 10 | 429 `{ error: 'too_many_attempts' }` |
| `POST /api/transcribe` | 1 hour | 30 | 429 `{ error: 'rate_limited' }` |
| `POST /api/evaluate` | 1 hour | 30 | 429 `{ error: 'rate_limited' }` |
| `POST /api/save` | 1 hour | 20 | 429 `{ error: 'rate_limited' }` |

Make the three feature limits configurable via env (`RATE_LIMIT_TRANSCRIBE_PER_HOUR`, `RATE_LIMIT_EVAL_PER_HOUR`, `RATE_LIMIT_SAVE_PER_HOUR`) with the table values as defaults, through the existing `int()` helper in `config.js`. Keep the existing per-user `DAILY_EVAL_LIMIT` check as-is — the IP limiter is an additional layer, not a replacement.

Log a metadata-only `rate_limited` event row (action, route, no IP, no content) via `db.logEvent` when a limiter trips, so the admin log shows abuse.

### 3. ffmpeg reads attacker-chosen protocols and demuxers (HIGH)

`server/src/lib/audio.js:28` and `:51-58` run `-i <uploaded file>` with no `-f` and no `-protocol_whitelist`. `extForMime` (`:97-102`) only chooses a filename suffix; ffmpeg sniffs the real container. There is no mime validation at all — `server/src/middleware/upload.js:9-12` has no `fileFilter`. A crafted upload declared `video/webm` but containing an HLS/concat playlist makes ffmpeg follow `file://` and `http://` references, and the read content can come back to the attacker through the transcript that `/api/transcribe` returns.

**Build:**
- Add a multer `fileFilter` in `server/src/middleware/upload.js` accepting only `video/webm`, `video/mp4`, `video/quicktime` (and `video/x-matroska`, which some Chrome builds emit). Reject anything else with a 415-mapped error.
- Add `-protocol_whitelist`, `'file'` and `-f`, `<matroska,webm | mp4>` (chosen from the already-computed `inputExt`) to the arg arrays in **both** `extractAudio` and `transcodeForEval`, before `-i`.

### 4. 60 MB in-memory uploads with no concurrency bound (HIGH)

`server/src/middleware/upload.js:10` uses `multer.memoryStorage()` with a 60 MB per-file cap and no concurrency limit. Each `/api/evaluate` spawns two ffmpeg processes, one an `libx264` encode, then base64-encodes the proxy into a data URL. A handful of simultaneous uploads OOM-kills a small Railway container.

**Build:** add a small in-process semaphore module (`server/src/lib/jobLimiter.js`) capping concurrent media jobs (the ffmpeg-touching sections of transcribe and evaluate) at `MEDIA_CONCURRENCY` (config, default 2). Requests beyond the cap **queue** with a bounded wait; if the queue is longer than `MEDIA_QUEUE_MAX` (config, default 8) respond `503 { error: 'busy' }` immediately rather than piling up. Keep `memoryStorage` — switching to disk storage is out of scope for this task.

### 5. ffmpeg has no timeout and an open stdin (HIGH)

`server/src/lib/audio.js:69-81` resolves only on `close`. There is no kill timer, and stdin is an open pipe that is never ended, so ffmpeg can block reading interactive input on a malformed container. The `finally` cleanup at `:31-34` / `:61-64` then never runs, so temp files leak too.

**Build:** in `runFfmpeg`, add `-nostdin` to the front of every arg array (or pass `stdio: ['ignore', 'pipe', 'pipe']`), and a `setTimeout` that `proc.kill('SIGKILL')` and rejects with `new Error('ffmpeg_timeout')` after `FFMPEG_TIMEOUT_MS` (config, default 60000). Clear the timer on both `close` and `error`.

### 6. Scribe response body is read outside its abort timer (HIGH)

`server/src/lib/scribe.js:34-41` — the `finally { clearTimeout(timer) }` runs before `await res.json()` on line 41. An upstream that sends headers then stalls the body hangs the transcribe handler forever, holding a 60 MB buffer and its temp files. This is exactly the defect T-1166 fixed for the eval path in `fetchWithTimeout` (`server/src/lib/evaluate.js`); it was never applied to Scribe.

**Build:** move the `clearTimeout` so the timer also covers `res.text()` / `res.json()` — i.e. read the body under the same signal, then clear. Simplest correct shape: keep one `try { ... }` covering fetch *and* body read, with `clearTimeout` in its `finally`.

### 7. Admin login is brute-forceable (HIGH)

`server/src/routes/admin.js:16` — `password !== config.ADMIN_PASSWORD` short-circuits (timing-observable), the router is mounted **before** the kill switch and surge gates (`server/src/app.js:38-42`) so it is exempt from every existing throttle, and no `admin_login` event is written despite the schema reserving that action.

**Build:** compare with `crypto.timingSafeEqual` over SHA-256 digests of both strings (equal-length buffers, so no length leak). Apply the login rate limiter from item 2. Write a metadata-only `admin_login` event on both success and failure (`{ action: 'admin_login', scores: { ok: true|false } }` — no password, no IP).

### 8. Admin cookie flags break in production (HIGH)

`server/src/routes/admin.js:19-25` sets `sameSite: 'lax'` and `secure: process.env.NODE_ENV === 'production'`. The client calls a **different Railway origin** with `credentials: "include"`, so a Lax cookie is never attached to those cross-site requests — admin login returns 200 and every subsequent `/api/admin/*` call 401s. And because a surge trip persists the kill switch to the DB, a tripped service becomes un-pausable from the UI.

**Build:** set `sameSite: 'none'` and `secure: true` unconditionally. Do not key `secure` off `NODE_ENV` — Railway does not set it for a plain `node` start. Keep `httpOnly` and `signed`.

### 9. CORS reflects any origin with credentials (HIGH)

`server/src/app.js:25-28` — `origins` becomes `true` (reflect-any) when `CLIENT_ORIGIN` is unset, combined with `credentials: true`. Combined with item 8's `sameSite: 'none'`, a missing env var becomes a one-request admin read from any website.

**Build:** fail closed. When `CLIENT_ORIGIN` is empty, pass `origin: false` (no cross-origin credentials at all) and log a startup warning. Add `CLIENT_ORIGIN` to the item-1 startup validation as a **warning**, not a throw, so local dev still boots.

### 10. Client dead-ends: karaoke error state and uncancellable countdown (HIGH)

**(a)** `client/src/app/karaoke/page.tsx:29` destructures `{ state, countdown, videoRef, start, stop }` from `useRecorder` — it never reads `error` and renders nothing for `state === "error"`. If the user denies camera on the rehearsal take, or the device is still busy after take 1, `useRecorder` sets the error state (`client/src/hooks/useRecorder.ts:105-109`) and the screen is a black `fixed inset-0` div with no message and no way out except editing the URL.

**Build:** mirror the recorder's existing error block (`client/src/app/recorder/page.tsx:190-199`) in karaoke — same strings, same localization, and a way back to home.

**(b)** `client/src/hooks/useRecorder.ts:126,131` chains bare `setTimeout(tick, 1000)` calls whose handles are never stored, so `cleanup()` (`:68-73`, which stops all tracks) cannot cancel them. Navigating away during the 3-2-1 countdown still fires `beginRecording(stream)` on stopped tracks; `new MediaRecorder(...)` throws inside a timer with no try/catch. On a browser without `MediaRecorder` support the screen freezes on "0" forever.

**Build:** store the countdown handle in a ref (mirror the existing `autoStopTimerRef` pattern at `:62`), clear it in `cleanup`, and wrap `beginRecording` in a try/catch that sets the error state instead of throwing.

## Non-scope — do not do these

- Do **not** change the surge middleware's global-trip design, move its counter to the DB, or change the kill switch's fail-open behaviour. Both are known and deliberately deferred.
- Do **not** add `helmet`, change the error handler's `message` field, add `aud`/`iss`/`role` claim checks to JWT verification, or fix the attacker-controlled `contentType` in `save.js`. All are real findings, all are week-one work, none gate release.
- Do **not** switch multer to disk storage.
- Do **not** touch the eval prompt, `lib/score.js`, `lib/subtitles.js`, `lib/path.js`, the provider routing pin (`google-vertex`, `allow_fallbacks:false`), or any scoring behaviour.
- Do **not** touch the DB schema or write a migration.
- Do **not** redesign any screen, change copy beyond the karaoke error block, or re-link the `/videos` screen.
- Do **not** delete the HS256 fallback in `middleware/auth.js`.

## Files you will touch

`server/src/config.js`, `server/src/index.js`, `server/src/app.js`, `server/src/routes/admin.js`, `server/src/middleware/upload.js`, `server/src/middleware/admin.js` (only if needed), `server/src/lib/audio.js`, `server/src/lib/scribe.js`, `server/src/routes/transcribe.js`, `server/src/routes/evaluate.js`, `server/src/routes/save.js`, new `server/src/lib/jobLimiter.js`, `server/.env.example`, `server/package.json`; `client/src/app/karaoke/page.tsx`, `client/src/hooks/useRecorder.ts`.

## Edge cases

- The startup validation must not break the Jest suite — tests must still boot the app. Gate the throw on `NODE_ENV !== 'test'` and make sure `server/tests/` sets whatever it needs.
- `express-rate-limit` without `trust proxy` set correctly on Railway will either key every request to the proxy IP (limiting all users as one) or throw its validation error. Verify the limiter sees distinct IPs, and if the Railway hop count differs, set `trust proxy` to the value that works rather than disabling the validation.
- The `fileFilter` rejection must produce a clean 415, not an unhandled multer error — map it in the existing `errorHandler` in `app.js` alongside `LIMIT_FILE_SIZE`.
- `-f matroska,webm` is the correct demuxer name for a Chrome MediaRecorder webm; `-f mp4` for iOS Safari. Choose from `inputExt`, and if the chosen demuxer rejects a real fixture, report it rather than silently dropping the flag.
- The semaphore must release on **every** exit path including throws, or one failed transcode permanently consumes a slot.
- `crypto.timingSafeEqual` throws on unequal buffer lengths — hash both sides first so lengths always match.

## Regression risks

- The existing 75 Jest tests exercise transcribe/evaluate/save end-to-end with mocked upstreams. The semaphore and the new limiters sit directly in those paths — if a test hangs, the semaphore is not releasing.
- `sameSite: 'none'` + `secure: true` means the admin cookie will not work over plain `http://localhost`. That is expected; note it in STATUS so local admin testing uses the deployed origin or a tunnel.
- Adding `-f` to the ffmpeg args can break the existing sample fixture if its container does not match the declared mime. Run the real fixture through both `extractAudio` and `transcodeForEval`.
- Client: `useRecorder` is shared by `/recorder` and `/karaoke`. The countdown-ref change affects both — the existing recorder tests must stay green.

## Acceptance criteria

| # | Check | Command / assertion |
|---|---|---|
| 1 | Server boots with all required vars | `ADMIN_COOKIE_SECRET=x ADMIN_PASSWORD=y node src/index.js` starts |
| 2 | Server refuses to boot without them | same command with `ADMIN_COOKIE_SECRET` unset exits non-zero with a clear message |
| 3 | No literal cookie secret remains | `grep -r "pitchmi-dev-cookie-secret" server/src` returns nothing |
| 4 | Admin cookie forged with the old constant is rejected | Jest: signed cookie using `'pitchmi-dev-cookie-secret'` → 401 on `/api/admin/logs` |
| 5 | Admin login rate limited | Jest: 11 wrong-password POSTs → the 11th is 429 |
| 6 | Admin login is constant-time and logged | Jest: `timingSafeEqual` path used; a failed login writes one `admin_login` event with `ok:false` |
| 7 | Transcribe rate limited per IP | Jest: 31 POSTs from one IP → the 31st is 429 `rate_limited` |
| 8 | Non-video upload rejected | Jest: multipart with `text/html` → 415, ffmpeg never spawned |
| 9 | ffmpeg args carry the guards | Jest (mocked spawn): both `extractAudio` and `transcodeForEval` arg arrays contain `-nostdin`, `-protocol_whitelist file`, and an `-f` value |
| 10 | ffmpeg timeout kills the child | Jest with fake timers: a never-closing mock proc → rejects `ffmpeg_timeout`, `kill` called |
| 11 | Scribe body read is covered by the abort timer | Jest: mock fetch resolves headers then a body that never settles → rejects within the timeout, does not hang |
| 12 | Concurrency capped | Jest: `MEDIA_CONCURRENCY=1`, two overlapping media jobs → the second starts only after the first releases; a full queue returns 503 `busy` |
| 13 | Semaphore releases on throw | Jest: a job that throws still frees its slot; a following job runs |
| 14 | CORS fails closed | Jest: `CLIENT_ORIGIN` empty → no `Access-Control-Allow-Origin` reflected for a foreign origin |
| 15 | Admin cookie flags | Jest: login response `Set-Cookie` contains `SameSite=None`, `Secure`, `HttpOnly` |
| 16 | Karaoke renders an error state | Vitest: `useRecorder` mocked to `state:"error"` → error text + a way back render, not a blank screen |
| 17 | Countdown is cancellable | Vitest with fake timers: unmount during countdown → `beginRecording`/`MediaRecorder` never constructed |
| 18 | MediaRecorder failure surfaces | Vitest: `MediaRecorder` constructor throws → error state set, no unhandled exception |
| 19 | Server suite green + lint | `cd server && npx jest && npx standard` |
| 20 | Client suite green + build | `cd client && npx vitest run && npm run build && npm run test:layout` |

## Manual verification after deploy (for Eli, add to the STATUS checklist)

- Admin login works from the deployed client origin, and Logs/Aggregates/Service tabs load.
- A normal record → transcribe → karaoke → evaluate round trip still completes end-to-end on iPhone Safari.
- Denying camera permission on the karaoke screen shows an error, not a black screen.

## Supabase check (report, do not change)

`server/db/migrations/0001_init.sql:77-81` describes the private `videos` bucket only in a **comment** — nothing in the repo creates it or sets `storage.objects` policies. Verify against the live project `ciknhdocqyuxlzsnhzbc` whether the bucket exists and is private, and report the answer in STATUS under Known issues. Do not create or alter buckets or policies in this task.

## Wrap-up

- Run `git diff --stat` and review it before committing.
- Commit with `git add -A && git commit -m "T-10010: pre-release security and stability hardening"`.
- Push to `origin main`. Resolve your own push blockers — do not stop and hand a terminal command back.
- Record every deviation from this spec in `docs/STATUS.md` under Known issues / deviations, with the reason.
- **You do not allocate task IDs.** Any follow-up you discover is filed as a slug (e.g. `FU-HELMET-HEADERS`) in `docs/TASKS.md`; the PM converts it to a real ID.

REMINDER: Do not forget to commit, push, and update STATUS.md.

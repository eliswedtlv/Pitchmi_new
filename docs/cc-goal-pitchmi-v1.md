# PitchMi v1 — Greenfield Build Spec (CC /goal)

Read CLAUDE.md/AGENTS.md and docs/update_status.md first — **this is a greenfield repo; those files do not exist yet. Creating them is part of this task (see §14 Scaffolding) — create them FIRST, then follow them.** After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, and commit the changes. **Do NOT push — no git remote is configured yet; Eli will create the GitHub repo.** Initialize git (`git init`, branch `main`) as part of scaffolding.

- **Task ID:** T-1150
- **Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
- **Repo state:** completely empty. Nothing to inspect; nothing to preserve.

---

## 1. Product

**PitchMi** — a responsive web app (desktop + mobile browsers) for creating and improving spoken videos of up to one minute.

The loop: the user records a first take → speech is transcribed (word-level timestamps) into an editable transcript → the user edits the text → the edited text becomes a **timed karaoke path** (synchronized subtitles) that guides the next recording in a teleprompter/karaoke interface → after each take the AI evaluates **presentation only** (voice, body language, delivery, timing vs the path, accuracy vs the edited script — NEVER the substance of what is said; the user may talk about flying pigs and score 100) and returns per-dimension scores, an overall score, and short coach-style feedback → the user repeats until satisfied → downloads the final video and/or shares it via the OS share sheet, and may explicitly save it to the cloud.

No signup, ever, in v1. Supabase **anonymous auth** creates an invisible per-device identity. (v2 adds Google sign-in, a public feed, and leaderboards — out of scope here, but don't paint the schema into a corner.)

## 2. Stack (pinned — do not substitute)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript 5.x (strict) + Tailwind CSS v4 + shadcn/ui, in `client/` |
| Backend | Node 22 + Express 4.x, **JavaScript ES6 + StandardJS style** (no semicolons), in `server/` |
| BE tests | Jest + Supertest |
| FE tests | Vitest + Testing Library (light), `next build` must pass |
| DB / Auth / Storage | Supabase — Postgres, **anonymous sign-in**, private Storage bucket `videos` |
| STT | ElevenLabs **Scribe** (`POST https://api.elevenlabs.io/v1/speech-to-text`, model `scribe_v1`) — word-level timestamps + language detection |
| Video evaluation | OpenRouter, model **`google/gemini-3.1-flash-lite`**, video sent as a content part; keep a provider interface with a direct Gemini `generateContent` (inline_data) fallback, switchable via `EVAL_PROVIDER=openrouter|gemini` |
| Audio extraction | `ffmpeg-static` npm package (webm/mp4 → m4a/wav for Scribe) — no system ffmpeg dependency |
| Deploy target | Railway, two services from this monorepo: root `client/` and root `server/` (do not write Railway config beyond a `Procfile`/start scripts; Eli deploys) |

Monorepo layout:

```
Pitchmi_new/
  client/          # Next.js app
  server/          # Express API
  docs/            # STATUS.md, TASKS.md, update_status.md, this spec
  CLAUDE.md        # root agent instructions (create, §14)
  README.md
```

## 3. Environment variables

`server/.env.example` (never commit real values):

```
PORT=8080
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=            # verify user JWTs
ELEVENLABS_API_KEY=
OPENROUTER_API_KEY=
EVAL_PROVIDER=openrouter        # openrouter | gemini
GEMINI_API_KEY=                 # only used when EVAL_PROVIDER=gemini
EVAL_MODEL=google/gemini-3.1-flash-lite
ADMIN_PASSWORD=
DAILY_EVAL_LIMIT=25
SURGE_MAX_CALLS=300             # total API calls…
SURGE_WINDOW_MIN=5              # …per this many minutes → kill switch
MAX_UPLOAD_MB=60
SCRIBE_USD_PER_MIN=0.007        # unit-cost estimates for logging
```

`client/.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`.

## 4. Data model (Supabase migrations — write SQL files in `server/db/migrations/`)

```sql
-- projects: one per "video the user is working on"
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null default 'Untitled',
  use_case text not null default 'pitch',     -- pitch | intro | sales | social | custom
  use_case_custom text,                        -- free text when use_case='custom'
  language text,                               -- BCP-47, auto-detected from take 1
  script text,                                 -- current edited transcript
  path jsonb,                                  -- current karaoke path (see §6)
  speed numeric not null default 1.0,          -- global speed slider 0.75–1.25
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- saved_takes: ONLY explicit "Save to cloud" — nothing else is ever stored
create table saved_takes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  user_id uuid not null references auth.users(id),
  storage_path text not null,                  -- videos/{user_id}/{take_id}.webm
  duration_s numeric,
  scores jsonb,                                -- full evaluation payload at save time
  created_at timestamptz default now()
);

-- events: append-only ops log (metadata only, NEVER video content or transcript text)
create table events (
  id bigserial primary key,
  ts timestamptz default now(),
  user_id uuid,
  action text not null,       -- transcribe | path | evaluate | save | admin_login | surge_trip | error
  project_id uuid,
  duration_s numeric,         -- video duration
  language text,
  scores jsonb,               -- numeric scores only
  latency_ms integer,
  cost_usd numeric,
  error text
);

-- app_settings: single-row-ish key/value
create table app_settings (
  key text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values ('service_enabled', 'true');
```

RLS: enable on all tables. `projects` / `saved_takes`: `auth.uid() = user_id` for select/insert/update/delete. `events` / `app_settings`: no anon policies (service-role only). Storage bucket `videos`: private; FE plays saved takes via signed URLs minted by the BE.

Client reads its own `projects`/`saved_takes` directly via supabase-js + RLS. All writes and everything involving API keys go through the Express server (service-role key lives ONLY on the server).

## 5. Backend API (Express, all under `/api`)

Auth middleware: every non-admin endpoint requires `Authorization: Bearer <supabase user JWT>`; verify with `SUPABASE_JWT_SECRET`, extract `user_id`. FE obtains the JWT via `supabase.auth.signInAnonymously()` on first load (persisted session).

Global middlewares, in order: (1) kill switch — if `service_enabled=false`, respond `503 {"error":"service_paused"}` (admin routes exempt); (2) surge counter — sliding window over all `/api/*` calls (in-memory, per instance); if count > `SURGE_MAX_CALLS` within `SURGE_WINDOW_MIN`, set `service_enabled=false` in DB, log a `surge_trip` event, return 503; (3) upload cap `MAX_UPLOAD_MB` → `413`.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | `200 {"status":"ok"}` — no auth |
| `POST /api/projects` | create project `{title?, use_case, use_case_custom?}` → project row |
| `POST /api/transcribe` | multipart `{video, project_id}` → extract audio (ffmpeg-static) → Scribe → `{text, language, words:[{w, start, end}], duration_s}`; stores `script`+`language` on the project; logs event; **video bytes discarded after response** |
| `POST /api/path` | `{project_id, edited_script, speed}` → path algorithm (§6) → `{path, fits, est_duration_s, warning?}`; persists `script`, `path`, `speed` |
| `POST /api/evaluate` | multipart `{video, project_id}` → enforce daily limit (count of today's `evaluate` events for this user ≥ `DAILY_EVAL_LIMIT` → `429 {"error":"daily_limit","limit":25}`) → Scribe on new take → alignment + timing scoring (§7) → Gemini delivery eval (§8) → combined result (§9); logs event with latency + cost; **video bytes discarded** |
| `POST /api/save` | multipart `{video, project_id, scores}` → upload to Storage `videos/{user_id}/{take_id}.webm` → insert `saved_takes` → `{take_id}` |
| `GET /api/takes/:id/url` | signed playback URL (60 min) for own take |
| `GET /api/ad` | `200 {"type":"demo","url":"/ads/demo.mp4","skippable_after_s":5}` — ad config stub; FE must treat this as swappable for a future ad network |
| `POST /api/admin/login` | `{password}` vs `ADMIN_PASSWORD` → httpOnly signed cookie (12h) |
| `GET /api/admin/logs?from&to&action&user&limit&offset` | paged `events` rows |
| `GET /api/admin/aggregates?days=30` | per-day: evals, unique users, avg score, total cost_usd, errors, avg latency |
| `POST /api/admin/service` | `{enabled: true\|false}` — re-arm/disarm kill switch |

Errors: JSON `{error, message?}`, correct status codes, every 5xx also logged to `events` with `action='error'`.

## 6. Karaoke path algorithm (`server/src/lib/path.js`) — CORE IP, test heavily

Input: original Scribe words `[{w, start, end}]`, edited script (plain text), `speed` (0.75–1.25). Output: `path = {words: [{w, t_start, t_end, line}], lines: [...], total_s}`.

1. **Tokenize** both texts language-aware (Unicode word segmentation; for CJK/no-space scripts fall back to grapheme clusters — use `Intl.Segmenter`).
2. **Align** edited tokens to original tokens (word-level diff / LCS on normalized forms — lowercase, strip punctuation). Surviving words become **anchors** carrying their original `start`/`end`.
3. **Measure** the speaker's natural rate from the original take: median seconds-per-character over voiced words (char-based, not word-based — robust across languages).
4. **Assign times:** anchored words keep original timing. Each run of inserted/changed words between two anchors is distributed across the inter-anchor gap proportionally to character count. If a run doesn't fit at ≤ max rate, expand the gap by shifting all subsequent timing right. Runs before the first / after the last anchor extrapolate at the measured rate. Deleted words close their gap but **preserve original inter-sentence pauses** where both surrounding anchors survive.
5. **Clamp** the resulting rate into a speakable band — 140–170 wpm equivalent for spaced languages, expressed internally as chars/sec derived from the measured rate ±20%.
6. **Apply speed**: multiply every timestamp by `1/speed`.
7. **Line-break** into teleprompter lines (~40 chars, break at clause punctuation when possible).
8. **Fit check:** if `total_s > 60`, return `fits:false` with `warning` stating seconds over and words to cut at the current pace. Path is still returned (FE blocks recording until it fits or the user shortens/speeds up).

Edge cases that MUST have unit tests: empty edit; identical edit (path ≈ original timings); everything replaced (no anchors — pure rate-based); single word; edit that can't fit 60s; RTL text (Hebrew — logical order is unaffected, rendering is FE's job); CJK (no spaces); numbers/punctuation-only tokens; `speed` extremes.

## 7. Take comparison — accuracy + timing (`server/src/lib/score.js`)

Input: new take's Scribe words, the path. 

1. **Align** spoken words to path words with dynamic programming (Levenshtein alignment over normalized tokens; substitutions/insertions/deletions costed 1). Fillers ("um", "אה") count as insertions, never as matches.
2. **Accuracy** = matched / path-word-count × 100.
3. **Timing:** for each matched word, `offset = actual_start − target_start`. Per line: mean offset; overall: mean |offset|, plus drift slope (linear fit of offset over time → "rushing"/"dragging"). Timing score: 100 at mean |offset| ≤ 0.3s, linear to 0 at ≥ 3.0s.
4. **Flags** (max 5, machine-generated, localized by FE keys not sentences): `rushed_line`/`dragged_line` (|line offset| > 1s), `long_pause` (gap > 2× expected), `skipped_line` (< 50% of a line matched), `off_script` (accuracy < 70).

Unit tests with fixture word arrays and exact expected numbers (perfect take → 100/100; every word 1s late → timing per the formula; half the words skipped → accuracy 50 + flags).

## 8. AI delivery evaluation (Gemini via OpenRouter)

`server/src/lib/evaluate.js`, provider interface `{evaluateVideo(bytes, mime, promptCtx) → json}` with `openrouter` and `gemini` implementations.

The prompt is an evolution of PitchMi v2's evaluator (proven in production) with these rules — write it carefully, it ships in `server/src/prompts/eval.md` and is loaded at runtime:

- Role: strict-but-fair panel of world-class **delivery** coaches. Judge with high standards, feedback improvement-focused.
- **Judge the messenger, never the message.** Explicitly: ignore the topic, truthfulness, business merit, or logic of the content. A flawlessly delivered absurd script scores perfectly.
- Ignore framing, lighting, equipment, background, missing body parts; do not comment on recording conditions. (Body language IS in scope when visible: posture, openness, controlled gestures, eye contact toward lens, facial warmth, no fidgeting.)
- Dimensions (0–100 each): **voice** (pace ~140–170 wpm equivalent, modulation, volume, articulation, authentic tone), **body** (posture, gestures, eye contact, expression, stillness discipline), **delivery** (energy slightly above conversational, congruence of tone/words/gesture, no reading-effect, emotional commitment, clean finish — no trailing off or nervous laugh).
- Micro-timeline for a ≤60s take: first 3s stable stance + small smile + eye contact; energy lift toward the close; controlled finish.
- **Use-case adaptation** (injected variable): `pitch` → tight, energetic, confident; `intro` → warm, relaxed, approachable; `sales` → persuasive, benefit-forward energy; `social` → expressive, personality-forward; `custom` → adapt to the user's free-text description. Adaptation shifts delivery expectations only.
- Calibration: baseline 75 when the delivery is competent; add for strengths, subtract only for real problems; don't punish natural pauses or human imperfection; below 65 reserved for fundamental delivery failure. Typical earnest amateur lands 75–88.
- Comments: exactly 3, each 5–8 words, tough-startup-coach tone — direct, sharp, practical, slightly witty, zero flattery — **in the take's spoken language**.
- Output strict JSON: `{"voice":0,"body":0,"delivery":0,"comments":["","",""]}`; request JSON response format; `temperature: 0.2`; validate + one retry on malformed JSON.

## 9. Combined result (returned by `/api/evaluate`)

```json
{
  "overall": 84,
  "dimensions": { "voice": 82, "body": 85, "delivery": 88, "timing": 79, "accuracy": 91 },
  "comments": ["…", "…", "…"],
  "flags": [{"type":"rushed_line","line":3}],
  "language": "he",
  "evals_left_today": 21
}
```

`overall = 0.5 × mean(voice, body, delivery) + 0.25 × timing + 0.25 × accuracy`, rounded.

## 10. Frontend (Next.js, `client/`)

Screens (mobile-first, responsive to desktop; full RTL support — `dir` follows content language on prompter/editor, UI chrome is English-only in v1):

1. **Home / New video** — use-case picker (pitch / intro / sales / social / custom+textbox), Record button, or drag-&-drop/upload an existing ≤60s video as take 1. "My videos" link.
2. **Recorder (take 1)** — camera preview (getUserMedia, 720p, front camera), 3-2-1 countdown, 60s countdown ring, auto-stop, tap-to-stop. MediaRecorder webm (mp4 fallback for Safari/iOS — detect `MediaRecorder.isTypeSupported`).
3. **Transcript editor** — editable text (textarea/contentEditable), live estimated duration + fit meter at current speed, global speed slider (0.75×–1.25×), warning banner when it can't fit 60s. "Rehearse next take" CTA.
4. **Karaoke recorder** — the heart of the app. Teleprompter near the camera: 3 lines visible, current line centered, **current word highlighted exactly at its path time**, past words dimmed, smooth scroll. Same countdown/auto-stop (path end + 3s grace). The highlight is a metronomic guide (no live STT in v1).
5. **Results** — playback of the take (local blob), overall score (big), 5 dimension bars, 3 coach comments, flag chips on a mini timeline, evals-left-today counter. Actions: **Try again** (back to karaoke), **Edit script**, **Download**, **Share** (Web Share API with file; hide if unsupported), **Save to cloud** (explicit, separate from Download).
6. **Evaluation wait state** — plays the demo **video ad** (`GET /api/ad`, muted autoplay, "Ad" label, skippable after `skippable_after_s`) + thin progress bar + rotating status messages; screen Wake Lock while waiting/recording. Ad component isolated (`<AdSlot/>`) so an ad network can replace the stub without touching the flow.
7. **My videos** — saved takes (RLS direct read), thumbnail/score/date, play via signed URL, delete.
8. **Admin** (`/admin`) — password login; tabs: **Logs** (filterable table of events; no video/transcript content exists to show), **Daily aggregates** (table: evals, users, avg score, cost, errors, latency), **Service** (kill-switch state + red/green toggle, surge alert banner when last trip < 24h).

State: Zustand or React context (keep light). Camera/recorder logic isolated in hooks (`useRecorder`, `useKaraokeClock`). The karaoke clock must use `performance.now()`-based scheduling, not setInterval drift.

## 11. Privacy rules (enforce in code, state in README)

- Take videos are processed in memory / temp files and discarded after transcribe/evaluate — never written to storage unless the user hits **Save to cloud**.
- `events` carries metadata only: no video bytes, no transcript text, no comments text.
- Admin UI can see logs, never content.

## 12. Scope boundaries — do NOT build

- No signup/login UI, no OAuth, no email — anonymous auth only.
- No public feed, leaderboards, nicknames, publishing (v2 — `docs/pitchmi-v2-spec.md`).
- No real ad network SDK — stub only.
- No TTS, no live-STT pacing during recording, no per-line pause editing (explicitly cut).
- No Docker, no CI config, no Railway config beyond start scripts.
- No paid tiers/quotas beyond the 25/day eval cap.

## 13. Acceptance criteria (all runnable)

| # | Check | Command / assertion |
|---|---|---|
| 1 | Health | `curl :8080/api/health` → `200 {"status":"ok"}` |
| 2 | Auth gate | `curl -X POST :8080/api/transcribe` (no JWT) → `401` |
| 3 | Path algorithm | `cd server && npx jest path` — all §6 edge-case tests green |
| 4 | Scoring | `npx jest score` — fixture numbers exact per §7 |
| 5 | Daily cap | Jest: 26th `evaluate` for same user (seeded events) → `429 daily_limit` |
| 6 | Kill switch | Jest: exceed `SURGE_MAX_CALLS` (set low in test env) → next call `503`, `app_settings.service_enabled=false`, `surge_trip` event row |
| 7 | Admin auth | `curl :8080/api/admin/logs` without cookie → `401`; with cookie after login → `200` |
| 8 | Ad stub | `curl :8080/api/ad` → `200` with `type:"demo"` and a URL that exists in `client/public/ads/` |
| 9 | Evaluate e2e (mocked) | Jest + Supertest: multipart video fixture with Scribe + OpenRouter mocked → `200` with §9 shape, event row with latency+cost |
| 10 | No storage without save | Jest: after mocked evaluate, Storage upload mock NOT called; after `/api/save`, called once |
| 11 | FE builds | `cd client && npm run build` → exit 0 |
| 12 | FE tests | `cd client && npx vitest run` → green (path-fit meter logic, karaoke clock scheduling with fake timers) |
| 13 | Lint | `cd server && npx standard` → clean |

External-API integration (real Scribe/OpenRouter keys) is NOT tested in CI — provide `server/scripts/smoke.js` that runs the full pipeline against a bundled 5s sample video when keys are present, printing the JSON result. Report it as "not run" if keys are absent.

Manual checklist (list in STATUS.md for Eli, don't automate): camera record on Chrome desktop + iOS Safari; karaoke highlight sync feels right; Hebrew take end-to-end incl. RTL prompter; share sheet on mobile.

## 14. Scaffolding & docs (create FIRST)

1. `git init` (branch `main`), root `.gitignore` (node, .env, .next).
2. Root `CLAUDE.md`: one-paragraph product summary, monorepo map, stack pins from §2, StandardJS for `server/` + strict TS for `client/`, the privacy rules (§11), pointer to docs/.
3. `docs/update_status.md`: instructions for maintaining STATUS.md — sections (Current state / Recently shipped / In progress / Known issues / Next), update on every task completion, newest first, terse bullets, include date + task ID.
4. `docs/STATUS.md` (initial, per those instructions) and `docs/TASKS.md` (backlog table seeded with: v2 milestone pointer; "swap ad stub for network"; "create GitHub remote + push"; any follow-ups you discover).
5. `README.md`: product blurb, dev setup (two terminals), env setup, deploy notes (two Railway services), privacy statement.
6. Include a tiny bundled sample video fixture (generate with ffmpeg-static: 3s test pattern + tone) for tests/smoke.

## 15. Execution notes

- Commit in logical increments with clear messages; run `git diff --stat` review before each commit.
- Final commit: `git add -A && git commit -m "PitchMi v1: core loop (T-1150)"`. **No push** (no remote).
- If a pinned package version conflicts at install time, use the nearest compatible version and record the deviation in STATUS.md — do not swap libraries.

REMINDER: Do not forget to commit and update docs/STATUS.md (following docs/update_status.md) and docs/TASKS.md. No push — remote doesn't exist yet.

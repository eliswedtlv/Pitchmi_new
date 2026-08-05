# PitchMi — Agent Instructions (root)

**PitchMi** is a responsive web app for rehearsing scripted spoken videos of up to 30 seconds. The loop: type or paste a script → rehearse it on camera against a timed **karaoke path** (synced teleprompter) → transcribe the take with word-level timestamps → objectively score timing/accuracy and re-time the next path to the speaker’s measured pace → use AI to evaluate **presentation only** (voice, body, delivery — never the substance/topic) → repeat until satisfied → share/download through the operating system. No signup in v1: Supabase **anonymous auth** gives an invisible per-device identity.

## Monorepo map

```
Pitchmi_new/
  client/          # Next.js 15 App Router frontend (TypeScript, strict)
  server/          # Express 4 API (JavaScript ES6, StandardJS, no semicolons)
  docs/            # STATUS.md, TASKS.md, update_status.md, specs
  CLAUDE.md        # this file
  README.md
```

## Stack (pinned — do not substitute libraries; use nearest compatible version on conflict and record the deviation in docs/STATUS.md)

- **Frontend** (`client/`): Next.js 16 (App Router) + React 19 + TypeScript 5.x **strict** + Tailwind CSS v4 + shadcn/ui. Next 16 is the recorded T-10029 security deviation from the original Next 15 pin.
- **Backend** (`server/`): Node 22 (dev on 24 is fine) + Express 4.x, **JavaScript ES6, StandardJS style (no semicolons)**.
- **BE tests**: Jest + Supertest. **FE tests**: Vitest + Testing Library; `next build` must pass.
- **DB / Auth / Storage**: Supabase — Postgres, anonymous sign-in, private Storage bucket `videos`.
- **STT**: ElevenLabs Scribe (`scribe_v1`) — word-level timestamps + language detection.
- **Video evaluation**: OpenRouter model `google/gemini-3.1-flash-lite`, with a direct Gemini `generateContent` fallback, switched by `EVAL_PROVIDER=openrouter|gemini`.
- **Audio extraction**: `ffmpeg-static` npm package (no system ffmpeg).
- **Deploy**: Railway, two services (root `client/`, root `server/`).

## Style rules

- `server/`: StandardJS — **no semicolons**, single quotes, 2-space indent. Keep `npx standard` clean.
- `client/`: TypeScript strict; `npm run build` must exit 0; keep `npx vitest run` green.

## Privacy rules (enforce in code)

- Take videos are processed in memory / temp files and **discarded** after transcribe/evaluate — never written to Storage unless the user hits **Save to cloud**.
- A current versioned consent receipt is required before project/script/media processing. The typed name/initials stays in the browser; the server records only anonymous user id, consent action/version, and timestamp.
- The `events` table carries **metadata only**: no video bytes, no transcript text, no comments text. Numeric scores only.
- Admin UI can see logs/aggregates, **never content**.
- Service-role Supabase key lives **only** on the server. The client reads its own `projects`/`saved_takes` via supabase-js + RLS; all writes and anything touching API keys go through the Express server.

## Docs discipline

After completing a task: update `docs/STATUS.md` (follow `docs/update_status.md`), update `docs/TASKS.md` if task state changed, and commit. See `docs/` for the full v1 build spec (`cc-goal-pitchmi-v1.md`) and the v2 product spec.

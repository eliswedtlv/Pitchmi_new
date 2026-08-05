# PitchMi

Write a script for a short spoken video (≤ 30s), rehearse it on camera against a timed **karaoke teleprompter**, and get sharp coaching on **delivery**—voice, body language, timing, and accuracy, never *what* you say. Every take re-times the next rehearsal to your measured speaking pace. Repeat until it lands, then share or download through the operating system.

No signup. A Supabase **anonymous** identity is created per device when the user
accepts the recording/AI-processing notice.

> ⚠️ **Privacy first:** the script is stored in a private project tied to the
> browser’s anonymous identity. Take videos are processed in memory / temp files
> and **discarded** after transcription and evaluation; normal rehearsal does
> not write them to cloud storage unless the user explicitly saves a take.
> Saved takes remain private and can be deleted. Operational logs contain consent/version
> metadata and numeric diagnostics only — never video, transcript, typed
> acknowledgement, or feedback text. `/privacy` explains the flow and lets the
> current browser permanently erase its data and anonymous account.

## Monorepo layout

```
Pitchmi_new/
  client/   # Next.js 16 (App Router, TS strict, Tailwind v4, shadcn/ui)
  server/   # Express 4 API (JavaScript, StandardJS style)
  docs/     # STATUS.md, TASKS.md, specs
```

## Prerequisites

- Node 22+ (dev tested on 24)
- A Supabase project (Postgres + Storage) with **anonymous sign-in** enabled
- ElevenLabs API key (Scribe STT)
- OpenRouter API key (or a Gemini API key for the direct fallback)

## Setup

### 1. Server

```bash
cd server
cp .env.example .env      # fill in real values
npm install
npm run dev               # http://localhost:8080
```

Run the DB migrations against your Supabase project (SQL Editor or `psql`):

```bash
# apply everything in server/db/migrations/ in filename order
```

Create a **private** Storage bucket named `videos` in Supabase.

### 2. Client

```bash
cd client
cp .env.example .env.local  # fill in NEXT_PUBLIC_* values
npm install
npm run dev                 # http://localhost:3000
```

Run both in two terminals during development. The client talks to the server via `NEXT_PUBLIC_API_BASE_URL`.

## Environment variables

See `server/.env.example` and `client/.env.example`. The Supabase **service-role** key lives **only** on the server. Never commit real values.

## Testing

```bash
# Backend
cd server && npx jest          # unit + integration (mocked external APIs)
cd server && npx standard      # lint

# Frontend
cd client && npm run typecheck # strict TypeScript check
cd client && npm run build     # must exit 0
cd client && npm test          # unit tests
cd client && npm run test:layout # responsive Playwright checks
```

External-API integration (real Scribe / OpenRouter) is not run in CI. When keys are present:

```bash
cd server && node scripts/smoke.js   # full pipeline against a bundled 5s sample
```

## Deploy (Railway)

Two services from this monorepo:

- **server** — root directory `server/`, start `npm start` (see `server/Procfile`). Set all `server/.env.example` vars.
- **client** — root directory `client/`, build `npm run build`, start `npm start`. Set `NEXT_PUBLIC_*` vars, pointing `NEXT_PUBLIC_API_BASE_URL` at the deployed server URL.

## Docs

- `docs/cc-goal-pitchmi-v1.md` — the v1 build spec.
- `docs/pitchmi-v2-spec.md` — v2 product spec (feed, leaderboards, identity).
- `docs/SECURITY-AUDIT-2026-08-05.md` — production consent/security release review.
- `docs/STATUS.md` — current state. `docs/TASKS.md` — backlog.

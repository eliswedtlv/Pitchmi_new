# PitchMi — STATUS

## Current state
v1 core loop is built end-to-end (T-1150). **Server** (Express) exposes the full API — projects, transcribe (ElevenLabs Scribe via ffmpeg-static audio extraction), karaoke path, evaluate (timing/accuracy scoring + Gemini delivery eval via OpenRouter/Gemini), save, takes, ad stub, and admin — behind a fail-open kill switch, surge auto-trip, upload cap, JWT auth, and RLS. **Client** (Next.js 15) implements all 8 screens with anonymous Supabase auth, camera recorder, live fit meter, `performance.now()`-based karaoke teleprompter, results, my-videos, and admin. All automated acceptance checks (§13 #1–#13) pass. Not yet run: real external-API smoke (needs keys) and the manual browser checklist below.

## Recently shipped
- 2026-07-16 (T-1150): Client — Next.js 15 App Router (8 screens), useRecorder/useKaraokeClock/useWakeLock hooks, `<AdSlot/>`, Supabase anon auth, API client, Zustand store, Tailwind v4 + shadcn-style UI. `next build` exit 0; 29 vitest tests green (fit meter + karaoke clock w/ fake timers). Fixed admin logs/aggregates response-shape + field-name mismatches.
- 2026-07-16 (T-1150): Server API — all routes + middleware (kill switch, surge, upload cap, auth, admin cookie), Scribe/ffmpeg/eval integrations, DB migrations + RLS, eval prompt, smoke script, sample/demo video fixtures. 35 Jest tests green; StandardJS clean.
- 2026-07-16 (T-1150): Server CORE IP — karaoke path (§6) + take scoring (§7), 21 unit tests over all edge cases.
- 2026-07-16 (T-1150): Repo scaffolding — git init (`main`), `.gitignore`, root `CLAUDE.md`, `README.md`, docs.

## In progress
- Nothing in progress. v1 core loop code-complete pending real-key smoke + manual QA.

## Known issues / deviations
- **Deviation:** `multer` pinned to 2.x (not 1.x) — 1.x has published CVEs; multer was not a pinned library. API compatible.
- **Deviation:** added `original_words jsonb` column to `projects` (beyond §4). `/api/path` needs take-1 word timings and §4's schema had nowhere to persist them. Reflected in `server/db/migrations/0001_init.sql`.
- **Deviation:** local Node is v24.11.1; spec pins Node 22 (Railway runtime). v24 is backward-compatible for dev; `engines` allows `>=22`.
- **Deviation:** client `next@15.1.0` (nearest 15.x); all other versions as pinned.
- **Gap:** OpenRouter path sends the video as a `video_url` data-URL content part (best-effort); the direct-Gemini `inline_data` fallback (`EVAL_PROVIDER=gemini`) is the reliable path. Confirm the OpenRouter shape against the live model via `server/scripts/smoke.js` before relying on it.
- **Gap:** admin Service tab toggle is optimistic (no GET service-state endpoint in the fixed API list) and the "surge trip < 24h" alert banner is not yet wired. Minor; logs already record `surge_trip` events.
- External-API integration is NOT run in CI. `server/scripts/smoke.js` runs the full pipeline against the bundled 3s sample when keys are present; reports "NOT RUN" otherwise.

## Next
- Provision Supabase (run `server/db/migrations/0001_init.sql`, enable anonymous sign-in, create private `videos` bucket), set env, run `node --env-file=.env scripts/smoke.js` to validate Scribe + eval with real keys.
- Deploy two Railway services (root `client/`, root `server/`).
- Manual QA (below), then swap the ad stub for a real network (T-1152) as v2 approaches.

## Manual test checklist (for Eli)
- [ ] Camera record on Chrome desktop + iOS Safari (webm vs mp4 fallback).
- [ ] Karaoke highlight sync feels right (word lands on time).
- [ ] Hebrew take end-to-end incl. RTL prompter + editor.
- [ ] Share sheet on mobile (Web Share API with file); hidden when unsupported.
- [ ] Download vs Save-to-cloud are distinct; nothing is stored unless Save is tapped.
- [ ] Admin login → Logs / Aggregates / Service tabs render against real data.

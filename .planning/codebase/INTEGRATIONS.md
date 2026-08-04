# External Integrations

**Analysis Date:** 2026-08-04

## APIs & External Services

**Speech-to-Text:**
- ElevenLabs Scribe - Converts extracted mono audio into a transcript, detected language, and word-level timestamps in `server/src/lib/scribe.js`; it is called from the evaluation pipeline in `server/src/routes/evaluate.js`.
  - SDK/Client: Native Node Fetch, `FormData`, and `Blob`; endpoint is declared in `server/src/lib/scribe.js`, with Scribe model `scribe_v1`.
  - Auth: `ELEVENLABS_API_KEY`, sent as the ElevenLabs API-key header by `server/src/lib/scribe.js`.

**AI Delivery Evaluation:**
- OpenRouter - Default multimodal delivery-scoring route in `server/src/lib/evaluate.js`; sends the transcoded video as a base64 data URL to the chat-completions API.
  - SDK/Client: Native Node Fetch in `server/src/lib/evaluate.js`; no OpenRouter SDK dependency is present in `server/package.json`.
  - Auth: `OPENROUTER_API_KEY`, sent as a Bearer token in `server/src/lib/evaluate.js`.
  - Routing: `EVAL_PROVIDER` defaults to `openrouter`, `EVAL_MODEL` selects the model, and provider routing is pinned to `google-vertex` with fallbacks disabled in `server/src/lib/evaluate.js`.
  - Usage: Provider-reported token usage and billed cost are accumulated and recorded as numeric operational metadata by `server/src/routes/evaluate.js`.
- Google Gemini API - Direct fallback selected only when `EVAL_PROVIDER=gemini` in `server/src/lib/evaluate.js`; sends inline base64 video to `generateContent`.
  - SDK/Client: Native Node Fetch in `server/src/lib/evaluate.js`; no Google AI SDK dependency is present in `server/package.json`.
  - Auth: `GEMINI_API_KEY`, passed in the request URL by `server/src/lib/evaluate.js`.
  - Model: Derived from `EVAL_MODEL` after removing the optional `google/` prefix in `server/src/lib/evaluate.js`.

**Fonts:**
- Google Fonts via Next.js - Inter Latin and Heebo Hebrew are declared with `next/font/google` in `client/src/app/layout.tsx`.
  - SDK/Client: Built-in Next.js font loader; generated font assets are self-hosted by the application at runtime as documented in `client/src/app/layout.tsx`.
  - Auth: None.

**Advertising:**
- No external ad provider is connected. `GET /api/ad` in `server/src/routes/ad.js` returns a local demo configuration that points to `client/public/ads/demo.mp4`.

## Data Storage

**Databases:**
- Supabase-hosted PostgreSQL.
  - Connection: `SUPABASE_URL` plus server-only `SUPABASE_SERVICE_ROLE_KEY` in `server/src/config.js`.
  - Client: `@supabase/supabase-js` through the centralized server data layer in `server/src/lib/db.js`.
  - Schema: `projects`, `saved_takes`, `events`, and `app_settings` are created in `server/db/migrations/0001_init.sql`; `projects` and `saved_takes` reference Supabase `auth.users`.
  - Access control: Row Level Security owner policies protect `projects` and `saved_takes`, while `events` and `app_settings` have no anon/authenticated policy and are service-role-only in `server/db/migrations/0001_init.sql`.
  - Browser access: The videos page lists and deletes the authenticated user's `saved_takes` directly through Supabase RLS in `client/src/app/videos/page.tsx`; project creation/update and signed playback URLs go through the Express API in `client/src/lib/api.ts`.

**File Storage:**
- Supabase Storage private bucket `videos`, fixed by `STORAGE_BUCKET` in `server/src/config.js`.
- Upload is explicit-only: `POST /api/save` writes the submitted video and a `saved_takes` row in `server/src/routes/save.js`; the evaluation route in `server/src/routes/evaluate.js` does not persist uploaded media.
- Playback uses owner-checked, one-hour signed URLs created in `server/src/lib/db.js` and returned by `server/src/routes/takes.js`.
- Request uploads remain in memory through Multer in `server/src/middleware/upload.js`; ffmpeg intermediates use the operating-system temp directory and are deleted in `finally` blocks in `server/src/lib/audio.js`.
- The client keeps the current recording as in-memory Blob/Object URLs in `client/src/store/session.ts`; only the prompter hint is persisted locally through `localStorage` in `client/src/components/Prompter.tsx`.

**Caching:**
- No external cache service is integrated; neither service manifest contains Redis, Memcached, or another cache client (`client/package.json`, `server/package.json`).
- Process-local state includes the Supabase service client in `server/src/lib/db.js`, the remote JWKS resolver in `server/src/middleware/auth.js`, rate-limit stores in `server/src/middleware/rateLimit.js`, the surge window in `server/src/middleware/surge.js`, and the loaded evaluation prompt in `server/src/lib/evaluate.js`.
- Process-local rate and surge state is per API instance and is not shared across deployments, as implemented in `server/src/middleware/rateLimit.js` and `server/src/middleware/surge.js`.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth with anonymous sign-in.
  - Implementation: `client/src/lib/supabase.ts` restores an existing session or calls `supabase.auth.signInAnonymously()`, then `client/src/lib/api.ts` sends the access token as `Authorization: Bearer`.
  - Verification: `server/src/middleware/auth.js` verifies modern asymmetric tokens through the project's Supabase JWKS endpoint using `jose`; legacy/test HS256 tokens use `jsonwebtoken` and `SUPABASE_JWT_SECRET`.
  - Client configuration: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `client/src/lib/supabase.ts`.
  - Server configuration: `SUPABASE_URL` and conditional legacy `SUPABASE_JWT_SECRET` in `server/src/config.js`.

**Privileged Database Identity:**
- The backend uses `SUPABASE_SERVICE_ROLE_KEY` only in `server/src/lib/db.js`; it disables session persistence/refresh and bypasses RLS for controlled server operations.
- Keep the service-role key out of all `NEXT_PUBLIC_*` configuration; the separation is documented in `README.md` and enforced by the distinct client/server configuration call sites in `client/src/lib/supabase.ts` and `server/src/lib/db.js`.

**Admin Identity:**
- Custom single-password admin login in `server/src/routes/admin.js`.
  - `ADMIN_PASSWORD` is compared in constant time after SHA-256 normalization in `server/src/routes/admin.js`.
  - A signed `admin=1` HTTP-only cookie uses `ADMIN_COOKIE_SECRET`, `SameSite=None`, `Secure`, and a 12-hour lifetime in `server/src/routes/admin.js`.
  - Cookie signature verification is handled by `cookie-parser` in `server/src/app.js` and authorization by `server/src/middleware/admin.js`.
  - Both `ADMIN_PASSWORD` and `ADMIN_COOKIE_SECRET` are mandatory at non-test startup in `server/src/index.js`.

## Monitoring & Observability

**Error Tracking:**
- No third-party error-tracking or APM SDK is present in `client/package.json` or `server/package.json`.
- Server failures, evaluation-stage timings, usage/cost metadata, rate limits, admin logins, and surge trips are stored in the Supabase `events` table through `server/src/lib/db.js`; the table is defined as service-role-only in `server/db/migrations/0001_init.sql`.
- Admin log and daily aggregate endpoints read this operational event data in `server/src/routes/admin.js`.

**Logs:**
- Runtime messages use `console.log`, `console.warn`, and `console.error` in `server/src/index.js`, `server/src/app.js`, middleware under `server/src/middleware/`, and the manual smoke script at `server/scripts/smoke.js`.
- Operational database logs are designed to contain metadata, numeric scores, timings, costs, and bounded error text rather than video/transcript content, as enforced at call sites in `server/src/routes/evaluate.js`, `server/src/middleware/rateLimit.js`, and `server/src/lib/evaluate.js`.
- No log shipping integration or structured logging package is declared in `server/package.json`.

## CI/CD & Deployment

**Hosting:**
- Railway is the documented production platform with separate `server/` and `client/` services in `README.md`.
- The API service uses `web: npm start` from `server/Procfile`; `server/src/app.js` trusts one TLS-terminating proxy hop and uses `CLIENT_ORIGIN` for credentialed CORS.
- The client deploys as a Next.js production server using scripts in `client/package.json` and points `NEXT_PUBLIC_API_BASE_URL` at the deployed API, as documented in `README.md`.

**CI Pipeline:**
- Not detected: no `.github/workflows/`, GitLab CI, CircleCI, or equivalent pipeline configuration exists in the repository.
- Unit/build commands are defined in `client/package.json` and `server/package.json`; `README.md` states that real external-API integration is excluded from CI.
- `server/scripts/smoke.js` is the manual full-pipeline check when real ElevenLabs and evaluation-provider credentials are available.

## Environment Configuration

**Required env vars:**
- Client API/auth: `NEXT_PUBLIC_API_BASE_URL` in `client/src/lib/api.ts`; `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `client/src/lib/supabase.ts`.
- Server Supabase: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/src/config.js`; `SUPABASE_JWT_SECRET` is required for the legacy HS256 verification path in `server/src/middleware/auth.js`.
- Evaluation: `ELEVENLABS_API_KEY` plus `OPENROUTER_API_KEY` for the default provider, or `GEMINI_API_KEY` when `EVAL_PROVIDER=gemini`, as selected in `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, and `server/scripts/smoke.js`.
- Admin: `ADMIN_PASSWORD` and `ADMIN_COOKIE_SECRET`, mandatory outside tests in `server/src/index.js`.
- Browser access: `CLIENT_ORIGIN`, which may contain a comma-separated allowlist; empty configuration closes cross-origin API access in `server/src/app.js`.
- Provider/runtime selection: `EVAL_PROVIDER`, `EVAL_MODEL`, and `PORT` in `server/src/config.js`.
- Operational tuning: `DAILY_EVAL_LIMIT`, `RATE_LIMIT_TRANSCRIBE_PER_HOUR`, `RATE_LIMIT_EVAL_PER_HOUR`, `RATE_LIMIT_SAVE_PER_HOUR`, `MEDIA_CONCURRENCY`, `MEDIA_QUEUE_MAX`, `FFMPEG_TIMEOUT_MS`, `SURGE_MAX_CALLS`, `SURGE_WINDOW_MIN`, `MAX_UPLOAD_MB`, `MAX_TAKE_S`, `TAKE_TOLERANCE_S`, `SCRIBE_USD_PER_MIN`, `MAX_SCRIPT_CHARS`, `MIN_ALIGN_COVERAGE`, and `SEED_CHARS_PER_SECOND` are centralized in `server/src/config.js`.

**Secrets location:**
- Production secrets are expected as Railway/runtime environment variables consumed by `server/src/config.js`; server-only credentials must never be exposed through the client configuration in `client/src/lib/supabase.ts`.
- Example environment files exist at `server/.env.example` and `client/.env.example`; this audit notes their existence only and does not reproduce their contents.
- No credential-management SDK or committed secret store is integrated in `client/package.json` or `server/package.json`.

## Webhooks & Callbacks

**Incoming:**
- None. No webhook or provider callback routes are registered in `server/src/app.js` or implemented under `server/src/routes/`.
- The externally reachable API consists of the application's browser-facing health, demo ad, admin, project, script, evaluation, save, and take URL routes mounted in `server/src/app.js`.

**Outgoing:**
- No webhook deliveries are implemented. Outbound service calls are synchronous request/response calls to ElevenLabs, OpenRouter or Gemini, and Supabase from `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, `server/src/lib/db.js`, and `server/src/middleware/auth.js`.
- The client makes direct Supabase Auth/owner-scoped data calls through `client/src/lib/supabase.ts` and `client/src/app/videos/page.tsx`, plus browser-to-Express calls through `client/src/lib/api.ts`.

---

*Integration audit: 2026-08-04*

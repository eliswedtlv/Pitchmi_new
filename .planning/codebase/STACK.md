# Technology Stack

**Analysis Date:** 2026-08-04

## Languages

**Primary:**
- TypeScript 5.9.3 (resolved) - Next.js App Router pages, React components, hooks, client API types, Zustand state, and browser-focused tests under `client/src/`; strict checking is enabled in `client/tsconfig.json`.
- JavaScript (Node.js CommonJS) - Express API, middleware, media processing, provider clients, scripts, and Jest tests under `server/src/`, `server/scripts/`, and `server/tests/`.

**Secondary:**
- CSS with Tailwind CSS 4.3.3 - Semantic design tokens and global styles live in `client/src/app/globals.css`; PostCSS integration is configured in `client/postcss.config.mjs`.
- SQL (PostgreSQL dialect) - Supabase schema, indexes, row-level-security policies, and initial settings live in `server/db/migrations/0001_init.sql`.
- Markdown - The delivery-evaluation model prompt is loaded at runtime from `server/src/prompts/eval.md`; product and operational documentation lives under `docs/`.

## Runtime

**Environment:**
- Node.js 22 or newer is the project requirement in `server/package.json` and `README.md`; the current development environment is Node.js 24.11.1, consistent with the Node 24 development note in `README.md`.
- Modern browsers must provide MediaRecorder/getUserMedia, Blob/Object URLs, and standard Fetch APIs for recording and upload flows in `client/src/hooks/useRecorder.ts` and `client/src/lib/api.ts`; Wake Lock and Web Share are progressively used in `client/src/hooks/useWakeLock.ts` and `client/src/app/results/page.tsx`.
- The backend relies on Node's built-in `fetch`, `FormData`, `Blob`, `AbortController`, Web Crypto-compatible JWT tooling, and filesystem/process APIs in `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, and `server/src/lib/audio.js`.

**Package Manager:**
- npm; the current environment supplies npm 11.6.2, while no npm version is pinned in `client/package.json` or `server/package.json`.
- Lockfile: present separately for both services as npm lockfile version 3 in `client/package-lock.json` and `server/package-lock.json`; there is no root `package.json`, so install and run each service from its own directory.

## Frameworks

**Core:**
- Next.js 15.5.20 (resolved) - Client application, routing, metadata, font optimization, dev server, and production server in `client/src/app/`, configured by `client/next.config.mjs`.
- React 19.2.7 and React DOM 19.2.7 (resolved) - Interactive browser UI throughout `client/src/app/`, `client/src/components/`, and `client/src/hooks/`.
- Express 4.22.2 (resolved) - JSON/multipart HTTP API assembled in `server/src/app.js` and started by `server/src/index.js`.
- Tailwind CSS 4.3.3 (resolved) - Utility styling and theme tokens, integrated through `client/postcss.config.mjs` and `client/src/app/globals.css`.
- Zustand 5.0.14 (resolved) - In-memory cross-screen recording/project session state in `client/src/store/session.ts`.

**Testing:**
- Vitest 2.1.9 with jsdom and React Testing Library 16.3.2 - Client unit, hook, component, and page tests under `client/src/**`; configuration is in `client/vitest.config.ts`.
- Playwright 1.61.1 - Chromium layout, RTL, and screenshot proofs under `client/tests-layout/`; configuration is in `client/playwright.config.ts`.
- Jest 29.7.0 with Supertest 7.2.2 - Server unit and HTTP integration tests under `server/tests/`; configuration is embedded in `server/package.json`.

**Build/Dev:**
- Next CLI - `dev`, `build`, and `start` commands are defined in `client/package.json`; `client/next.config.mjs` enables React strict mode.
- TypeScript compiler 5.9.3 - Type checking and Next.js compilation settings are defined in `client/tsconfig.json`; source emission is delegated to Next.js (`noEmit: true`).
- PostCSS with `@tailwindcss/postcss` 4.3.3 - Tailwind transformation is configured in `client/postcss.config.mjs`.
- Node `--watch` - Backend development entry point is `server/src/index.js` via the `dev` script in `server/package.json`.
- StandardJS 17.1.2 - Backend linting is configured by the `standard` block and scripts in `server/package.json`.
- `ffmpeg-static` 5.3.0 - Supplies a bundled ffmpeg executable; no system ffmpeg is required by the media operations in `server/src/lib/audio.js`.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.110.7 (resolved in both services) - Anonymous client identity, direct owner-scoped take queries, server-side Postgres access, private video storage, and signed playback URLs in `client/src/lib/supabase.ts`, `client/src/app/videos/page.tsx`, and `server/src/lib/db.js`.
- `multer` 2.2.0 - In-memory multipart video admission and size/type limits in `server/src/middleware/upload.js`.
- `ffmpeg-static` 5.3.0 - Audio extraction, duration observation, and low-bandwidth evaluation proxy generation in `server/src/lib/audio.js`.
- `jose` 5.10.0 and `jsonwebtoken` 9.0.3 - Supabase JWT verification through remote JWKS for asymmetric tokens and an HS256 compatibility path in `server/src/middleware/auth.js`.
- `express-rate-limit` 7.5.1 - Per-IP limits for evaluation, cloud save, and admin login in `server/src/middleware/rateLimit.js`.
- `cors` 2.8.5 and `cookie-parser` 1.4.6 (declared) - Cross-origin browser access and signed admin-cookie parsing in `server/src/app.js`.

**Infrastructure:**
- Supabase Postgres - Relational persistence for projects, saved-take metadata, operational events, and the service kill switch; schema is defined in `server/db/migrations/0001_init.sql`.
- Supabase Storage - Private `videos` bucket accessed only through `server/src/lib/db.js` for upload and one-hour signed URLs.
- `class-variance-authority`, `clsx`, and `tailwind-merge` - Local UI primitives and class composition in `client/src/components/ui/` and `client/src/lib/utils.ts`.
- `lucide-react` - Icon components used across the pages and controls under `client/src/app/` and `client/src/components/`.

## Configuration

**Environment:**
- Server configuration is centralized and read from `process.env` in `server/src/config.js`; do not read environment variables ad hoc when adding backend code.
- Server startup refuses to run outside tests unless `ADMIN_PASSWORD` and `ADMIN_COOKIE_SECRET` are populated, and it warns when `CLIENT_ORIGIN` is empty in `server/src/index.js`.
- Supabase, speech-to-text, evaluation-provider, limits, media concurrency, cost, and CORS settings are declared in `server/src/config.js`; use this module as the sole backend configuration interface.
- Client build/runtime configuration uses `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `client/src/lib/api.ts` and `client/src/lib/supabase.ts`.
- Environment example files exist at `server/.env.example` and `client/.env.example`; their contents are intentionally not included in this map.

**Build:**
- Next.js: `client/next.config.mjs`.
- TypeScript and `@/*` source alias: `client/tsconfig.json`.
- Tailwind/PostCSS: `client/postcss.config.mjs` and `client/src/app/globals.css`.
- Client test transforms and alias parity: `client/vitest.config.ts`.
- Browser layout test server and Chromium target: `client/playwright.config.ts`.
- Backend engine, scripts, StandardJS, and Jest settings: `server/package.json`.
- Backend process declaration for Railway-style deployment: `server/Procfile`.

## Platform Requirements

**Development:**
- Install Node.js 22+ and npm, then install dependencies independently in `client/` and `server/` as documented in `README.md`.
- Provide a Supabase project with anonymous sign-in, the migration from `server/db/migrations/0001_init.sql`, and a private `videos` Storage bucket for full application behavior described in `README.md`.
- Provide ElevenLabs credentials plus either OpenRouter credentials (default path) or direct Gemini credentials for real evaluation; the conditional full-pipeline check is in `server/scripts/smoke.js`.
- Run the API on port 8080 by default and the Next.js client on port 3000 by default; the client-to-server address comes from `NEXT_PUBLIC_API_BASE_URL` in `client/src/lib/api.ts`.
- Use a browser with camera/microphone access and MediaRecorder support for the recording flow in `client/src/hooks/useRecorder.ts`.

**Production:**
- Deployment target is Railway with two independently rooted services: `server/` runs `npm start`/`server/Procfile`, while `client/` runs the Next.js production build and server, as specified in `README.md`.
- The API expects TLS termination one trusted proxy hop ahead of Express and configures `trust proxy` accordingly in `server/src/app.js`.
- Media processing requires writable operating-system temporary storage during a request; temporary inputs and outputs are removed in `server/src/lib/audio.js`.
- No Dockerfile or infrastructure-as-code deployment manifest is present; runtime and service configuration are conveyed through `README.md`, `server/Procfile`, and platform environment variables consumed by `server/src/config.js`.

---

*Stack analysis: 2026-08-04*

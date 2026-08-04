# Codebase Structure

**Analysis Date:** 2026-08-04

## Directory Layout

```text
Pitchmi_new/
├── .planning/
│   └── codebase/                    # GSD codebase reference documents
├── client/                          # Next.js frontend package and deployable service
│   ├── public/
│   │   └── ads/                     # Browser-served static ad media
│   ├── src/
│   │   ├── app/                     # App Router shell, routes, route tests, dev routes
│   │   │   ├── __tests__/           # Page-level Vitest tests
│   │   │   ├── admin/               # `/admin`
│   │   │   ├── dev/                 # Deterministic browser-test routes
│   │   │   ├── karaoke/             # `/karaoke`
│   │   │   ├── results/             # `/results`
│   │   │   ├── videos/              # `/videos`
│   │   │   └── wait/                # `/wait`
│   │   ├── components/
│   │   │   ├── __tests__/           # Component-level Vitest tests
│   │   │   └── ui/                  # Reusable UI primitives
│   │   ├── hooks/                   # Browser capability hooks
│   │   ├── lib/                     # API clients, wire types, pure helpers
│   │   ├── store/                   # Cross-route Zustand state
│   │   ├── test/                    # Shared test bootstrap
│   │   └── types/                   # Ambient browser type augmentation
│   ├── tests-layout/                 # Playwright browser/layout specifications
│   ├── next.config.mjs              # Next.js configuration
│   ├── playwright.config.ts         # Browser-test configuration
│   ├── vitest.config.ts             # Frontend unit/component test configuration
│   ├── tsconfig.json                # Strict TypeScript and `@/*` alias
│   └── package.json                 # Frontend scripts and dependencies
├── server/                          # Express backend package and deployable service
│   ├── db/
│   │   └── migrations/              # Ordered Supabase SQL migrations
│   ├── scripts/                     # Operator/sample/smoke commands
│   ├── src/
│   │   ├── lib/                     # Domain algorithms and infrastructure adapters
│   │   ├── middleware/              # Cross-cutting Express middleware
│   │   ├── prompts/                 # Model prompt templates
│   │   ├── routes/                  # Resource routers and request orchestration
│   │   ├── app.js                   # Express application factory
│   │   ├── config.js                # Central environment-backed configuration
│   │   └── index.js                 # Process startup and port binding
│   ├── tests/
│   │   ├── fixtures/                # Binary test/smoke media
│   │   └── mocks/                   # Shared server mocks
│   ├── Procfile                     # Railway process declaration
│   └── package.json                 # Backend scripts and dependencies
├── docs/                            # Product specs, status, task log, design evidence
├── CLAUDE.md                        # Repository-specific engineering rules
└── README.md                        # Setup, test, architecture, and deployment overview
```

## Directory Purposes

**Planning Documents (`.planning/`):**
- Purpose: Store GSD planning artifacts and codebase maps consumed by later planning/execution workflows.
- Contains: Architecture, stack, conventions, testing, integrations, concerns, and structure references under `.planning/codebase/`.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

**Frontend Package (`client/`):**
- Purpose: Build and run the browser application as an independent Next.js service.
- Contains: App Router source, public assets, frontend tests/configuration, a separate npm manifest, and a separate npm lockfile.
- Key files: `client/package.json`, `client/package-lock.json`, `client/next.config.mjs`, `client/tsconfig.json`

**App Router (`client/src/app/`):**
- Purpose: Map URLs to screen controllers and define the root document shell and global theme.
- Contains: `layout.tsx`, `page.tsx`, `globals.css`, one directory per product route, page tests, and dev-only dynamic fixture routes.
- Key files: `client/src/app/layout.tsx`, `client/src/app/page.tsx`, `client/src/app/karaoke/page.tsx`, `client/src/app/wait/page.tsx`, `client/src/app/results/page.tsx`, `client/src/app/videos/page.tsx`, `client/src/app/admin/page.tsx`

**Development Routes (`client/src/app/dev/`):**
- Purpose: Expose deterministic render harnesses to real-browser layout and screenshot tests without a live backend or camera.
- Contains: Parameterized routes that render real production components with fixtures.
- Key files: `client/src/app/dev/prompter-layout/[fixture]/page.tsx`, `client/src/app/dev/ui/[screen]/page.tsx`

**Frontend Components (`client/src/components/`):**
- Purpose: Hold reusable product-level views and low-level UI building blocks.
- Contains: Prompter, wait/ad views, component tests, and the `ui/` primitive set.
- Key files: `client/src/components/Prompter.tsx`, `client/src/components/WaitView.tsx`, `client/src/components/AdSlot.tsx`, `client/src/components/ui/VideoPlayer.tsx`, `client/src/components/ui/button.tsx`

**Frontend Hooks (`client/src/hooks/`):**
- Purpose: Isolate browser APIs, timers, animation frames, and cleanup-sensitive capability state from page markup.
- Contains: Recording, karaoke clock, wake lock, and hook tests.
- Key files: `client/src/hooks/useRecorder.ts`, `client/src/hooks/useKaraokeClock.ts`, `client/src/hooks/useWakeLock.ts`

**Frontend Library (`client/src/lib/`):**
- Purpose: Centralize network integration, anonymous identity, shared wire types, pure calculations, localization helpers, and reusable UI utilities.
- Contains: `api.ts`, `supabase.ts`, domain helpers, and colocated pure-function tests under `client/src/lib/__tests__/`.
- Key files: `client/src/lib/api.ts`, `client/src/lib/supabase.ts`, `client/src/lib/clock.ts`, `client/src/lib/estimate.ts`, `client/src/lib/textDir.ts`, `client/src/lib/evalStages.ts`

**Frontend Store (`client/src/store/`):**
- Purpose: Hold ephemeral workflow state shared by `/`, `/karaoke`, `/wait`, and `/results`.
- Contains: One Zustand store with project, script, karaoke path, blob/object URL, and evaluation result.
- Key files: `client/src/store/session.ts`

**Frontend Test Support (`client/src/test/`, `client/src/types/`, `client/tests-layout/`):**
- Purpose: Configure jsdom assertions, augment browser types, and validate layout/geometry in Chromium.
- Contains: Vitest setup, wake-lock type declarations, and Playwright specs.
- Key files: `client/src/test/setup.ts`, `client/src/types/browser.d.ts`, `client/tests-layout/prompter-rtl.spec.ts`, `client/tests-layout/screens.spec.ts`

**Frontend Public Assets (`client/public/`):**
- Purpose: Serve files directly from the Next.js origin.
- Contains: Demo ad media used by the wait screen.
- Key files: `client/public/ads/demo.mp4`

**Backend Package (`server/`):**
- Purpose: Run the privileged HTTP API as an independent Express service.
- Contains: Source, schema, operational scripts, server tests, a separate npm manifest/lockfile, and Railway process declaration.
- Key files: `server/package.json`, `server/package-lock.json`, `server/Procfile`

**Backend Composition (`server/src/`):**
- Purpose: Hold the Express process entry point, application factory, and centralized runtime configuration.
- Contains: `index.js`, `app.js`, `config.js`, and the `routes/`, `middleware/`, `lib/`, and `prompts/` subdirectories.
- Key files: `server/src/index.js`, `server/src/app.js`, `server/src/config.js`

**Backend Routes (`server/src/routes/`):**
- Purpose: Define API resources, validate HTTP inputs, authorize resources, orchestrate use cases, and format responses.
- Contains: One CommonJS router module per resource or operational surface.
- Key files: `server/src/routes/projects.js`, `server/src/routes/script.js`, `server/src/routes/evaluate.js`, `server/src/routes/save.js`, `server/src/routes/takes.js`, `server/src/routes/admin.js`

**Backend Middleware (`server/src/middleware/`):**
- Purpose: Implement reusable request gates and transport policies.
- Contains: User/admin authentication, upload buffering, per-IP rate limiting, database kill switch, and surge protection.
- Key files: `server/src/middleware/auth.js`, `server/src/middleware/admin.js`, `server/src/middleware/upload.js`, `server/src/middleware/rateLimit.js`, `server/src/middleware/killSwitch.js`, `server/src/middleware/surge.js`

**Backend Library (`server/src/lib/`):**
- Purpose: Keep domain algorithms and external infrastructure adapters out of route modules.
- Contains: Text/subtitle/scoring/path functions, media processing, provider calls, database access, capacity control, and result combination.
- Key files: `server/src/lib/db.js`, `server/src/lib/audio.js`, `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, `server/src/lib/score.js`, `server/src/lib/scriptPath.js`, `server/src/lib/jobLimiter.js`

**Model Prompts (`server/src/prompts/`):**
- Purpose: Keep model instructions as reviewable, versioned text separate from provider transport code.
- Contains: The evaluation prompt template loaded by `server/src/lib/evaluate.js`.
- Key files: `server/src/prompts/eval.md`

**Database Migrations (`server/db/migrations/`):**
- Purpose: Define ordered, manually applied Supabase schema and RLS changes.
- Contains: Numeric-prefix SQL migrations.
- Key files: `server/db/migrations/0001_init.sql`

**Backend Scripts (`server/scripts/`):**
- Purpose: Support sample generation and external-provider smoke validation outside the HTTP process.
- Contains: Executable Node scripts referenced by `server/package.json`.
- Key files: `server/scripts/make-sample.js`, `server/scripts/smoke.js`

**Backend Tests (`server/tests/`):**
- Purpose: Validate HTTP behavior, middleware, provider adapters, media guards, domain algorithms, and cost/timing behavior.
- Contains: Jest/Supertest tests, shared helpers, a database mock, and sample media.
- Key files: `server/tests/helpers.js`, `server/tests/mocks/db.js`, `server/tests/fixtures/sample.mp4`, `server/tests/api.evaluate.test.js`

**Project Documentation (`docs/`):**
- Purpose: Record product specifications, implementation status, design direction, task state, and visual reference output.
- Contains: `docs/STATUS.md`, `docs/TASKS.md`, goal/spec documents, `docs/design-direction.md`, and screenshots under `docs/ui/`.
- Key files: `docs/STATUS.md`, `docs/TASKS.md`, `docs/pitchmi-v2-spec.md`, `docs/design-direction.md`

## Key File Locations

**Entry Points:**
- `client/src/app/layout.tsx`: Root Next.js document, fonts, metadata, viewport, and global body styling.
- `client/src/app/page.tsx`: Text-first product entry route and project/script creation controller.
- `client/src/app/karaoke/page.tsx`: Camera, countdown, prompter, and recording route.
- `client/src/app/wait/page.tsx`: Long-running evaluation request and wait/ad state route.
- `client/src/app/results/page.tsx`: Playback, scoring, coaching, retry/edit/reset/share route.
- `client/src/app/videos/page.tsx`: RLS-backed saved-take listing/deletion and signed playback route.
- `client/src/app/admin/page.tsx`: Cookie-authenticated operational UI.
- `server/src/index.js`: Express process startup and listener binding.
- `server/src/app.js`: Express application factory and ordered route/middleware graph.

**Configuration:**
- `client/package.json`: Frontend runtime, build, unit-test, and browser-test commands.
- `client/next.config.mjs`: Next.js runtime configuration.
- `client/tsconfig.json`: Strict TypeScript, bundler resolution, and `@/*` alias.
- `client/vitest.config.ts`: jsdom unit/component test discovery and alias.
- `client/playwright.config.ts`: Chromium layout test server and viewport.
- `client/postcss.config.mjs`: Tailwind/PostCSS build integration.
- `client/.env.example`: Environment configuration example exists; do not place real values in committed files.
- `server/package.json`: Backend runtime, test, lint, sample, and smoke commands.
- `server/src/config.js`: Single runtime configuration object read from the process environment.
- `server/Procfile`: Railway process command.
- `server/.env.example`: Environment configuration example exists; do not place real values in committed files.

**Core Logic:**
- `client/src/lib/api.ts`: Typed Express HTTP client, error envelope handling, wire contracts, and evaluation timeout.
- `client/src/lib/supabase.ts`: Lazy browser Supabase client and anonymous session establishment.
- `client/src/store/session.ts`: Cross-route workflow state and blob URL lifecycle.
- `client/src/hooks/useRecorder.ts`: MediaRecorder lifecycle and camera/microphone cleanup.
- `client/src/components/Prompter.tsx`: Timed subtitle presentation.
- `server/src/routes/evaluate.js`: End-to-end evaluation orchestrator.
- `server/src/lib/scriptPath.js`: Seed timing and measured re-timing of typed scripts.
- `server/src/lib/score.js`: Alignment, accuracy, timing, drift, and flags.
- `server/src/lib/audio.js`: Container verification, ffmpeg extraction/transcoding, duration probing, and temp cleanup.
- `server/src/lib/evaluate.js`: OpenRouter/Gemini provider selection, retry/deadline logic, and strict result parsing.
- `server/src/lib/db.js`: Privileged Supabase database and Storage gateway.
- `server/db/migrations/0001_init.sql`: Tables, indexes, RLS, and service switch.

**Testing:**
- `client/src/app/__tests__/`: Page workflow tests.
- `client/src/components/__tests__/`: Component behavior tests.
- `client/src/hooks/__tests__/`: Browser-hook lifecycle tests.
- `client/src/lib/__tests__/`: Pure helper/API transport/theme-contract tests.
- `client/tests-layout/`: Playwright layout, viewport, screenshot, mirror-alignment, and RTL checks.
- `server/tests/`: Jest/Supertest API, middleware, media, provider, and domain tests.
- `server/scripts/smoke.js`: Real-provider pipeline smoke command outside CI.

## Naming Conventions

**Files:**
- Use Next.js reserved lowercase names for route entry files: `client/src/app/layout.tsx` and each `client/src/app/**/page.tsx`.
- Use PascalCase for product React component files and matching named exports, as in `client/src/components/Prompter.tsx`, `client/src/components/WaitView.tsx`, and `client/src/components/ui/VideoPlayer.tsx`.
- Use lowercase primitive filenames for shadcn-style UI building blocks, as in `client/src/components/ui/button.tsx`, `client/src/components/ui/badge.tsx`, and `client/src/components/ui/card.tsx`.
- Prefix React hook modules with `use` and use camel case, as in `client/src/hooks/useRecorder.ts`, `client/src/hooks/useKaraokeClock.ts`, and `client/src/hooks/useWakeLock.ts`.
- Use short lower-camel or lowercase domain filenames for client helpers, as in `client/src/lib/evalStages.ts`, `client/src/lib/recorderConstraints.ts`, and `client/src/lib/textDir.ts`.
- Use lowercase resource nouns for Express routers, as in `server/src/routes/projects.js`, `server/src/routes/script.js`, and `server/src/routes/takes.js`.
- Use lower-camel names where a server module describes a compound abstraction, as in `server/src/lib/jobLimiter.js` and `server/src/lib/scriptPath.js`; use simple nouns for focused modules such as `server/src/lib/audio.js` and `server/src/lib/score.js`.
- Use four-digit ordered prefixes for schema migrations, as in `server/db/migrations/0001_init.sql`.
- Use `.test.ts`/`.test.tsx` for colocated frontend tests under `client/src/**/__tests__/`, `.spec.ts` for Playwright files under `client/tests-layout/`, and `.test.js` for Jest files under `server/tests/`.

**Directories:**
- Use lowercase route segments under `client/src/app/`, as in `client/src/app/karaoke/`, `client/src/app/results/`, and `client/src/app/videos/`.
- Use bracketed dynamic segment directories for App Router fixtures, as in `client/src/app/dev/ui/[screen]/` and `client/src/app/dev/prompter-layout/[fixture]/`.
- Use role-based plural directories in the server package: `server/src/routes/`, `server/src/middleware/`, `server/src/prompts/`, and `server/tests/`; use `server/src/lib/` for both domain and infrastructure modules.
- Use `__tests__/` beside the frontend concern under test, as in `client/src/lib/__tests__/` and `client/src/components/__tests__/`.

## Where to Add New Code

**New Client Feature:**
- Primary code: Add a route controller at `client/src/app/<route>/page.tsx`; keep browser-interactive route files as Client Components when they use hooks, browser APIs, Zustand, or `next/navigation`.
- Shared presentation: Add domain-level reusable views to `client/src/components/<ComponentName>.tsx`; compose existing primitives from `client/src/components/ui/`.
- Cross-route state: Extend `client/src/store/session.ts` only when state must survive navigation between App Router pages; keep route-only state inside `client/src/app/<route>/page.tsx`.
- Server communication: Add typed request/response contracts and the fetch function to `client/src/lib/api.ts`.
- Browser capability: Add cleanup-sensitive browser behavior to `client/src/hooks/use<Name>.ts`, backed by pure calculations in `client/src/lib/` when possible.
- Tests: Add page tests under `client/src/app/__tests__/`, component tests under `client/src/components/__tests__/`, hook tests under `client/src/hooks/__tests__/`, or pure helper/API tests under `client/src/lib/__tests__/`.

**New API Endpoint:**
- Router: Add `server/src/routes/<resource>.js` with request validation, authorization, orchestration, and response mapping.
- Mount: Require and mount the router at the correct public/admin/gated position in `server/src/app.js`.
- Authentication/gates: Reuse `server/src/middleware/auth.js`, `server/src/middleware/admin.js`, `server/src/middleware/rateLimit.js`, and `server/src/middleware/upload.js` rather than duplicating checks in the handler.
- Persistence: Add privileged database or Storage calls to `server/src/lib/db.js`; perform owner lookups before privileged mutations in `server/src/routes/<resource>.js`.
- Tests: Add HTTP coverage in `server/tests/api.<resource>.test.js` using the app factory from `server/src/app.js` and shared helpers from `server/tests/helpers.js`.

**New Server Component/Module:**
- Pure domain transformation: Add `server/src/lib/<concept>.js`; keep it free of HTTP and persistence when the behavior is an algorithm.
- External provider adapter: Add `server/src/lib/<provider-or-capability>.js`; normalize provider-specific responses before returning to `server/src/routes/`.
- Cross-cutting request concern: Add `server/src/middleware/<concern>.js` and mount it centrally in `server/src/app.js` or explicitly on the resource router.
- Model prompt: Add or update versioned prompt text under `server/src/prompts/`, loaded from the corresponding adapter in `server/src/lib/`.
- Capacity-sensitive media work: Route ffmpeg work through `server/src/lib/jobLimiter.js` and implement temp-file cleanup in `server/src/lib/audio.js` or the new adapter.

**New Data Model Change:**
- Migration: Add the next ordered SQL file under `server/db/migrations/`; do not rewrite deployed schema intent only in `server/db/migrations/0001_init.sql`.
- Data access: Add matching operations to `server/src/lib/db.js`.
- Client direct access: Add direct Supabase access only for owner-scoped data protected by policies under `server/db/migrations/`; keep service-role operations and writes involving secrets in `server/src/lib/db.js`.

**New Component/Module:**
- Implementation: Place product-specific React components in `client/src/components/` and general UI primitives in `client/src/components/ui/`.
- Tests: Mirror the component name under `client/src/components/__tests__/`, as in `client/src/components/__tests__/Prompter.test.tsx`.

**Utilities:**
- Shared client helpers: Place pure browser-independent calculations in `client/src/lib/` and colocate their tests in `client/src/lib/__tests__/`.
- Shared server helpers: Place domain functions and infrastructure adapters in `server/src/lib/`; keep route-specific request parsing in `server/src/routes/`.

## Special Directories

**`client/.next/`:**
- Purpose: Store generated Next.js build/dev output.
- Generated: Yes, by commands from `client/package.json`.
- Committed: No; ignored by `.gitignore`.

**`client/node_modules/` and `server/node_modules/`:**
- Purpose: Store separately installed dependencies for each deployable package.
- Generated: Yes, from `client/package-lock.json` and `server/package-lock.json`.
- Committed: No; ignored by `.gitignore`.

**`client/test-results/`, `client/playwright-report/`, and `client/blob-report/`:**
- Purpose: Store generated Playwright run artifacts.
- Generated: Yes, by the browser tests configured in `client/playwright.config.ts`.
- Committed: No; ignored by `.gitignore`.

**`client/src/app/dev/`:**
- Purpose: Expose deterministic pages for real-browser visual and geometry validation.
- Generated: No; source lives in `client/src/app/dev/prompter-layout/[fixture]/page.tsx` and `client/src/app/dev/ui/[screen]/page.tsx`.
- Committed: Yes; the routes are versioned with application source and are not linked by production UI.

**`client/public/`:**
- Purpose: Serve static browser assets from the frontend origin.
- Generated: No; `client/public/ads/demo.mp4` is source media.
- Committed: Yes; `client/public/ads/demo.mp4` is versioned.

**`server/src/prompts/`:**
- Purpose: Hold server-only prompt templates loaded at runtime.
- Generated: No; `server/src/prompts/eval.md` is authored source.
- Committed: Yes; `server/src/prompts/eval.md` is versioned.

**`server/tests/fixtures/`:**
- Purpose: Hold deterministic binary inputs for server tests and smoke scripts.
- Generated: No for the checked-in fixture used by `server/scripts/smoke.js`; `server/scripts/make-sample.js` is the regeneration utility.
- Committed: Yes; `server/tests/fixtures/sample.mp4` is versioned.

**`docs/ui/`:**
- Purpose: Store visual regression/reference screenshots used by the release UI documentation.
- Generated: Yes, by the browser screenshot workflow described through `client/tests-layout/screens.spec.ts` and `docs/STATUS.md`.
- Committed: Yes; the PNG reference set under `docs/ui/` is versioned.

**`.planning/codebase/`:**
- Purpose: Store generated GSD maps used by planning and execution commands.
- Generated: Yes, by the codebase-mapping workflow.
- Committed: Intended as project planning source; files such as `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/STRUCTURE.md` are not excluded by `.gitignore`.

---

*Structure analysis: 2026-08-04*

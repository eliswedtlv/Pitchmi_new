# Architecture

**Analysis Date:** 2026-08-04

## Pattern Overview

**Overall:** Split-deployable monorepo with a client-heavy Next.js App Router application and a layered Express API.

**Key Characteristics:**
- `client/` and `server/` are independent Node applications with separate manifests, lockfiles, build commands, and Railway service roots; `README.md`, `client/package.json`, and `server/package.json` define this boundary.
- `client/src/app/` behaves as a browser-side workflow application: interactive route pages are Client Components, navigation is performed with `next/navigation`, and cross-screen state lives in `client/src/store/session.ts`.
- `server/src/app.js` is the HTTP composition root; it mounts public routes, the independently authenticated admin surface, global operational gates, authenticated feature routes, a scoped 404, and the terminal error handler in explicit order.
- `server/src/routes/` owns HTTP validation and use-case orchestration, while reusable algorithms and external-provider adapters live in `server/src/lib/`; the evaluation pipeline in `server/src/routes/evaluate.js` is the principal orchestration path.
- Supabase forms the persistence and identity plane: privileged database and Storage work is centralized in `server/src/lib/db.js`, while `client/src/lib/supabase.ts` uses the anonymous client for sign-in and the RLS-protected operations in `client/src/app/videos/page.tsx`.
- Uploaded video is ephemeral by default: `server/src/middleware/upload.js` buffers media in memory, `server/src/lib/audio.js` uses UUID-named OS temp files and removes them in `finally`, and only `server/src/routes/save.js` persists bytes to Supabase Storage.
- No Next.js route handlers or server actions exist under `client/src/app/`; all product API calls cross the HTTP boundary through `client/src/lib/api.ts` to `server/src/app.js`.

## Layers

**Next.js App Shell and Route Layer:**
- Purpose: Define URL entry points, own screen-level effects, guard workflow prerequisites, and coordinate navigation.
- Location: `client/src/app/`
- Contains: The server-rendered root shell in `client/src/app/layout.tsx`; interactive pages in `client/src/app/page.tsx`, `client/src/app/karaoke/page.tsx`, `client/src/app/wait/page.tsx`, `client/src/app/results/page.tsx`, `client/src/app/videos/page.tsx`, and `client/src/app/admin/page.tsx`; browser-test fixtures in `client/src/app/dev/`.
- Depends on: UI components in `client/src/components/`, browser hooks in `client/src/hooks/`, client integrations and pure helpers in `client/src/lib/`, and workflow state in `client/src/store/session.ts`.
- Used by: Next.js App Router through the reserved `layout.tsx` and `page.tsx` files under `client/src/app/`.

**Client Presentation Layer:**
- Purpose: Render reusable visual objects without owning route navigation or backend workflow sequencing.
- Location: `client/src/components/`
- Contains: Product components such as `client/src/components/Prompter.tsx`, `client/src/components/WaitView.tsx`, and `client/src/components/AdSlot.tsx`, plus UI primitives in `client/src/components/ui/`.
- Depends on: Shared types and helpers in `client/src/lib/`; primitives use the class-merging helper in `client/src/lib/utils.ts`.
- Used by: Route pages in `client/src/app/` and dev fixtures in `client/src/app/dev/`.

**Browser Capability Hooks:**
- Purpose: Encapsulate stateful browser APIs and their cleanup lifecycles.
- Location: `client/src/hooks/`
- Contains: Media capture in `client/src/hooks/useRecorder.ts`, animation-frame karaoke timing in `client/src/hooks/useKaraokeClock.ts`, and screen wake-lock management in `client/src/hooks/useWakeLock.ts`.
- Depends on: Browser APIs and small pure helpers such as `client/src/lib/recorderConstraints.ts`, `client/src/lib/clock.ts`, and `client/src/lib/limits.ts`.
- Used by: The recording flow in `client/src/app/karaoke/page.tsx` and the long-running evaluation flow in `client/src/app/wait/page.tsx`.

**Client Integration and Domain Layer:**
- Purpose: Provide the typed HTTP boundary, anonymous Supabase client, and pure presentation-domain calculations.
- Location: `client/src/lib/`
- Contains: Express API calls and wire types in `client/src/lib/api.ts`, anonymous identity and direct RLS client access in `client/src/lib/supabase.ts`, and pure helpers for time, direction, estimates, evaluation stages, recorder constraints, strings, and class names in the other `client/src/lib/*.ts` files.
- Depends on: Browser `fetch`, `FormData`, Supabase JS, and environment-provided public configuration as read in `client/src/lib/api.ts` and `client/src/lib/supabase.ts`.
- Used by: Route pages, hooks, components, and the store throughout `client/src/`.

**Client Workflow State Layer:**
- Purpose: Preserve one recording workflow across client-side route transitions without persisting media or results to browser storage.
- Location: `client/src/store/session.ts`
- Contains: Project, typed script, karaoke path, recorded `Blob`, object URL, and evaluation result, plus setters and a full reset.
- Depends on: Wire/domain types exported from `client/src/lib/api.ts` and browser object-URL APIs.
- Used by: `client/src/app/page.tsx`, `client/src/app/karaoke/page.tsx`, `client/src/app/wait/page.tsx`, `client/src/app/results/page.tsx`, and the results fixture in `client/src/app/dev/ui/[screen]/page.tsx`.

**Express Composition and Transport Layer:**
- Purpose: Configure process-wide HTTP behavior and compose resource routers.
- Location: `server/src/index.js` and `server/src/app.js`
- Contains: Startup validation and port binding in `server/src/index.js`; CORS, signed cookies, JSON parsing, ordered router mounting, scoped 404 handling, and global error mapping in `server/src/app.js`.
- Depends on: Central configuration in `server/src/config.js`, middleware in `server/src/middleware/`, routers in `server/src/routes/`, and operational logging through `server/src/lib/db.js`.
- Used by: Railway via `server/Procfile` and `server/package.json`, and integration tests that construct the app directly from `server/src/app.js`.

**HTTP Use-Case Layer:**
- Purpose: Validate request shapes, enforce resource ownership, invoke domain/infrastructure modules, and shape JSON responses.
- Location: `server/src/routes/`
- Contains: Public health/ad handlers, project/script/evaluate/save/take handlers, and admin login/log/aggregate/service handlers in the corresponding files under `server/src/routes/`.
- Depends on: Route-scoped middleware from `server/src/middleware/`, persistence through `server/src/lib/db.js`, and domain/provider functions from `server/src/lib/`.
- Used by: The router mount sequence in `server/src/app.js`.

**Cross-Cutting Middleware Layer:**
- Purpose: Apply identity, admin authorization, multipart admission, per-IP rate limits, service availability, and surge protection.
- Location: `server/src/middleware/`
- Contains: Supabase JWT verification in `server/src/middleware/auth.js`, signed-cookie admin authorization in `server/src/middleware/admin.js`, memory-buffered uploads in `server/src/middleware/upload.js`, process-local counters in `server/src/middleware/rateLimit.js` and `server/src/middleware/surge.js`, and the database-backed service switch in `server/src/middleware/killSwitch.js`.
- Depends on: `server/src/config.js`, `server/src/lib/db.js`, Supabase JWKS, and Express middleware contracts.
- Used by: The global mount sequence in `server/src/app.js` and individual routers under `server/src/routes/`.

**Server Domain and Infrastructure Layer:**
- Purpose: Implement media processing, speech-to-text, scoring, karaoke path generation, AI evaluation, result combination, persistence, and capacity control.
- Location: `server/src/lib/`
- Contains: Pure algorithms in `server/src/lib/text.js`, `server/src/lib/fillers.js`, `server/src/lib/subtitles.js`, `server/src/lib/score.js`, `server/src/lib/scriptPath.js`, and `server/src/lib/combine.js`; infrastructure adapters in `server/src/lib/audio.js`, `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, and `server/src/lib/db.js`; the process-local media semaphore in `server/src/lib/jobLimiter.js`.
- Depends on: Central configuration in `server/src/config.js`, the prompt in `server/src/prompts/eval.md`, ffmpeg-static, Supabase, ElevenLabs, and OpenRouter or Gemini.
- Used by: Resource handlers in `server/src/routes/` and focused unit tests in `server/tests/`.

**Persistence Schema Layer:**
- Purpose: Define Supabase tables, indexes, RLS policies, and the private-video storage contract.
- Location: `server/db/migrations/0001_init.sql`
- Contains: `projects`, `saved_takes`, `events`, and `app_settings`, owner-only RLS policies for user data, and service-role-only access for operational tables.
- Depends on: Supabase Auth identities referenced by `auth.users` in `server/db/migrations/0001_init.sql`.
- Used by: `server/src/lib/db.js` and the direct RLS queries in `client/src/app/videos/page.tsx`.

## Data Flow

**Typed Script to First Rehearsal:**

1. `client/src/app/page.tsx` holds the draft in local React state, estimates its duration with `client/src/lib/estimate.ts`, and reads any prior draft from `client/src/store/session.ts`.
2. `client/src/lib/api.ts#createProject` calls `POST /api/projects`; `client/src/lib/supabase.ts#ensureAuth` creates or reuses an anonymous Supabase session and supplies the bearer token.
3. `server/src/routes/projects.js` verifies the token through `server/src/middleware/auth.js` and creates an owner-scoped project through `server/src/lib/db.js`.
4. `client/src/lib/api.ts#saveScript` sends the project id and script text to `POST /api/script`.
5. `server/src/routes/script.js` validates ownership and length, builds a disposable timed path with `server/src/lib/scriptPath.js#buildSeedPath`, and writes both script and path through `server/src/lib/db.js`.
6. `client/src/app/page.tsx` places the project, source script, and returned path in `client/src/store/session.ts`, then navigates to `client/src/app/karaoke/page.tsx`.

**Camera Recording and Evaluation:**

1. `client/src/app/karaoke/page.tsx` requires project and path state from `client/src/store/session.ts`, then starts `client/src/hooks/useRecorder.ts`.
2. `client/src/hooks/useRecorder.ts` obtains camera/microphone access, runs a three-second countdown, records with `MediaRecorder`, enforces the duration ceiling, stops tracks during cleanup, and emits a `Blob`.
3. `client/src/app/karaoke/page.tsx` stores the `Blob` through `client/src/store/session.ts`, which also owns the revocable object URL, and navigates to `client/src/app/wait/page.tsx`.
4. `client/src/app/wait/page.tsx` keeps the device awake, optionally fetches `/api/ad`, and calls `client/src/lib/api.ts#evaluateVideo`; the API client sends multipart media with a bearer token and a five-minute `AbortController` timeout.
5. `server/src/app.js` applies CORS and parsing, then the `/api` kill switch and surge guard; `server/src/routes/evaluate.js` additionally applies the per-IP evaluation limit, Supabase JWT auth, and memory-backed multipart upload middleware.
6. `server/src/routes/evaluate.js` enforces the daily user quota and project ownership through `server/src/lib/db.js`.
7. `server/src/lib/jobLimiter.js` admits `server/src/lib/audio.js#extractAudio`; ffmpeg validates the real container, extracts mono audio to temporary files, derives duration, and cleans the files.
8. `server/src/lib/scribe.js` sends audio to ElevenLabs Scribe and normalizes language plus word-level timestamps.
9. `server/src/lib/score.js` scores accuracy and relative timing against the path followed during the take; `server/src/lib/scriptPath.js#buildPathFromScript` aligns the spoken words to the stored script and, above the configured coverage threshold, `server/src/routes/evaluate.js` persists the re-timed path.
10. A second `server/src/lib/jobLimiter.js` admission lets `server/src/lib/audio.js#transcodeForEval` create the compact MP4 proxy used by the delivery model.
11. `server/src/lib/evaluate.js` evaluates the proxy through OpenRouter/Vertex or direct Gemini, bounds each upstream call and the overall deadline, retries transport or JSON-shape failures in their separate loops, and validates scores/comments.
12. `server/src/lib/combine.js` combines AI delivery scores with objective timing/accuracy; `server/src/routes/evaluate.js` logs metadata and costs through `server/src/lib/db.js` and returns the result plus the re-timed path when trusted.
13. `client/src/app/wait/page.tsx` stores the result and optional new path in `client/src/store/session.ts`, then `client/src/app/results/page.tsx` renders playback, scores, feedback, retry/edit/reset/share actions from that state.

**Explicit Saved-Video Flow:**

1. `client/src/lib/api.ts#saveTake` defines multipart submission to `POST /api/save`; no route page under `client/src/app/` calls it, so the primary results flow in `client/src/app/results/page.tsx` shares or downloads locally.
2. When invoked, `server/src/routes/save.js` applies rate limiting, bearer authentication, in-memory upload parsing, and project ownership before calling `server/src/lib/db.js#uploadVideo` and `server/src/lib/db.js#insertSavedTake`.
3. `client/src/app/videos/page.tsx` reads and deletes `saved_takes` directly with the anonymous Supabase client from `client/src/lib/supabase.ts`; owner-only RLS in `server/db/migrations/0001_init.sql` protects those calls.
4. Playback in `client/src/app/videos/page.tsx` calls `client/src/lib/api.ts#getTakeUrl`; `server/src/routes/takes.js` rechecks ownership and `server/src/lib/db.js` mints a one-hour signed Storage URL.

**Admin Operations:**

1. `client/src/app/admin/page.tsx` posts a password through `client/src/lib/api.ts#adminLogin` with credentialed CORS.
2. `server/src/routes/admin.js` rate-limits the login, performs a constant-time digest comparison, logs outcome-only metadata, and sets a signed `httpOnly`, `Secure`, `SameSite=None` cookie.
3. `server/src/middleware/admin.js` protects logs, aggregates, and service-switch endpoints in `server/src/routes/admin.js`.
4. Admin routing is mounted before `server/src/middleware/killSwitch.js` and `server/src/middleware/surge.js` in `server/src/app.js`, so the admin surface remains available to re-arm a paused service.

**State Management:**
- Route-local UI state uses React hooks inside pages such as `client/src/app/page.tsx`, `client/src/app/wait/page.tsx`, and `client/src/app/admin/page.tsx`.
- Cross-route workflow state is a non-persisted Zustand singleton in `client/src/store/session.ts`; browser refresh or a new tab loses the active project/path/blob/result workflow and page guards redirect to `/`.
- Recorded bytes stay in the browser as a `Blob`; `client/src/store/session.ts` creates one object URL per active blob and revokes the prior URL on replacement or reset.
- Durable domain and operational state lives in Supabase tables defined by `server/db/migrations/0001_init.sql`, accessed through `server/src/lib/db.js` or owner-scoped direct client queries in `client/src/app/videos/page.tsx`.
- Rate-limit stores, the surge window, and media semaphore counters are process-local in `server/src/middleware/rateLimit.js`, `server/src/middleware/surge.js`, and `server/src/lib/jobLimiter.js`.
- Media-processing files are short-lived OS-temp artifacts created and removed by `server/src/lib/audio.js`; request uploads are memory buffers owned by `server/src/middleware/upload.js`.

## Key Abstractions

**Typed API Boundary:**
- Purpose: Centralize Express base URL selection, anonymous bearer acquisition, response error normalization, wire contracts, multipart creation, timeouts, and admin cookie credentials.
- Examples: `client/src/lib/api.ts`, `client/src/lib/supabase.ts`
- Pattern: Use exported API functions from `client/src/lib/api.ts`; do not place product `fetch` calls directly in route components.

**Session Workflow Store:**
- Purpose: Carry the project, source script, timed path, take blob, playback URL, and evaluation result through the route sequence.
- Examples: `client/src/store/session.ts`, `client/src/app/page.tsx`, `client/src/app/wait/page.tsx`
- Pattern: Put only cross-screen workflow state in `client/src/store/session.ts`; keep display-only state in the owning route/component and revoke blob URLs when replacing media.

**Karaoke Path Contract:**
- Purpose: Represent the script as timed words and lines used by the prompter, objective scoring, and re-timing.
- Examples: Types in `client/src/lib/api.ts`, rendering in `client/src/components/Prompter.tsx`, generation in `server/src/lib/scriptPath.js` and `server/src/lib/subtitles.js`, persistence in `server/db/migrations/0001_init.sql`
- Pattern: Preserve the `{ words, lines, total_s }` JSON shape and monotonic `t_start` ordering across server algorithms, database values, and client rendering.

**Database Gateway:**
- Purpose: Keep service-role credentials and privileged Supabase operations behind one mockable module.
- Examples: `server/src/lib/db.js`, `server/tests/mocks/db.js`
- Pattern: Add privileged database or Storage operations to `server/src/lib/db.js`; keep route modules responsible for authorization and response shaping.

**Ordered Middleware Pipeline:**
- Purpose: Make public availability, admin recoverability, operational gates, route identity, upload limits, and spend limits explicit.
- Examples: `server/src/app.js`, `server/src/middleware/auth.js`, `server/src/middleware/upload.js`, `server/src/middleware/rateLimit.js`
- Pattern: Preserve mount order in `server/src/app.js`; attach route-specific middleware in the order required by each router under `server/src/routes/`.

**Pure Speech/Karaoke Domain Functions:**
- Purpose: Transform text and word timestamps without I/O so scoring and prompter behavior remain testable.
- Examples: `server/src/lib/text.js`, `server/src/lib/subtitles.js`, `server/src/lib/score.js`, `server/src/lib/scriptPath.js`, `server/src/lib/combine.js`
- Pattern: Keep text normalization, alignment, subtitle construction, and score combination pure; orchestrate persistence and external calls from `server/src/routes/`.

**Provider Adapters:**
- Purpose: Normalize ElevenLabs transcription and OpenRouter/Gemini evaluation into stable internal results.
- Examples: `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, `server/src/prompts/eval.md`
- Pattern: Bound external calls with deadlines, validate response shapes before returning, and expose provider-independent objects to `server/src/routes/evaluate.js`.

**Media Admission and Processing:**
- Purpose: Bound ffmpeg concurrency, validate media containers from bytes, create task-specific artifacts, and guarantee cleanup.
- Examples: `server/src/lib/jobLimiter.js`, `server/src/lib/audio.js`, `server/src/middleware/upload.js`
- Pattern: Wrap each ffmpeg section with `runMedia` from `server/src/lib/jobLimiter.js`; use `finally` cleanup and never retain the upload outside the request unless `server/src/routes/save.js` is explicitly invoked.

## Entry Points

**Next.js Root Layout:**
- Location: `client/src/app/layout.tsx`
- Triggers: Every client route rendered by Next.js App Router.
- Responsibilities: Load global styles, self-host Latin/Hebrew fonts, define metadata and viewport behavior, and provide the root canvas/body.

**Product Route Entry Points:**
- Location: `client/src/app/page.tsx`, `client/src/app/karaoke/page.tsx`, `client/src/app/wait/page.tsx`, `client/src/app/results/page.tsx`, `client/src/app/videos/page.tsx`, `client/src/app/admin/page.tsx`
- Triggers: Browser navigation to `/`, `/karaoke`, `/wait`, `/results`, `/videos`, and `/admin`.
- Responsibilities: Coordinate each screen, enforce workflow prerequisites, call shared hooks/API functions, update `client/src/store/session.ts`, and navigate to the next route.

**Browser-Only Fixture Entry Points:**
- Location: `client/src/app/dev/prompter-layout/[fixture]/page.tsx`, `client/src/app/dev/ui/[screen]/page.tsx`
- Triggers: Playwright/dev navigation to the parameterized `/dev/*` routes.
- Responsibilities: Render real components against deterministic fixture state for browser geometry and screenshot validation.

**Express Process Entry Point:**
- Location: `server/src/index.js`
- Triggers: `npm start`, `npm run dev`, or the Railway process declared in `server/Procfile`.
- Responsibilities: Validate required admin configuration outside tests, warn when cross-origin client access is closed, create the app, and listen on the configured port.

**Express Application Factory:**
- Location: `server/src/app.js`
- Triggers: `server/src/index.js` in production/development and Supertest setup through `server/tests/helpers.js`.
- Responsibilities: Construct the middleware/router graph without binding a port, enabling isolated integration tests.

**Database Bootstrap:**
- Location: `server/db/migrations/0001_init.sql`
- Triggers: Manual migration application to the Supabase project as documented in `README.md`.
- Responsibilities: Create the relational model, indexes, RLS policies, service switch seed, and private-bucket contract.

**External Smoke Entry Point:**
- Location: `server/scripts/smoke.js`
- Triggers: The `smoke` script in `server/package.json` when provider configuration is available.
- Responsibilities: Exercise the assembled external speech/evaluation pipeline against `server/tests/fixtures/sample.mp4`.

## Error Handling

**Strategy:** Normalize expected failures at the closest boundary, return machine-readable JSON from Express, throw enriched errors from the client API wrapper, and let each route page choose the user-facing state.

**Patterns:**
- `client/src/lib/api.ts#handleResponse` parses non-2xx JSON and throws an `Error` augmented with `status` and `body`; localized object messages are reduced to stable display text by `client/src/lib/api.ts#errorMessage`.
- `client/src/app/page.tsx`, `client/src/app/wait/page.tsx`, `client/src/app/videos/page.tsx`, and `client/src/app/admin/page.tsx` catch integration failures into local UI state; workflow prerequisite effects redirect to `/` in `client/src/app/karaoke/page.tsx`, `client/src/app/wait/page.tsx`, and `client/src/app/results/page.tsx`.
- `server/src/routes/projects.js`, `server/src/routes/script.js`, `server/src/routes/save.js`, `server/src/routes/takes.js`, and admin handlers return explicit 4xx responses for validation/ownership failures and delegate unexpected errors with `next(err)`.
- `server/src/routes/evaluate.js` owns its full error mapping because it must log stage timing metadata exactly once; it maps provider timeout, full media queue, invalid media, size limits, quota, and unknown failures itself.
- `server/src/app.js#errorHandler` maps upload size, unsupported media, and busy errors, logs unhandled 5xx failures through `server/src/lib/db.js`, and returns a consistent JSON envelope.
- `server/src/lib/db.js#logEvent` deliberately swallows logging failures so observability cannot fail a product request.
- Cleanup uses `finally` or effect cleanup in `server/src/lib/audio.js`, `server/src/lib/jobLimiter.js`, `client/src/hooks/useRecorder.ts`, `client/src/hooks/useWakeLock.ts`, and `client/src/store/session.ts`.

## Cross-Cutting Concerns

**Logging:** Write metadata-only operational events through `server/src/lib/db.js#logEvent`; evaluation success/failure timing and cost originate in `server/src/routes/evaluate.js`, rate/surge/admin events originate in their middleware or route files, and `server/src/routes/admin.js` reads/aggregates those rows.

**Validation:** Validate request bodies and ownership in `server/src/routes/`, declared multipart type/size in `server/src/middleware/upload.js`, actual container magic and ffmpeg protocol constraints in `server/src/lib/audio.js`, external model shape in `server/src/lib/evaluate.js`, and database ownership through RLS in `server/db/migrations/0001_init.sql`.

**Authentication:** Use anonymous Supabase sessions from `client/src/lib/supabase.ts`; verify asymmetric JWKS or legacy HS256 JWTs in `server/src/middleware/auth.js`; protect admin operations with the signed cookie created in `server/src/routes/admin.js` and checked by `server/src/middleware/admin.js`.

**Privacy:** Keep media memory/temp-only in `server/src/middleware/upload.js` and `server/src/lib/audio.js`; persist video only through `server/src/routes/save.js`; keep operational events free of transcript, comments, raw model text, password, and IP content in `server/src/routes/evaluate.js`, `server/src/lib/evaluate.js`, `server/src/middleware/rateLimit.js`, and `server/src/routes/admin.js`.

**Capacity and Spend Control:** Apply per-IP limits in `server/src/middleware/rateLimit.js`, per-user daily evaluation quota in `server/src/routes/evaluate.js`, a process-local ffmpeg semaphore in `server/src/lib/jobLimiter.js`, a database-backed kill switch in `server/src/middleware/killSwitch.js`, and an automatic process-local surge trip in `server/src/middleware/surge.js`.

**Internationalization and Direction:** Resolve English/Hebrew direction on the client in `client/src/lib/textDir.ts`, localize selected runtime strings in `client/src/lib/strings.ts`, preserve script punctuation/line structure in `server/src/lib/subtitles.js`, and render the prompter directionally in `client/src/components/Prompter.tsx`.

## Deployment Shape

**Client Service:**
- `client/package.json` builds and starts Next.js as its own Railway service from root `client/`.
- `client/src/lib/api.ts` points browser traffic to the separately deployed Express origin through public runtime configuration.
- `client/src/lib/supabase.ts` connects browser-side to Supabase using public anonymous credentials and relies on RLS from `server/db/migrations/0001_init.sql`.

**Server Service:**
- `server/Procfile`, `server/package.json`, and `server/src/index.js` run one Express process as a separate Railway service from root `server/`.
- `server/src/app.js` trusts one proxy hop, restricts credentialed CORS to configured client origins, and exposes all backend endpoints below `/api`.
- Process-local controls in `server/src/lib/jobLimiter.js`, `server/src/middleware/rateLimit.js`, and `server/src/middleware/surge.js` apply per Express instance.

**Shared External Plane:**
- `server/src/lib/db.js` and `client/src/lib/supabase.ts` connect both services to one Supabase project under different privilege models.
- `server/src/lib/scribe.js` and `server/src/lib/evaluate.js` are server-only adapters for ElevenLabs and OpenRouter/Gemini.
- `client/` and `server/` share no runtime memory or workspace package; their shared contracts are HTTP/JSON shapes in `client/src/lib/api.ts` and persisted JSON structures defined by `server/db/migrations/0001_init.sql`.

---

*Architecture analysis: 2026-08-04*

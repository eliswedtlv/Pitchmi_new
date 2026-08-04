# Coding Conventions

**Analysis Date:** 2026-08-04

## Naming Patterns

**Files:**
- Use PascalCase for reusable React component files, matching the exported component: `client/src/components/Prompter.tsx`, `client/src/components/WaitView.tsx`, and `client/src/components/ui/VideoPlayer.tsx`.
- Keep shadcn-style primitive files lowercase: `client/src/components/ui/button.tsx`, `client/src/components/ui/badge.tsx`, and `client/src/components/ui/card.tsx`.
- Prefix client hook files with `use` and use camelCase: `client/src/hooks/useRecorder.ts`, `client/src/hooks/useWakeLock.ts`, and `client/src/hooks/useKaraokeClock.ts`.
- Follow Next App Router filenames for route modules: each route entry is `page.tsx`, as in `client/src/app/page.tsx`, `client/src/app/results/page.tsx`, and `client/src/app/dev/ui/[screen]/page.tsx`.
- Use camelCase or a concise domain noun for client library modules: `client/src/lib/recorderConstraints.ts`, `client/src/lib/evalStages.ts`, and `client/src/lib/textDir.ts`.
- Use lower-camel/single-domain filenames for CommonJS server modules: `server/src/lib/scriptPath.js`, `server/src/lib/jobLimiter.js`, and `server/src/middleware/rateLimit.js`.
- Name client unit/component tests `<subject>.test.ts` or `<subject>.test.tsx` inside a nearby `__tests__/` directory, for example `client/src/lib/__tests__/clock.test.ts` and `client/src/components/__tests__/Prompter.test.tsx`.
- Name server tests `<area>[.<scenario>].test.js` in `server/tests/`, for example `server/tests/api.evaluate.errors.test.js`, `server/tests/audio.guards.test.js`, and `server/tests/scriptPath.test.js`.
- Name real-browser layout checks `<concern>.spec.ts` in `client/tests-layout/`, for example `client/tests-layout/desktop-layout.spec.ts` and `client/tests-layout/prompter-rtl.spec.ts`.

**Functions:**
- Use camelCase for functions in both applications: `activeWordIndex` in `client/src/lib/clock.ts`, `resolveDir` in `client/src/lib/textDir.ts`, `buildPathFromScript` in `server/src/lib/scriptPath.js`, and `parseFfmpegDuration` in `server/src/lib/audio.js`.
- Prefix custom hooks with `use`, and expose a typed return contract when the hook has multiple outputs; `useRecorder` and `UseRecorderReturn` in `client/src/hooks/useRecorder.ts` are the reference pattern.
- Name Next page components with a `Page` suffix and export them as the route's default, as in `HomePage` in `client/src/app/page.tsx` and `ResultsPage` in `client/src/app/results/page.tsx`.
- Name reusable React components as PascalCase named exports, as in `Prompter` in `client/src/components/Prompter.tsx` and `WaitView` in `client/src/components/WaitView.tsx`.
- On the server, use descriptive action names and export only the functions needed by callers through `module.exports`, as in `server/src/lib/audio.js` and `server/src/lib/score.js`.
- In StandardJS server code, put a space before function parentheses: `function createApp ()` in `server/src/app.js` and `async function extractAudio (videoBuffer)` in `server/src/lib/audio.js`.

**Variables:**
- Use camelCase for local state, parameters, refs, and derived values: `projectId`, `scribeMs`, and `videoBytesEval` in `server/src/routes/evaluate.js`; `takeBlobUrl`, `setPathResult`, and `stopReasonRef` in `client/src/store/session.ts` and `client/src/hooks/useRecorder.ts`.
- Use uppercase snake case for module-level constants and invariant limits: `EVAL_TIMEOUT_MS` in `client/src/lib/api.ts`, `MAX_TAKE_S` in `client/src/lib/limits.ts`, and `EVAL_DEADLINE_MS` in `server/src/routes/evaluate.js`.
- Use short identifiers only in tight, conventional scopes such as callbacks and mathematical helpers: `e` for caught UI errors in `client/src/app/page.tsx`, `w` for word transforms in `server/src/lib/scriptPath.js`, and `req`/`res`/`next` for Express handlers throughout `server/src/routes/`.
- Preserve wire-format snake_case at API and database boundaries while converting important locals to camelCase. Examples include `project_id` → `projectId` in `server/src/routes/script.js` and API response types such as `evals_left_today` in `client/src/lib/api.ts`.

**Types:**
- Use PascalCase for interfaces and type aliases: `EvalResult`, `KaraokePath`, and `PathResult` in `client/src/lib/api.ts`; `RecorderState` and `StopReason` in `client/src/hooks/useRecorder.ts`.
- Keep component prop contracts private to the component unless another module consumes them, as with `PrompterProps` in `client/src/components/Prompter.tsx` and `UseRecorderOptions` in `client/src/hooks/useRecorder.ts`.
- Use string-literal unions for finite client state machines instead of free strings, as in `RecorderState` in `client/src/hooks/useRecorder.ts` and `EvalStage`/`EvalEvent` in `client/src/lib/evalStages.ts`.
- Use `import type` or inline `type` imports when an import is type-only, as in `client/src/components/Prompter.tsx`, `client/src/store/session.ts`, and `client/src/components/ui/button.tsx`.
- Server code is untyped CommonJS JavaScript; protect its boundaries with runtime checks and tests in `server/src/routes/`, `server/src/lib/evaluate.js`, and `server/tests/`.

## Code Style

**Formatting:**
- Client TypeScript/TSX uses two-space indentation, double quotes, no semicolons, and trailing commas in multiline arrays, objects, calls, and parameter lists. Follow `client/src/lib/api.ts`, `client/src/hooks/useRecorder.ts`, and `client/src/app/page.tsx`.
- Server JavaScript uses StandardJS formatting: two-space indentation, single quotes, no semicolons, spaces before function parentheses, and no trailing commas. Follow `server/src/app.js`, `server/src/routes/script.js`, and `server/src/lib/audio.js`.
- No Prettier configuration or Prettier dependency is present in `client/package.json`, `server/package.json`, or the repository root. Match the style of the application being edited; do not normalize client and server files to one quote/function-spacing style.
- Long domain workflows are separated with blank lines and explanatory comments rather than extracted solely for line-count reduction. `server/src/routes/evaluate.js` and `client/src/components/Prompter.tsx` use this structure where order itself is an invariant.
- Unicode section dividers such as `// ── Evaluate ──` organize large client service modules in `client/src/lib/api.ts` and `client/src/lib/__tests__/clock.test.ts`; plain `// --- section ---` comments organize server modules such as `server/src/lib/db.js`.

**Linting:**
- Run `npm run lint` in `server/`; it executes StandardJS 17 through `server/package.json`. The command passes on the analyzed source.
- Treat `server/package.json`'s `"standard": { "env": ["jest", "node"] }` as the authoritative server lint environment; there is no separate `.eslintrc`.
- The client declares `"lint": "next lint"` in `client/package.json`, but no ESLint configuration is present. On the analyzed codebase, `CI=1 npm run lint` exits at Next's interactive “How would you like to configure ESLint?” prompt and is not an operational lint gate.
- Run `npx tsc --noEmit` in `client/` for the functioning client static check. It passes with `"strict": true`, `"noEmit": true`, and `"isolatedModules": true` from `client/tsconfig.json`.
- `client/tsconfig.json` enables `skipLibCheck` and `allowJs`; rely on explicit application types rather than expecting dependency declaration files or JavaScript imports to receive full strict checking.
- Use narrow suppressions only where browser APIs force indexed writes or hook dependencies are intentionally stable. Existing examples are `// @ts-expect-error indexed style write` in `client/tests-layout/mirror-align.spec.ts` and `// eslint-disable-line react-hooks/exhaustive-deps` in `client/src/hooks/useRecorder.ts`, `client/src/app/karaoke/page.tsx`, and `client/src/app/wait/page.tsx`.

## Import Organization

**Order:**
1. In client modules, place framework/external imports first, such as React, Next, Lucide, Zustand, Testing Library, or Vitest imports in `client/src/app/page.tsx`, `client/src/store/session.ts`, and `client/src/app/__tests__/home.test.tsx`.
2. Follow with internal `@/` imports, grouping components before hooks/lib/store when the file has several application imports; `client/src/app/karaoke/page.tsx` and `client/src/app/results/page.tsx` are the representative route patterns.
3. Use relative imports for tightly coupled sibling modules and test subjects where that relationship is clearer, as in `client/src/components/__tests__/Prompter.test.tsx` and `client/src/lib/__tests__/estimate.test.ts`.
4. In server modules, put `'use strict'` first, then Node built-ins/external packages, then local config, middleware, and domain modules; follow `server/src/app.js`, `server/src/routes/evaluate.js`, and `server/src/lib/audio.js`.
5. Keep `jest.mock(...)` declarations before requiring the module under test when load-time dependency replacement matters, as in `server/tests/api.evaluate.test.js` and `server/tests/audio.guards.test.js`.

**Path Aliases:**
- Use `@/*` for imports from `client/src/*`; the alias is defined in `client/tsconfig.json` and mirrored in `client/vitest.config.ts`.
- Prefer the alias for cross-directory client imports, such as `@/lib/api` and `@/store/session` in `client/src/app/page.tsx`.
- Use relative paths for all server imports because `server/` has no alias or module resolver configuration; examples are `../middleware/auth` and `../lib/db` in `server/src/routes/script.js`.
- No barrel `index.ts` modules are present under `client/src/`; import from the owning module rather than adding a barrel implicitly.

## Error Handling

**Patterns:**
- Route all client HTTP response parsing through `handleResponse` in `client/src/lib/api.ts`. Non-2xx responses become `Error` objects augmented with `status` and `body`, preserving both a display message and structured server data.
- Convert transport failures into stable user-facing error classes at the API boundary. `evaluateVideo` in `client/src/lib/api.ts` maps aborts to `"Evaluation timed out"` and other fetch failures to `"Network error"` with `status: 0`.
- In interactive pages, store caught messages in local React state, clear the error before retrying, and restore loading state in `finally`; `handleStart` in `client/src/app/page.tsx` and the async flow in `client/src/app/videos/page.tsx` are the reference patterns.
- Swallow errors only for best-effort cleanup, media playback, wake-lock release, or non-critical telemetry. Examples are object URL/media cleanup in `client/src/hooks/useRecorder.ts`, `video.play().catch(() => {})` in `client/src/components/AdSlot.tsx`, and `fs.rm(...).catch(() => {})` in `server/src/lib/audio.js`.
- In ordinary async Express routes, wrap the handler body in `try/catch` and call `next(err)` so `errorHandler` in `server/src/app.js` controls the response. Follow `server/src/routes/script.js`, `server/src/routes/save.js`, and `server/src/routes/projects.js`.
- Return expected client errors directly with a specific status and machine-readable error code, such as `missing_text`/400 in `server/src/routes/script.js`, `project_not_found`/404 in `server/src/routes/save.js`, and `daily_limit`/429 in `server/src/routes/evaluate.js`.
- Tag operational errors with a `code` and optionally `status` when central handling must distinguish them. `BusyError` in `server/src/lib/jobLimiter.js`, `unsupportedMedia` in `server/src/lib/audio.js`, and `timeoutError` in `server/src/lib/evaluate.js` establish this pattern.
- Keep specialized orchestration errors local when they require stage metadata or a single guaranteed event row. The evaluate route catches and maps timeout, busy, and media errors in `server/src/routes/evaluate.js` instead of sending them through the general handler.

**Validation:**
- Validate request bodies manually at route boundaries; no schema-validation package is configured in `server/package.json`. Use type checks, presence checks, numeric coercion, and configured bounds as demonstrated in `server/src/routes/script.js`, `server/src/routes/admin.js`, and `server/src/routes/save.js`.
- Validate authentication in middleware before feature logic. `server/src/middleware/auth.js` attaches `req.userId`; route code then scopes database reads by both resource ID and user ID.
- Validate uploads twice: Multer size/MIME filtering in `server/src/middleware/upload.js`, then magic-byte container sniffing before ffmpeg in `server/src/lib/audio.js`.
- Validate untrusted model output before using it. `parseResult` in `server/src/lib/evaluate.js` extracts a balanced JSON object, coerces and clamps scores, bounds comments, and rejects non-numeric values.
- Keep TypeScript API contracts aligned with server wire shapes in `client/src/lib/api.ts`, including snake_case fields such as `t_start`, `duration_s`, and `evals_left_today`.

## Logging

**Framework:** Console for process diagnostics plus Supabase-backed structured event logging through `server/src/lib/db.js`.

**Patterns:**
- Use `db.logEvent(...)` for request outcomes and operational metadata. `server/src/routes/evaluate.js`, `server/src/routes/admin.js`, and `server/src/middleware/rateLimit.js` log actions, latency, numeric scores, and costs.
- Keep event payloads metadata-only; do not log uploaded media, transcripts, model feedback, or raw model output. Privacy assertions in `server/tests/evaluate.test.js` enforce this for parse failures.
- Make logging failure non-fatal. `logEvent` in `server/src/lib/db.js` catches its own failure, and secondary event writes commonly end with `.catch(() => {})` in `server/src/routes/evaluate.js`.
- Reserve `console.log`/`console.warn` for process startup and configuration warnings in `server/src/index.js`; use `console.error` for telemetry failure or gate degradation in `server/src/lib/db.js`, `server/src/middleware/killSwitch.js`, and `server/src/middleware/surge.js`.
- Client source under `client/src/` does not use console logging; surface actionable failures in UI state through the page/component patterns above.

## Comments

**When to Comment:**
- Document domain intent, safety constraints, non-obvious browser behavior, and order-dependent workflows. Strong examples are the media hardening comments in `server/src/lib/audio.js`, the scoring/re-timing order in `server/src/routes/evaluate.js`, and the bidi layout invariant in `client/src/components/Prompter.tsx`.
- Include issue/spec identifiers when a constraint comes from a tracked product decision, following the `T-10018`, `T-1165`, and `T-1172` references throughout `client/src/` and `server/src/`.
- Explain intentional absences and failure behavior in tests, such as “no Storage write” in `server/tests/api.evaluate.test.js` and the excluded camera screen in `client/tests-layout/screens.spec.ts`.
- Do not comment syntax or restate a function name; comments in `client/src/lib/estimate.ts` and `server/src/lib/jobLimiter.js` explain why estimates, queues, and limits behave as they do.

**JSDoc/TSDoc:**
- Use doc comments for exported contracts, algorithms, or fragile helpers where callers need behavioral guarantees. Examples include `evaluateVideo` and `EvalResult` in `client/src/lib/api.ts`, `splitAtSeconds` in `client/src/lib/estimate.ts`, and the measurement helpers in `client/tests-layout/desktop-layout.spec.ts`.
- Use inline `//` comments for server implementation invariants; server CommonJS modules do not use a formal JSDoc type system.
- Keep test comments when they define why an assertion is load-bearing, especially in `server/tests/scriptPath.test.js`, `client/src/lib/__tests__/tokenParity.test.ts`, and `client/tests-layout/mirror-align.spec.ts`.

## Function Design

**Size:** Prefer small pure helpers for deterministic logic, but keep ordered orchestration readable in one route/hook when extracting it would hide sequencing.
- Pure client examples are `activeWordIndex` in `client/src/lib/clock.ts`, `splitAtSeconds` in `client/src/lib/estimate.ts`, and `resolveDir` in `client/src/lib/textDir.ts`.
- Pure server modules group related helpers behind a small export surface, as in `server/src/lib/score.js`, `server/src/lib/text.js`, and `server/src/lib/subtitles.js`.
- Long orchestration functions such as the `/evaluate` handler in `server/src/routes/evaluate.js` and `useRecorder` in `client/src/hooks/useRecorder.ts` use named timing/state variables, comments, and explicit cleanup; preserve their sequencing when modifying them.

**Parameters:** Use positional parameters for small pure functions and option/data objects when arguments are optional or form a domain record.
- Positional examples: `activeWordIndex(words, tSeconds)` in `client/src/lib/clock.ts` and `buildPathFromScript(scriptText, spokenWords)` in `server/src/lib/scriptPath.js`.
- Object examples: `useRecorder({ maxDurationS, onStop, graceAfterS })` in `client/src/hooks/useRecorder.ts`, `saveTake(data)` in `client/src/lib/api.ts`, and destructured DB writes in `server/src/lib/db.js`.

**Return Values:** Return explicit typed shapes on the client and plain serializable objects on the server.
- Declare client return types for exported service and pure functions, as in `client/src/lib/api.ts`, `client/src/lib/estimate.ts`, and `client/src/lib/recorderConstraints.ts`.
- Use tagged or structured results instead of ambiguous primitives for multi-value algorithms, as in `buildPathFromScript` from `server/src/lib/scriptPath.js` and `extractAudio` from `server/src/lib/audio.js`.
- Use `null` for an expected “not available/not found” result and throw for operational failure, following `getProject` in `server/src/lib/db.js`, `dirForLang` in `client/src/lib/textDir.ts`, and `getSupabaseClient` in `client/src/lib/supabase.ts`.

## Module Design

**Exports:** Use direct exports; keep route wiring and implementation-specific helpers private.
- Next route pages use default exports in `client/src/app/**/page.tsx`; reusable components, hooks, types, and utilities use named exports under `client/src/components/`, `client/src/hooks/`, and `client/src/lib/`.
- Server route modules export one configured Express router, for example `server/src/routes/script.js` and `server/src/routes/save.js`.
- Server library modules export explicit objects at the bottom of the file, exposing only tested domain operations, as in `server/src/lib/audio.js`, `server/src/lib/evaluate.js`, and `server/src/lib/scriptPath.js`.
- Centralize HTTP calls in `client/src/lib/api.ts`, cross-screen session state in `client/src/store/session.ts`, and database/storage access in `server/src/lib/db.js`.

**Barrel Files:** Not used.
- No barrel modules exist under `client/src/` or `server/src/`; import directly from the implementation module.
- `server/src/app.js` is composition, not a barrel: it mounts middleware and routers and returns an Express app for both `server/src/index.js` and Supertest suites.

## React and Client Patterns

- Add `"use client"` at the top of components/pages that use hooks, browser APIs, or Zustand, as in `client/src/app/page.tsx`, `client/src/components/Prompter.tsx`, and `client/src/hooks/useRecorder.ts`.
- Keep pure calculation outside React when possible, placing it in `client/src/lib/` and testing it directly. `client/src/lib/clock.ts`, `client/src/lib/estimate.ts`, and `client/src/lib/evalStages.ts` are the reference modules.
- Keep browser lifecycle state in custom hooks with explicit cleanup. `client/src/hooks/useRecorder.ts` cancels animation frames/timers and stops tracks; `client/src/hooks/useWakeLock.ts` releases locks on visibility changes and unmount.
- Keep ephemeral, single-screen state in `useState`; use `useSession` from `client/src/store/session.ts` only for state that crosses routes, such as the current project, script, blob URL, path, and evaluation result.
- Use semantic controls and accessible queries/labels. `client/src/app/page.tsx` supplies `aria-label="Your script"`, `client/src/components/ui/VideoPlayer.tsx` provides stateful play/mute labels, and tests query them by role/label in `client/src/app/__tests__/home.test.tsx` and `client/src/components/__tests__/VideoPlayer.test.tsx`.
- Build class variants with `class-variance-authority` and merge caller classes through `cn` from `client/src/lib/utils.ts`, following `client/src/components/ui/button.tsx` and `client/src/components/ui/badge.tsx`.
- When a visual invariant depends on shared classes or tokens, centralize the value and add a parity/layout test. `TEXT_BOX` in `client/src/app/page.tsx`, `client/src/lib/utils.ts`, `client/src/lib/__tests__/tokenParity.test.ts`, and `client/tests-layout/mirror-align.spec.ts` establish this convention.

## Server Patterns

- Build the Express application in `createApp` and keep socket startup in `server/src/index.js`; this makes the same middleware/routes testable through Supertest in `server/tests/api.*.test.js`.
- Mount global middleware and service gates once in `server/src/app.js`; route modules should focus on resource validation and domain orchestration.
- Keep external/provider and compute-heavy behavior behind `server/src/lib/` modules, such as `server/src/lib/scribe.js`, `server/src/lib/evaluate.js`, `server/src/lib/audio.js`, and `server/src/lib/jobLimiter.js`.
- Keep all Supabase database and Storage calls in `server/src/lib/db.js`; route tests replace this one module with `server/tests/mocks/db.js`.
- Use early returns for expected HTTP failures, followed by a linear success path. `server/src/routes/script.js` and `server/src/routes/save.js` are the concise reference implementations.
- Use configured constants from `server/src/config.js` rather than hardcoded limits in handlers. Tests arrange environment values before requiring config through `server/tests/helpers.js`.

---

*Convention analysis: 2026-08-04*

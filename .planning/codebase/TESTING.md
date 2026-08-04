# Testing Patterns

**Analysis Date:** 2026-08-04

## Test Framework

**Runner:**
- Client unit/component runner: Vitest declared as `^2.1.8` in `client/package.json` (resolved runtime observed as 2.1.9).
- Client unit config: `client/vitest.config.ts`.
- Client DOM environment: jsdom 25, configured through `client/vitest.config.ts`.
- Server runner: Jest `^29.7.0`, configured inline in `server/package.json`.
- Server environment: Node, with `testMatch: ["**/tests/**/*.test.js"]` in `server/package.json`.
- Real-browser layout runner: Playwright Test `^1.49.1`, configured in `client/playwright.config.ts`.
- Playwright browser project: Chromium only, using the Desktop Chrome device profile plus a default 1600×900 viewport in `client/playwright.config.ts`.

**Assertion Library:**
- Use Vitest's built-in `expect` for client unit/component tests, as in `client/src/lib/__tests__/clock.test.ts` and `client/src/app/__tests__/home.test.tsx`.
- Use Testing Library render/query/event helpers for React components and hooks: `@testing-library/react` in `client/src/components/__tests__/Prompter.test.tsx`, `client/src/hooks/__tests__/useRecorder.test.ts`, and route tests under `client/src/app/__tests__/`.
- Use Jest's built-in `expect` for server unit tests and Supertest response assertions, as in `server/tests/evaluate.test.js` and `server/tests/api.basic.test.js`.
- Use Playwright's `test`/`expect` plus browser geometry and locator APIs for layout checks in `client/tests-layout/`.
- No Jest DOM matcher package is configured in `client/src/test/setup.ts`; client component tests use native properties, DOM attributes, truthiness, null checks, text content, and class-name assertions.

**Run Commands:**
```bash
cd client && npm test                    # Run all 14 Vitest files once
cd client && npm run test:watch          # Run Vitest in watch mode
cd client && npm run test:layout         # Run all Playwright layout/screenshot checks
cd client && npx tsc --noEmit            # Run the functioning strict type gate
cd server && npm test                    # Run all 28 Jest suites
cd server && npm run lint                # Run StandardJS
cd server && npm run smoke               # Opt-in live external-provider pipeline
```

**Verified State:**
- `cd client && npm test -- --reporter=dot` passes 14 files and 113 tests.
- `cd server && npm test -- --runInBand` passes 28 suites and 192 tests, with zero snapshots.
- `cd client && npm run test:layout` passes 45 Chromium tests.
- `cd client && npx tsc --noEmit` passes.
- `cd server && npm run lint` passes.
- `cd client && npm run lint` is not an executable gate: `client/package.json` calls deprecated `next lint`, no ESLint config exists, and the command stops at an interactive configuration prompt.

## Test File Organization

**Location:**
- Co-locate client unit and React tests under `__tests__/` next to the owning area:
  - Route tests: `client/src/app/__tests__/`.
  - Component tests: `client/src/components/__tests__/`.
  - Hook tests: `client/src/hooks/__tests__/`.
  - Pure library tests: `client/src/lib/__tests__/`.
- Keep client shared setup in `client/src/test/setup.ts`; `client/vitest.config.ts` loads it for every test.
- Keep real-browser checks outside `src/` in `client/tests-layout/`; `client/vitest.config.ts` explicitly includes only `src/**/*.{test,spec}.{ts,tsx}` so Playwright specs cannot run under Vitest.
- Keep all server tests in `server/tests/`; the Jest `testMatch` in `server/package.json` selects only this tree.
- Keep reusable server arrangements in `server/tests/helpers.js` and the in-memory database double in `server/tests/mocks/db.js`.
- Keep binary fixtures under `server/tests/fixtures/`; the bundled media sample is `server/tests/fixtures/sample.mp4`.

**Naming:**
- Client Vitest files use `.test.ts` or `.test.tsx`, such as `client/src/lib/__tests__/estimate.test.ts` and `client/src/app/__tests__/wait.test.tsx`.
- Playwright files use `.spec.ts`, such as `client/tests-layout/screens.spec.ts`.
- Server Jest files use `.test.js`, often with dotted concern names such as `server/tests/api.duration.cap.test.js` and `server/tests/audio.transcode.test.js`.
- Name suites after the unit, endpoint, or invariant under test, and include a ticket/spec identifier where it explains a regression contract; see `client/src/hooks/__tests__/useRecorder.test.ts`, `server/tests/scriptPath.test.js`, and `server/tests/api.evaluate.proxy.test.js`.

**Structure:**
```text
client/
├── src/
│   ├── app/__tests__/*.test.tsx
│   ├── components/__tests__/*.test.tsx
│   ├── hooks/__tests__/*.test.ts
│   ├── lib/__tests__/*.test.ts
│   └── test/setup.ts
└── tests-layout/*.spec.ts

server/
└── tests/
    ├── api.*.test.js
    ├── *.test.js
    ├── helpers.js
    ├── mocks/db.js
    └── fixtures/sample.mp4
```

## Test Structure

**Suite Organization:**
```typescript
// Client pattern from client/src/app/__tests__/home.test.tsx
beforeEach(() => {
  vi.clearAllMocks()
  h.createProject.mockResolvedValue({ id: "p1" })
})

afterEach(cleanup)

describe("HomePage — the script screen", () => {
  it("creates the project, saves the script, and goes to karaoke", async () => {
    render(<HomePage />)
    fireEvent.change(screen.getByLabelText("Your script"), {
      target: { value: "we are building a tool" },
    })
    fireEvent.click(screen.getByRole("button", { name: /record it/i }))

    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/karaoke"))
  })
})
```

```javascript
// Server pattern from server/tests/api.basic.test.js
require('./helpers')
jest.mock('../src/lib/db', () => require('./mocks/db'))

const request = require('supertest')
const createApp = require('../src/app')
const dbMock = require('./mocks/db')

beforeEach(() => dbMock.__reset())

describe('basic endpoints', () => {
  test('health -> 200 {status:ok}', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

**Patterns:**
- Group assertions by behavior or invariant, not merely by implementation method. Examples include `"HomePage — length estimate and over-length flag"` in `client/src/app/__tests__/home.test.tsx` and `"buildPathFromScript — monotonic guarantee (fuzz)"` in `server/tests/scriptPath.test.js`.
- Reset mutable mocks and state in `beforeEach`; restore globals, timers, and spies in `afterEach`. Follow `client/src/hooks/__tests__/useRecorder.test.ts`, `client/src/lib/__tests__/evaluate.test.ts`, `server/tests/evaluate.test.js`, and `server/tests/audio.guards.test.js`.
- Prefer accessible Testing Library queries by label, role, and visible text. `client/src/app/__tests__/home.test.tsx`, `client/src/app/__tests__/results.test.tsx`, and `client/src/components/__tests__/VideoPlayer.test.tsx` are the reference suites.
- Use `data-testid`/`data-*` selectors for state or geometry that has no stable accessible query, such as `data-testid="prompter"` in `client/src/components/__tests__/Prompter.test.tsx` and `data-widx` in `client/tests-layout/prompter-rtl.spec.ts`.
- Assert both the positive behavior and important absences. `client/src/app/__tests__/home.test.tsx` verifies removed upload/use-case/save entry points stay absent; `server/tests/api.evaluate.test.js` verifies evaluation never writes to Storage.
- For API tests, create a fresh app per request with `createApp()` and use Supertest, preserving the real middleware/route composition from `server/src/app.js`.
- For numerical/algorithm tests, assert domain invariants and object shapes, not only one fixture's output. `server/tests/scriptPath.test.js`, `server/tests/score.test.js`, and `client/src/lib/__tests__/clock.test.ts` use this approach.

## Mocking

**Framework:** Vitest `vi` on the client; Jest mocks on the server; Playwright dev-fixture routes for seeded browser states.

**Patterns:**
```typescript
// Hoisted client module mocks from client/src/app/__tests__/home.test.tsx
const h = vi.hoisted(() => ({
  push: vi.fn(),
  createProject: vi.fn(),
  saveScript: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
}))
vi.mock("@/lib/api", () => ({
  createProject: h.createProject,
  saveScript: h.saveScript,
}))
```

```javascript
// Server dependency replacement from server/tests/api.evaluate.test.js
jest.mock('../src/lib/db', () => require('./mocks/db'))
jest.mock('../src/lib/audio', () => ({
  extractAudio: async () => ({
    buffer: Buffer.from('audio'),
    mime: 'audio/mp4',
    duration_s: 12
  }),
  transcodeForEval: async () => ({
    buffer: Buffer.from('eval-proxy'),
    mime: 'video/mp4'
  })
}))
```

**What to Mock:**
- Mock Next navigation, the API module, and Zustand session state when testing a page's rendering/flow in isolation. See `client/src/app/__tests__/home.test.tsx`, `client/src/app/__tests__/results.test.tsx`, and `client/src/app/__tests__/wait.test.tsx`.
- Stub browser APIs absent or unreliable in jsdom: `MediaRecorder`, `navigator.mediaDevices`, `requestAnimationFrame`, media playback, Web Share, and URL object methods in `client/src/hooks/__tests__/useRecorder.test.ts` and `client/src/components/__tests__/VideoPlayer.test.tsx`.
- Use fake timers for countdowns, request timeouts, retries, and hung processes. Examples are `client/src/hooks/__tests__/useRecorder.test.ts`, `client/src/lib/__tests__/evaluate.test.ts`, `server/tests/evaluate.test.js`, and `server/tests/audio.guards.test.js`.
- Mock the server database through `server/tests/mocks/db.js` for API tests; seed and inspect it through `__seedProject`, `__state`, and `__reset`.
- Mock paid/network providers and compute-heavy media boundaries in ordinary test runs: Scribe, OpenRouter/Gemini fetch, ffmpeg process spawning, and audio extraction in `server/tests/api.evaluate.test.js`, `server/tests/evaluate.test.js`, and `server/tests/audio.guards.test.js`.
- Set server test environment values before requiring `server/src/config.js` or the app. `server/tests/helpers.js` is the shared pattern; `server/tests/auth.test.js` performs dedicated auth-specific setup before importing middleware.

**What NOT to Mock:**
- Do not mock pure transformations and scoring logic. Exercise the real implementations in `server/tests/scriptPath.test.js`, `server/tests/score.test.js`, `server/tests/subtitles.test.js`, `client/src/lib/__tests__/estimate.test.ts`, and `client/src/lib/__tests__/textDir.test.ts`.
- Do not mock Express middleware composition in API tests. Use the real app from `server/src/app.js` through Supertest, replacing only external boundaries.
- Do not use jsdom for claims about bidi ordering, viewport fill, horizontal overflow, responsive columns, or mirrored text geometry. Use the real Next application and browser in `client/tests-layout/prompter-rtl.spec.ts`, `client/tests-layout/desktop-layout.spec.ts`, and `client/tests-layout/mirror-align.spec.ts`.
- Do not call live paid providers in the default Jest suite; the explicit opt-in path is `server/scripts/smoke.js`.

## Fixtures and Factories

**Test Data:**
```javascript
// In-memory server factory pattern from server/tests/mocks/db.js
__seedProject (id, userId, overrides = {}) {
  const project = {
    id,
    user_id: userId,
    use_case: 'pitch',
    speed: 1,
    ...overrides
  }
  state.projects.set(id, project)
  return project
}
```

```typescript
// Inline typed client fixture pattern from client/src/components/__tests__/Prompter.test.tsx
const words: KaraokeWord[] = [
  { w: "שלום", t_start: 0, t_end: 0.5, line: 0 },
  { w: "PitchMi", t_start: 0.5, t_end: 1, line: 0 },
]
```

**Location:**
- Put reusable server database state and factories in `server/tests/mocks/db.js`.
- Put shared server token/environment helpers in `server/tests/helpers.js`.
- Put binary media fixtures in `server/tests/fixtures/`; `server/tests/fixtures/sample.mp4` supports media/smoke paths.
- Keep small, behavior-specific client fixtures inline and typed within the suite, as in `client/src/components/__tests__/Prompter.test.tsx` and `client/src/lib/__tests__/clock.test.ts`.
- Use deterministic generators for broad algorithm coverage. The seeded LCG and `read(...)` generator in `server/tests/scriptPath.test.js` make its 200-case fuzz check reproducible.
- Use real dev-only routes as browser fixtures for session-dependent screens: `client/src/app/dev/ui/[screen]/page.tsx` feeds `client/tests-layout/screens.spec.ts` and `client/tests-layout/desktop-layout.spec.ts`; `client/src/app/dev/prompter-layout/[fixture]/page.tsx` feeds `client/tests-layout/prompter-rtl.spec.ts`.

## Coverage

**Requirements:** None enforced.
- Neither `client/package.json` nor `server/package.json` declares a coverage script or threshold.
- `client/vitest.config.ts` has no `coverage` block, and no `@vitest/coverage-v8` or `@vitest/coverage-istanbul` package is present in `client/package.json`.
- Jest can collect coverage on demand, but `server/package.json` does not configure `collectCoverage`, `collectCoverageFrom`, `coverageThreshold`, or a report format.
- The repository `.gitignore` excludes `coverage/`, but ignored output is not evidence of an enforced target.
- Current passing-suite counts provide execution evidence—113 Vitest tests, 192 Jest tests, and 45 Playwright tests—but do not establish statement, branch, function, or line percentages.

**View Coverage:**
```bash
cd server && npm test -- --coverage        # Jest ad-hoc report; no threshold is enforced
# Client coverage: not configured in client/package.json or client/vitest.config.ts
```

## Test Types

**Unit Tests:**
- Test pure client utilities directly under `client/src/lib/__tests__/`, including clock behavior, estimates, direction resolution, evaluation stages, recorder constraints, and design-token parity.
- Test hooks with `renderHook`, `act`, fake timers, and browser API stubs in `client/src/hooks/__tests__/useRecorder.test.ts` and the hook section of `client/src/lib/__tests__/clock.test.ts`.
- Test server domain algorithms directly in `server/tests/evaluate.test.js`, `server/tests/score.test.js`, `server/tests/scriptPath.test.js`, `server/tests/fillers.test.js`, and `server/tests/subtitles.test.js`.
- Test low-level process/security guards with controlled process and filesystem mocks in `server/tests/audio.guards.test.js`, `server/tests/audio.duration.test.js`, and `server/tests/scribe.timeout.test.js`.

**Integration Tests:**
- Test React page/component behavior through Testing Library with only navigation/API/store boundaries mocked in `client/src/app/__tests__/` and `client/src/components/__tests__/`.
- Test server endpoints through Supertest against the fully composed app from `server/src/app.js`. Suites under `server/tests/api.*.test.js` cover auth, CORS, admin, rate limiting, kill switch, upload MIME/size, evaluation errors/timeouts/costs, save, script, and re-timing.
- Test JWT middleware directly with real locally generated ES256/HS256 signatures and a mocked remote JWKS resolver in `server/tests/auth.test.js`.
- Live Supabase, Scribe, and OpenRouter/Gemini integration is excluded from the normal suite. `server/scripts/smoke.js` is the opt-in full-pipeline check when service credentials are available.

**E2E Tests:**
- Playwright real-browser checks are used, but they are layout/rendering proofs rather than a full user-journey suite.
- `client/tests-layout/desktop-layout.spec.ts` asserts viewport fill, responsive column overlap, breakpoint behavior, and horizontal overflow.
- `client/tests-layout/prompter-rtl.spec.ts` measures real bidi word ordering for Hebrew, mixed Latin tokens, and English.
- `client/tests-layout/mirror-align.spec.ts` compares computed typography and bounding boxes for the textarea/tint mirror at narrow English and Hebrew viewports.
- `client/tests-layout/screens.spec.ts` renders five screens across three viewport widths and two color schemes, then writes full-page screenshots to `docs/ui/`. It verifies visibility/render completion, not pixel diffs.
- `client/playwright.config.ts` starts the real Next dev server on port 3123 and targets only Chromium.

## Test Gaps

- No test coverage percentage or threshold is measured for either application; configuration evidence is `client/vitest.config.ts` and `server/package.json`.
- No continuous-integration workflow is present in the repository root, `.github/`, `client/`, or `server/`; the passing commands above are local quality gates only.
- Client linting is not configured as a non-interactive gate even though `client/package.json` declares `npm run lint`; strict TypeScript is the only functioning static client check.
- Playwright covers Chromium only through `client/playwright.config.ts`. WebKit/Safari behavior is not exercised despite browser-sensitive recording and media code in `client/src/hooks/useRecorder.ts` and `client/src/components/ui/VideoPlayer.tsx`.
- No real camera/media-recording browser journey exists. `client/tests-layout/screens.spec.ts` explicitly excludes `/karaoke`, while `client/src/hooks/__tests__/useRecorder.test.ts` uses a fake `MediaRecorder`.
- The screenshot suite in `client/tests-layout/screens.spec.ts` is a review artifact, not visual regression: it has no stored-baseline comparison and cannot fail on a color, spacing, or pixel-level change if the target text remains visible.
- Live database/storage contracts are not exercised by Jest. API tests replace `server/src/lib/db.js` with `server/tests/mocks/db.js`; no test applies `server/db/migrations/0001_init.sql` to a disposable database.
- Live Scribe and delivery-evaluation providers are outside default test execution. `server/scripts/smoke.js` is manual/credential-dependent, so provider schema, billing, and routing changes can evade the mocked suites.
- Playwright dev fixtures cover home, results, wait, wait-error, videos, and prompter layout through `client/src/app/dev/`; admin behavior and a complete record → evaluate → results journey have no browser-level coverage.
- Client API coverage is concentrated on `evaluateVideo` in `client/src/lib/__tests__/evaluate.test.ts`; other functions in the 297-line `client/src/lib/api.ts` are exercised indirectly or not at the transport-contract level.

## Common Patterns

**Async Testing:**
```typescript
// Client request timeout pattern from client/src/lib/__tests__/evaluate.test.ts
vi.useFakeTimers()
const promise = evaluateVideo(new Blob(["v"]), "p1")
const assertion = expect(promise).rejects.toMatchObject({
  status: 0,
  message: "Evaluation timed out",
})
await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS + 1)
await assertion
```

```javascript
// Server request integration pattern from server/tests/api.evaluate.test.js
const res = await request(createApp())
  .post('/api/evaluate')
  .set('Authorization', `Bearer ${userToken('user-1')}`)
  .field('project_id', 'proj-1')
  .attach('video', Buffer.from('fake-video-bytes'), 'take.webm')

expect(res.status).toBe(200)
expect(res.body).toMatchObject({ language: 'en' })
```

- Wrap React updates and timer advancement in Testing Library `act`, as in `client/src/hooks/__tests__/useRecorder.test.ts` and `client/src/lib/__tests__/clock.test.ts`.
- Create rejection assertions before advancing fake timers when the promise can reject during the clock jump; both `client/src/lib/__tests__/evaluate.test.ts` and `server/tests/evaluate.test.js` follow this discipline.
- Restore real timers and globals in teardown to prevent cross-suite state leakage.

**Error Testing:**
```javascript
// Tagged server error pattern from server/tests/audio.guards.test.js
await expect(extractAudio(evil)).rejects.toMatchObject({
  code: 'UNSUPPORTED_MEDIA_TYPE'
})
expect(mockSpawn).not.toHaveBeenCalled()
```

```typescript
// Client user-visible failure pattern from client/src/app/__tests__/home.test.tsx
h.saveScript.mockRejectedValue(
  new Error("Write at least a few words before you record."),
)
render(<HomePage />)
fireEvent.click(screen.getByRole("button", { name: /record it/i }))
await waitFor(() =>
  expect(screen.getByText(/at least a few words/i)).toBeTruthy(),
)
expect(h.push).not.toHaveBeenCalled()
```

- Assert the status/code and verify forbidden downstream side effects do not occur. `server/tests/api.evaluate.proxy.test.js` checks both the 413 body and zero provider calls; `server/tests/api.duration.cap.test.js` checks rejection happens before transcription/evaluation.
- For privacy-sensitive failures, assert prohibited content is absent from logs. `server/tests/evaluate.test.js` confirms raw model output never appears in the diagnostic event.
- Test fail-open/fail-closed behavior explicitly at security and operational gates in `server/tests/api.cors.test.js`, `server/tests/api.killswitch.test.js`, `server/tests/api.ratelimit.test.js`, and `server/tests/audio.guards.test.js`.

---

*Testing analysis: 2026-08-04*

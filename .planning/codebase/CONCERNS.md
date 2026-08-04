# Codebase Concerns

## Current Readiness

- The v1 implementation is code-complete, but it is not launch-complete. `docs/STATUS.md` and `docs/TASKS.md` still require real-provider smoke testing, device QA, Supabase provisioning/reproducibility work, and deployment of the two Railway services.
- Automated tests mock external services. The real ElevenLabs Scribe, OpenRouter/Gemini, Supabase, ffmpeg-on-production-container, and cross-origin Railway path are exercised only by `server/scripts/smoke.js` or manual checks.
- The repository has extensive historical implementation notes, but the top-level product copy is stale: `README.md` and `CLAUDE.md` still describe videos of up to one minute while the shipped product and `client/src/app/layout.tsx` promise a hard 30-second format.
- `docs/STATUS.md` has a very large manual checklist. Many entries cover critical mobile-only behavior—iOS recording, inline playback, cross-origin evaluation, RTL prompter layout, safe areas, and real camera presentation—so green CI is not equivalent to a verified release.

## Security and Privacy

- `server/src/app.js` returns `err.message` in 5xx responses. Upstream errors can expose implementation detail, paths, or provider information to callers; this is tracked as T-10013.
- `server/src/middleware/auth.js` verifies JWT signatures but does not validate the expected issuer, audience, or role claims. A token signed by the same Supabase project keys can be accepted outside the intended claim context; tracked as T-10014.
- The Express API does not install security response headers such as HSTS, `X-Content-Type-Options`, frame restrictions, or a referrer policy. This is the explicit T-10016 backlog item.
- `server/src/routes/save.js` persists the client-declared MIME type as object metadata even though the server already has byte-level container detection in `server/src/lib/audio.js`; tracked as T-10015.
- Admin authentication is one shared password with a signed 12-hour cookie in `server/src/routes/admin.js`. It has rate limiting and constant-time comparison, but no named administrators, second factor, revocation list, or audit attribution beyond success/failure.
- The admin cookie must be `Secure; SameSite=None` for the split Railway origins, which means the admin login cannot be exercised over ordinary local HTTP. Production verification therefore depends on a deployed origin or HTTPS tunnel.
- Privacy boundaries are intentionally strong: evaluation video stays in request memory/temp processing, event logs contain metadata and numeric values, and cloud storage is only touched by `POST /api/save`. Future changes should preserve these invariants in `CLAUDE.md`, `server/src/routes/evaluate.js`, and `server/src/routes/save.js`.

## Reliability and Scaling

- Media uploads use memory-backed Multer with a 60 MB default cap (`server/src/middleware/upload.js`). Admission control in `server/src/lib/jobLimiter.js` applies when ffmpeg work begins, after request bodies have already been buffered, so bursts can still consume substantial memory before the semaphore helps.
- Rate limits, surge tracking, and the media semaphore are process-local (`server/src/middleware/rateLimit.js`, `server/src/middleware/surge.js`, `server/src/lib/jobLimiter.js`). Horizontal Railway scaling silently multiplies the configured ceilings; T-10011 calls for a shared store before scaling out.
- An evaluation acquires the media semaphore separately for audio extraction and video transcoding. The second acquisition can return `503 busy` after the paid Scribe request has already completed, wasting provider cost under saturation.
- The service kill switch fails open when its backing database check fails (`server/src/middleware/killSwitch.js`). This favors availability, but it weakens the operator’s ability to stop spend during a Supabase incident.
- The AI path is latency-heavy and multi-stage: upload → ffmpeg audio extraction → Scribe → alignment/scoring → ffmpeg proxy transcode → OpenRouter/Gemini. `server/src/routes/evaluate.js` has a 240-second deadline and the client waits five minutes; even successful requests can take roughly 60–120 seconds.
- The OpenRouter video request depends on provider routing details and base64 payload behavior in `server/src/lib/evaluate.js`. A direct Gemini fallback exists, but real-provider regression tests are outside CI.
- `client/src/store/session.ts` is memory-only. Reloading, opening a result URL in a new tab, or browser eviction loses the active project, recorded blob, result, and retimed path, and route guards send the user home. That is acceptable for an ephemeral MVP but fragile on mobile during long evaluations.
- `client/src/lib/supabase.ts` converts anonymous-auth setup failures into a null token. The subsequent API request fails as unauthorized, but the user receives a generic request error rather than an auth-specific recovery path.

## Product and UX Risks

- `MIN_ALIGN_COVERAGE` defaults to `0.5` in `server/src/config.js` with no production corpus behind it. It directly controls whether a take updates the next teleprompter path; T-10019 requires tuning from real `scores.coverage` data.
- The home-page duration estimate in `client/src/lib/estimate.ts` is calibrated around whitespace-delimited reading. It is only a hint, but it is known to be inaccurate for Hebrew and unsuitable for languages without spaces.
- The current product deliberately removed first-take improvisation, upload, transcript editing, speed controls, and cloud save from the main flow. Old specs and dormant code can make those features appear supported when the live flow is strictly text-first.
- The backend cloud-save path and `client/src/app/videos/page.tsx` remain functional but are unlinked from the main experience. The videos page reads Supabase directly, has no populated visual fixture, and still uses native video controls instead of `client/src/components/ui/VideoPlayer.tsx`.
- `GET /api/ad` always returns a demo video from `server/src/routes/ad.js`. `docs/TASKS.md` says launch should be ad-free until meaningful traffic, so an explicit `ADS_ENABLED` gate is needed to avoid showing a placeholder ad to real users.
- The results desktop layout has acknowledged empty space below the actions column. The intended fix is useful score context or history, not stretched controls; tracked as T-10025.
- `/karaoke` cannot be captured by the normal screenshot suite because it needs live camera access. Its actual contrast, eye-line, stop control, denial state, and RTL behavior still depend on real-device review.
- The admin Service tab is optimistic and there is no read endpoint for current service state. A fresh admin session can display “ACTIVE” without verifying the persisted kill-switch value, and the planned surge-alert banner is not wired.

## Data and Deployment Reproducibility

- `server/db/migrations/0001_init.sql` documents creation of the private `videos` bucket but does not create it. A fresh Supabase environment is not reproducible from repository migrations alone; tracked as T-10012.
- The schema retains dormant `projects.original_words` and `projects.speed` columns from superseded flows. The API/client types also retain some old use-case and save concepts. These are intentional compatibility remnants, but they raise the cost of understanding the current product.
- The application depends on a manually configured Supabase project, anonymous auth, RLS, private storage, several provider keys, cross-origin cookies, and exact Railway environment variables. Startup checks protect admin secrets, but configuration drift remains a significant launch risk.
- There is no checked-in CI workflow in the current repository file map. The documented commands are strong, but automated enforcement depends on the developer or deployment process actually running them.

## Recommended Order of Work

1. Complete the real-key smoke test and the shortest critical iPhone/desktop/RTL manual path before changing features.
2. Resolve launch configuration: reproducible Supabase setup, Railway variables, explicit ad disablement, and deployed cross-origin admin verification.
3. Close the small security backlog: sanitized 5xx responses, JWT claim validation, security headers, and trustworthy stored MIME metadata.
4. Collect real alignment coverage and latency/cost data, then tune `MIN_ALIGN_COVERAGE` and capacity limits.
5. Only after v1 behavior is verified, decide whether to revive cloud save and proceed with the public feed/identity scope in `docs/pitchmi-v2-spec.md`.

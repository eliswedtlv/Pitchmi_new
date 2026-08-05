# PitchMi production security audit — 2026-08-05

Scope: Next.js client, Express API, anonymous Supabase authentication/data
ownership, admin cookie flow, media upload/ffmpeg path, third-party AI calls,
dependencies, browser headers, Railway deployment posture, and the new consent
and erasure flow.

This is the standard technical release review for the v1 launch. It is not a
legal opinion or a claim that any internet service is risk-free.

## Release verdict

**Technical gate: GO after the manual checks at the end of this document.**

No open critical or high code/dependency finding remains in the reviewed
single-instance deployment. Both npm workspaces report zero known
vulnerabilities after the upgrades recorded below.

## Checks performed

- Read-only secret scan of tracked files for common API/JWT/key patterns.
- `npm audit` and `npm audit --omit=dev` in client and server.
- Authentication, ownership, CORS, cookie, rate-limit, upload, ffmpeg,
  provider-error, storage, and deletion path review.
- Browser/API response-header review over HTTPS and HTTP→HTTPS redirect check.
- Full Jest, Vitest, TypeScript, StandardJS, Next production build, and
  Playwright responsive suite.
- Real Chromium review of consent at 390px/1440px and the privacy/deletion page.

## Findings closed in T-10029

| Severity | Finding | Resolution |
|---|---|---|
| High | Next 15.5.20 had current framework advisories; its latest 15.x patch still bundled a PostCSS version covered by file-read advisories. | Upgraded to Next 16.3.0, the nearest release with a clean production tree; production build and all UI/layout tests pass. |
| High | Old Vitest/Vite development servers and a server transitive dependency had current advisories. | Upgraded Vitest/Vite React tooling and refreshed the server lockfile; full and production-only audits are zero/zero. |
| High | `SameSite=None` admin cookie plus CORS alone did not prevent a cross-site form POST from reaching `/api/admin/service`; CORS blocks response reads, not request delivery. | Admin login/service POSTs now require the configured browser `Origin` and JSON content type. Regression tests prove a foreign form cannot pause the service. |
| Medium | Client and API lacked a standard browser security-header baseline. | Client CSP/HSTS/frame/referrer/permissions/COOP/CORP/nosniff headers added; API uses Helmet with API-specific CSP and the same baseline. Framework fingerprints are disabled. |
| Medium | Generic API/evaluation 500 responses echoed internal/provider messages. | Public 500s now return only `server_error`; bounded detail remains in content-free operator logs. |
| Medium | ES256 JWT verification checked signature/expiry but not the Supabase issuer or authenticated audience. | JWKS verification now pins ES256/RS256, project issuer, and `authenticated` audience; wrong-issuer test added. |
| Medium | Consent could have been a client-only acknowledgement. | Processing routes require a current server-side anonymous consent receipt. The typed name/initials never leaves the device. |
| Medium | Users without login had no direct erasure path. | `/privacy` exposes authenticated anonymous erasure of storage objects, saved takes, projects/scripts, metadata events, and the Supabase anonymous user. |
| Medium | Saved-video deletion removed only the DB row, leaving a private orphan in Storage. | Deletion now goes through the API and removes the owned private object and row together. |
| Medium | `/api/save` trusted declared MIME/extension. | Storage content type and extension now come from WebM/MP4 magic bytes; unidentified bytes are rejected before Storage. |
| Low | Multipart bodies bounded file bytes but not field/part counts; JSON allowed 1MB despite a 1,200-character script ceiling. | Multipart files/fields/parts/field-size and JSON body size are explicitly bounded. |
| Low | Production could boot with missing core Supabase/provider/CORS variables and fail only on first use. | Startup now fails closed when required service variables are absent and warns on weak admin secret/password lengths. |

## Existing controls confirmed

- HTTPS is enforced by Railway and plain HTTP redirects to HTTPS.
- Service-role and provider keys remain server-only; no tracked secret pattern
  was found.
- Anonymous JWT ownership checks and Supabase RLS isolate projects/saved takes.
- CORS fails closed and credentials are limited to configured client origins.
- Admin cookie is signed, HttpOnly, Secure, SameSite=None, and expires after 12h.
- Billable routes have per-IP limits plus per-anonymous-user daily evaluation
  limits; a surge trip and operator kill switch remain available.
- Media stays in memory/temp files, input container is magic-byte identified,
  ffmpeg accepts only local file input, stdin is closed, execution is timed out,
  and concurrency/queue sizes are bounded.
- Evaluation providers receive a reduced proxy, upstream requests have deadlines,
  and public failures do not expose upstream payloads.
- Private saved media is served only through short-lived owner-checked URLs.
- No application path renders user input as HTML or uses dynamic code execution.

## Accepted residual risks / tomorrow checklist

1. **Keep Railway at one server replica for launch.** Rate-limit and media-queue
   state is in process; horizontal replicas multiply the ceilings (T-10011).
2. **Verify provider privacy settings/terms in the production ElevenLabs,
   OpenRouter and Google accounts.** The app now discloses third-party
   processing, but account-level retention/training settings live outside code.
3. **Confirm production secrets:** `ADMIN_COOKIE_SECRET` ≥32 random characters,
   `ADMIN_PASSWORD` ≥12 unique characters, exact `CLIENT_ORIGIN`, service-role
   key only on the server, and the unused provider key omitted.
4. **Run one real iPhone/desktop consent → record → evaluate → results pass.**
   Automated tests mock paid providers and cannot replace this.
5. **Run the bundled real-key smoke once** from the production configuration or
   a safe operator environment.
6. **Test “Delete my PitchMi data” with a disposable browser identity** and
   confirm the browser returns to a fresh consent state.
7. **CSP still allows inline scripts/styles** because Next App Router hydration
   requires inline bootstrap today. Risk is reduced by no user HTML rendering,
   no third-party page scripts, `object-src 'none'`, `frame-ancestors 'none'`,
   strict connect destinations, and all other sources self-only. Request-scoped
   nonces are a future defense-in-depth improvement.
8. The private `videos` bucket exists in production but is still described,
   not created, by migrations (T-10012). This affects reproducibility, not the
   current deployed bucket’s privacy.

## Automated evidence

- Client: 118/118 Vitest, strict TypeScript, production build exit 0.
- Server: 204/204 Jest after the final storage tests, StandardJS clean.
- Layout: 45/45 Playwright across 390/1024/1440 light/dark states.
- Dependencies: client 0, server 0 findings in full and production-only audits.

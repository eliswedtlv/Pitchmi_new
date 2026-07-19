# PitchMi — TASKS

Backlog and follow-ups. Active v1 build is T-1150 (see `docs/cc-goal-pitchmi-v1.md`).

| ID | Task | Status | Notes |
|---|---|---|---|
| T-1150 | v1 core loop — greenfield build | done | Server + client per v1 spec. All §13 acceptance checks pass (70 automated tests). Pending: real-key smoke + manual QA. |
| T-1151 | Create GitHub remote + push | done | Remote `https://github.com/eliswedtlv/Pitchmi_new.git`; pushed `main` 2026-07-16. |
| T-1151b | Auth: verify Supabase ES256 JWTs via JWKS | done | Prod project issues ES256 (kid) user JWTs; middleware now verifies against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` via `jose` (cached), HS256+secret fallback kept. `jose` pinned to 5.x (v6 ESM-only). Committed as T-1151. |
| T-1160 | QA fixes: eval wait UX + safe-area + demo ad | done | Live iPhone QA. (A) XHR eval with 5-min timeout + upload progress + staged wait screen; Skip Ad never aborts (tested); wake lock re-acquires on visibility; server logs `scores.timings`. (B) Branded 15s demo ad via `genAd`. (C) `viewport-fit=cover` + safe-area padding on bottom CTAs. |
| T-1159 | Eval: force JSON mode + robust parsing | done | Prod P1 "no JSON object in model output" on `/api/evaluate`. JSON mode (OpenRouter `response_format`, Gemini `responseMimeType`); fence-stripping + balanced-block parser; 3rd stricter retry; metadata-only diagnostic event on final failure. `tests/evaluate.test.js` added. |
| T-1153 | Provision Supabase project + run migrations | todo | Create project, run `server/db/migrations/*.sql`, enable anon sign-in, create private `videos` bucket, set env vars, run `scripts/smoke.js`. Eli (manual). |
| T-1154 | Deploy two Railway services | todo | Root `client/` and root `server/`; set env from `.env.example` files. Eli (manual). |
| T-1152 | Swap ad stub for a real ad network | todo | `<AdSlot/>` + `GET /api/ad` contract designed to be swappable. Network TBD (v2 §2.6). |
| T-1155 | Verify OpenRouter video content-part shape | todo | Confirm `video_url` data-URL part works with `google/gemini-3.1-flash-lite` via OpenRouter; else use `EVAL_PROVIDER=gemini` inline_data fallback. |
| T-1156 | Wire admin "surge trip < 24h" banner + service-state read | todo | Derive from `surge_trip` events; optional GET service-state endpoint. |
| T-1200 | PitchMi v2 milestone | future | Google sign-in, public feed, leaderboards, moderation. See `docs/pitchmi-v2-spec.md`; convert to a `/goal` spec after v1 ships and its real code can be inspected. |

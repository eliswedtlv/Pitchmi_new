# CCW → Claude Code handoff

Written 2026-10-15. This file replaces the Cowork chat context that CC sessions cannot read. It is the only place some of these decisions are written down.

**Product:** KillerPitch (repo and most docs still say "PitchMi"). Responsive web app, desktop + mobile browsers. Type or paste a script of ≤30 seconds → consent → rehearse on camera against a timed karaoke teleprompter → AI scores **delivery only, never content** → results → every take re-times the prompter to your measured pace. No signup; Supabase anonymous identity per device.

**Repo:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`, branch `main`, remote `https://github.com/eliswedtlv/Pitchmi_new.git`, head `b5a02d8` (2026-08-13).
**Live:** Railway project `pitchmi`, two services — client `https://client-production-efa0.up.railway.app`, server `https://server-production-39a0.up.railway.app`. Public domain in code: `killerpitch.app`. Supabase project `ciknhdocqyuxlzsnhzbc` (org TLVG, eu-central-1), anonymous sign-ins enabled.
**Working tree is not clean:** `docs/TASKS.md` has one uncommitted edit (the T-5540 Hebrew block at the top). Nothing else is modified.

---

## 1. Eli's decisions

Shipped and reflected in the code:

- **2026-07-24 — Zero-edit flow.** Transcript editor and the whole re-pacing engine removed. Editing re-paced the karaoke and never felt like the user's own rhythm. (T-1169)
- **2026-08-01 — 30-second hard cap, no grace.** His words: "If you can't say it in 30 seconds, you can't say it." Client auto-stops at 30.000s; server rejects above 33s (3s tolerance absorbs container rounding only). (T-1172)
- **2026-08-02 — Text-first flow.** The entry point is a script you type, not a recording. Reason: people cannot edit by speaking again. This pivot killed the specced `/read` screen and `POST /api/calibrate` mid-build. (T-10018)
- **2026-08-03 — Slogan is "If you can't say it in 30 seconds, don't say it"** and the five-way use-case picker is deleted from the UI *and* from the AI prompt. (T-10021)
- **2026-08-04 — "UI extremely schematic."** His verdict on the T-10022 screens; triggered the second visual pass (custom player, real desktop layout, one brand accent, composer fills the viewport). (T-10024)
- **2026-08-04 — "it's not very AI this indigo?"** Rejected the researched indigo accent because indigo-violet (~240–280°) is the default accent of AI-generated UI. Accent is now fuchsia `#a21caf` light / `#e879f9` dark. (T-10027)
- **2026-08-04 — Launch-ready "Studio 2026" redesign** from his Betas-inspired identity brief; produced `docs/PRODUCT-SPEC.md` and `docs/UI-SPEC.md`. (T-10028)
- **2026-08-05/06 — Ship with a loginless consent step and vendor-neutral privacy wording.** `/privacy` names no suppliers. (T-10029, T-10030)
- **2026-08-13 — Rebrand to KillerPitch** and publish, domain `killerpitch.app`.

Decisions **not yet reflected in code or docs** — these are the ones a new session will otherwise miss:

- **Ads: the release goes out without ads.** Ads only once traffic is around 100K impressions/month, which is roughly the floor video SSPs will onboard at. **Not implemented:** there is no `ADS_ENABLED` flag anywhere, and `AdSlot` still renders on `/wait` whenever `GET /api/ad` returns a config. (T-10023)
- **The rebrand is only half done in the docs.** Code, README, `PRODUCT-SPEC.md` and `UI-SPEC.md` say KillerPitch. Still say PitchMi: root `CLAUDE.md`, `docs/STATUS.md`, `docs/TASKS.md`, `docs/design-direction.md`, and the CCW PM central files. Note the name collides with an older inactive prototype at `/Users/eliswed/Dropbox/Code/killerpitch` — different project, do not touch it.
- **2026-10-01 — Hebrew UI must be complete end to end** (RTL), including the take-1 teleprompter, karaoke, and the shared video overlay. Required for every TLVG app. No spec written yet. (T-5540)
- **Google identity upgrade is deliberately gated.** Code is complete and merged but the entry point is feature-flagged off pending provider setup. (T-10031)

Standing product rules that are decisions, not preferences:

- The AI evaluates **presentation only** — voice, body language, timing, accuracy — and never judges the topic or the content of the pitch.
- Normal rehearsal writes **nothing** to cloud storage. Take videos live in memory/temp and are discarded after transcription and evaluation.
- Operator logs carry numeric diagnostics and consent metadata only — never video, transcript, typed acknowledgement, or feedback text.

---

## 2. Agreed or specced, not yet built — priority order

**P0 — blocks the next deploy**

1. **T-10017 — production env + deploy verification (Eli, manual).** Confirm one server replica on Railway; `ADMIN_COOKIE_SECRET` ≥32 random chars; `ADMIN_PASSWORD` ≥12 unique chars; `CLIENT_ORIGIN` exact; ElevenLabs/OpenRouter/Google retention and training settings correct. The server has crashed before (2026-08-01) purely from a missing `ADMIN_COOKIE_SECRET`.
2. **The manual QA checklist in `docs/STATUS.md` has never been reported back.** Roughly 50 unchecked boxes spanning T-1160 through T-10029. The ones that gate launch are the T-10029 consent/privacy/headers/admin-origin checks and the full iPhone Safari + desktop Chrome round trip with real provider keys.

**P1**

3. **T-5540 — Hebrew end to end.** Verify and complete RTL across the teleprompter, karaoke and the shared video overlay. Needs a spec; nothing written. Cross-project context lives in `/Users/eliswed/Dropbox/Code/tlvg-launch-plan/03-marketing-plan-v2.md`.
4. **T-10031 — un-gate the Google identity upgrade.** Code-complete; waiting on Google provider setup in Supabase, then flip the flag and verify `linkIdentity` preserves the anonymous identity.
5. **T-10027 judgement calls.** The accent swap shipped but the four things only Eli can answer are still open — see section 3.

**P2**

6. **T-10023 — ads flag.** Implement `ADS_ENABLED` server-side (default off) or remove `AdSlot` from `/wait`. Today the ad slot is one API response away from appearing in production.
7. **T-10019 — `MIN_ALIGN_COVERAGE = 0.5` is a guess.** It decides whether a take is trusted to re-time the prompter. Every evaluate event now logs `scores.coverage` and `scores.retimed`; tune it after a week of real rows.
8. **T-10020 — re-time/response race.** `evaluate.js` persists the re-timed path before the AI eval call. Deliberate (the timings are a measured fact and survive a 504), but it means a failed eval still moves the prompter.
9. **T-10011 — rate limiter and media semaphore are in-process**, so every ceiling is per container. Correct on one Railway instance; horizontal scaling silently multiplies them.
10. **T-10012 — the private `videos` bucket is not reproducible from the repo.** Live state verified correct; there is no migration that recreates it.

**P3**

11. **T-1156** — wire the admin "surge trip < 24h" banner and a service-state read.
12. **T-1152** — swap the ad stub for a real network (only after T-10023 and real traffic).
13. **T-1200** — v2 milestone: public feed, leaderboards, moderation. See `docs/pitchmi-v2-spec.md`.

**Housekeeping**

14. Commit the T-5540 block currently uncommitted in `docs/TASKS.md`.
15. The CCW PM central files are stale from T-10025 onward: `CCW PM/Tasks.md` still lists T-10025, T-10026, T-10027 as open and T-10013/14/15/16 as backlog, all of which are done; `CCW PM/done_tasks.md` stops at T-10024; `CCW PM/projects.md` still describes the record-first ≤60s loop and names head `ce8ae03`. Trust the repo, not those files.

---

## 3. Open questions waiting for Eli

- **Does the fuchsia accent still read as "AI-built"?** This is the judgement T-10027 exists for and it has not been answered. Look at `docs/ui/*.png` (30 shots: 5 screens × 3 widths × 2 schemes).
- **The disabled Record button** with an empty script box, in both schemes: does it read as disabled, or as an enabled button in a lighter shade? Fuchsia at reduced opacity is closer in lightness to its enabled state than the old near-black was.
- **`/results` with a score in the 50s–60s** (red Accuracy bar, amber Body) next to the fuchsia Try again: any hesitation about which colour means "score" and which means "the action"?
- **The wordmark on a real phone** — 12px uppercase at `tracking-[0.18em]`: deliberate, or faded?
- **Ads:** implement the flag, or delete the ad slot for now?
- **The rebrand sweep:** rename the remaining PitchMi docs and the repo folder to KillerPitch, or keep PitchMi as the internal name?
- **Hebrew (T-5540):** is it the next build, and does it go to CC or Codex?
- **Stale central row:** `CCW PM/Tasks.md` still shows T-1169 as "CC spec ready" though it shipped in `196ca06` — move it to `done_tasks.md`?

---

## 4. Eli's rules for this project

Working rules:

- **Specs always live under `docs/`.** Never anywhere else. Quote the path **repo-relative** (`docs/CW-X.md`), never absolute — if it gets pasted into the wrong session, the path fails to resolve and the mistake surfaces before damage.
- **Every CC prompt opens with:** "Read CLAUDE.md/AGENTS.md and docs/update_status.md first. After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, commit and push the changes." And closes with a reminder to commit, push and update STATUS.
- **Every shell command uses absolute paths.** No `cd` and a relative path.
- **Never assume he read the agent's output.** Restate anything actionable in plain words. This was repeated many times.
- **One question at a time.** Short plain prose; no tables or bullet lists unless he asks for them; minimal bold.
- **The PM/coordinator layer does not push, delete, or run destructive commands.** Draft the command and ask. CC itself does commit and push as part of its prompt.
- **Do not clone the repo.** Work in place.
- **No `.docx` files** unless he explicitly asks.
- **Keep the task docs in sync.** Updating the central CCW PM list while leaving the project's `docs/TASKS.md` stale (or the reverse) is a failure, not an omission.
- **Trust the codebase over the docs** when they disagree, and say which doc is stale.

Product rules that constrain any change:

- One filled action per screen, and the brand accent is spent only on three things: that one filled action plus focus rings, progress and position fills, and the wordmark. It must never read as a score.
- Score colours are reserved: green 142°, amber 32°, red 0°. The accent stays far from all three and out of the 240–280° AI-default band.
- The 30-second cap is hard. No grace, no trimming.
- The AI never comments on content.

---

## 5. Where everything is

Project docs (`/Users/eliswed/Dropbox/Code/Pitchmi_new/docs/`):

- `STATUS.md` — shipped log with the reasoning behind each task, known gaps, deviations, and the manual QA checklist. Current through T-10031; missing the 2026-08-13 rebrand.
- `TASKS.md` — the project backlog table.
- `update_status.md` — how STATUS.md must be maintained.
- `PRODUCT-SPEC.md`, `UI-SPEC.md` — the current product and UI contracts (T-10028, Studio 2026). These supersede earlier UI guidance.
- `design-direction.md` — the researched design direction, token layer, accent reasoning and contrast tables.
- `ui/` — 30 screenshots, regenerated by the Playwright screens spec.
- `SECURITY-AUDIT-2026-08-05.md`, `GOOGLE-AUTH-SETUP.md`.
- Specs that produced the current code: `cc-goal-pitchmi-v1.md`, `cc-goal-text-first-flow.md`, `cc-goal-release-ui.md`, `cc-goal-visual-pass-2.md`, `cc-prompt-accent-fuchsia.md`, `cc-goal-release-hardening.md`, `cc-goal-30s-cap-and-cost-truth.md`, `cc-goal-drop-use-case.md`, `cc-goal-timing-and-results.md`, `cc-goal-zero-edit-flow.md`, `cc-goal-rtl-clean-transcript.md`, `cc-goal-mobile-ux-fixes.md`, `cc-goal-teleprompter-eval.md`.
- `pitchmi-v2-spec.md` — v2 scope, not current work.
- Root `CLAUDE.md` — agent instructions for this repo.

Cross-project PM files (`/Users/eliswed/Dropbox/Code/CCW PM/`): `projects.md`, `Tasks.md`, `done_tasks.md`. Stale for this project from T-10025 onward — see §2.15.

Stack, for sizing work: client Next.js (pinned 15.5.20, deviated to 16.3.0 in T-10029) + React 19 + TS 5.7 strict + Tailwind v4 (no config file; tokens live in `client/src/app/globals.css` under `@theme`) + cva + tailwind-merge + zustand; Vitest + Testing Library + Playwright (dev server port 3123). Server Express 4, JavaScript ES6, StandardJS without semicolons, Jest + Supertest. Node ≥22.

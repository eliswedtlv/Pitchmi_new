# T-10022 — Release UI pass, researched against real shipped products

Read `CLAUDE.md`/`AGENTS.md` and `docs/update_status.md` first. After completing all changes, update `docs/STATUS.md` by following `docs/update_status.md`, update `docs/TASKS.md` if task state changes, commit and push the changes.

**Task ID:** T-10022
**Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Depends on:** T-10021 (`docs/cc-goal-drop-use-case.md`) must be merged first — it removes the use-case card from the home screen, and restyling a component that is about to be deleted is wasted work.
**Type:** one CC task, research-first. **Presentational only** — see the non-scope section, which is the most important part of this spec.

---

## Why this task exists

PitchMi is functionally complete and about to go public **without ads**. Every screen is currently first-draft Tailwind: `bg-neutral-50`, default `Card`, a `text-7xl` number, stock shadcn buttons. It works and it looks like scaffolding. Eli's instruction: research real, shipped product UIs — via **Refero** and comparable web apps — and bring the app to release quality.

The research is not decoration on this task. Designing from taste alone is how the first draft happened. The deliverable is a written direction grounded in specific referenced products, then an implementation of that direction.

---

## Phase 1 — Research (do this before touching a single component)

### Refero

Refero (`refero.design`) is a structured library of ~150K real product screens, searchable by page type, UX pattern and company, and it exposes an **MCP server for agents** at `https://api.refero.design/mcp` (three layers: *styles* → visual direction, *screens* → concrete page patterns, *flows* → journey logic). If it is already connected in this session, use it — it is the single best source for this task.

If it is not connected, it can be added with:

```
claude mcp add --transport http refero https://api.refero.design/mcp --header "Authorization: Bearer <token>"
```

**It requires an active Refero Pro subscription and a token that this repo does not contain.** Do **not** go looking for credentials, do not commit a token, and do not block on it. If Refero is unavailable, say so plainly in `docs/design-direction.md` and run Phase 1 from the fallback list below — the research still happens, just from public product pages instead of a curated index.

### What to look for, whichever source you use

Study these three page archetypes specifically, because they are the three screens this app has:

1. **A single-input "write the thing" screen** — one textarea, a live constraint counter, one primary action. Reference class: Twitter/X composer, Threads composer, Linear's issue create, Typefully, Grammarly's editor, Descript's script view, Teleprompter.com, BigVu.
2. **A waiting / processing screen** where the wait is 10–60s and the product wants the user to stay. Reference class: Midjourney and Runway generation states, Descript transcription, Riverside processing, Vercel deploy logs.
3. **A score / result screen with one headline number plus sub-dimensions.** This is the screen that matters most and the current one is the weakest. Reference class: Yoodli's speech report, Speeko, Orai, Duolingo's lesson-complete, Strava's activity summary, Whoop/Oura recovery scores, PageSpeed Insights, Grammarly's performance score.

Extract from each: type scale and how many sizes are actually used, how the primary number is weighted against its supporting dimensions, colour discipline (how few hues carry the whole product), spacing rhythm, how the primary action is anchored on mobile, and how empty/loading/error states are handled without a layout jump.

### Phase 1 deliverable — `docs/design-direction.md` (commit it)

A short document, not an essay. It must contain:

- Which source was used (Refero MCP or fallback), and if Refero was unavailable, that fact stated outright.
- **6–10 specific references**, each named with product + screen + the one thing being borrowed. "Yoodli's report screen — the headline score sits left of the dimension list, not above it, so the eye lands on the number and then reads down" is a usable note. "Modern, clean, minimal" is not, and will be rejected.
- The chosen direction in concrete terms: type scale (list the exact steps), the colour set (list the exact tokens), spacing rhythm, corner radius, elevation policy, motion policy.
- What is deliberately **not** being changed and why.

Write it, then implement it in the same run — do not stop and wait.

---

## Phase 2 — Foundations

Read `client/src/app/globals.css` (51 lines) first.

- **Build dark mode properly. This is a product requirement, not a cleanup task** (Eli, explicitly: the app ships with dark mode). Today `globals.css` declares a `prefers-color-scheme: dark` block setting `--background: #0a0a0a` / `--foreground: #ededed`, and `layout.tsx` puts `bg-background text-foreground` on `<body>` — but every screen then hardcodes `bg-neutral-50`, `bg-white`, `text-neutral-900`, so the declaration is a lie: a dark-mode device gets a mostly-light app with dark leaking wherever a screen happens not to override. The fix is not to delete the dark block. It is to make every screen honour it. See **Phase 2b** below, which is the real work of this phase.
- Define the design tokens as Tailwind v4 `@theme` variables in `globals.css` (this project is Tailwind v4 — there is no `tailwind.config.js`, tokens live in CSS). Screens then reference tokens, not raw `neutral-` steps.
- Update `client/src/components/ui/button.tsx`, `card.tsx` and `badge.tsx` to the new tokens. **Keep every existing variant name** (`default`, `destructive`, `outline`, `ghost`, `secondary`, `success`; sizes `default`, `sm`, `lg`, `icon`) — call sites across five screens depend on them and renaming variants turns a visual pass into a refactor.
- Typography: the app currently runs on `system-ui`. If the direction calls for a typeface, use `next/font` with a self-hosted or Google font — no runtime `<link>` to a third-party CSS file, and check the Hebrew glyph coverage before choosing, because Hebrew is a first-class language in this product (T-1164) and a font with no Hebrew will silently fall back mid-screen.

### Phase 2b — dark mode

Dark mode is not a colour inversion. Do it as a semantic token layer, defined once, consumed everywhere.

- **Semantic tokens, not raw palette steps.** Define the set — background, surface (cards), surface-raised, border, foreground, foreground-muted, primary, primary-foreground, success, warning, danger, and whatever the score treatment needs — as Tailwind v4 `@theme` variables in `globals.css`, with a light value and a dark value each. Screens reference `bg-surface`, never `bg-white`. A screen that still hardcodes a neutral step is a screen that will break in dark mode, and grep is the acceptance test: after this task, no in-scope screen should contain `bg-white`, `bg-neutral-50`, `text-neutral-900` or the like where a token exists for the job.
- **Switching mechanism: follow the OS** via `prefers-color-scheme`, with **no in-app toggle** in this task. That keeps the change to CSS and avoids introducing persisted preference state, a hydration-mismatch class of bug, and a settings surface the product does not otherwise have. If a manual toggle is wanted later it is a small follow-up on top of this token layer — note it in `docs/design-direction.md` as such, do not build it here.
- **Dark is not just inverted.** Pure `#000` on `#fff` inverted reads as harsh and flattens hierarchy. Follow what the referenced products actually do: a near-black background rather than true black, elevation expressed by *lighter* surfaces rather than by shadow (shadows are close to invisible on dark, so a card that relies on `shadow-sm` for separation in light needs a border or a raised surface in dark), and slightly **desaturated** accent colours, because a saturated hue that is comfortable on white vibrates on near-black.
- **The score colours are the hard part.** `/results` currently keys on green ≥80 / amber ≥65 / red below, and amber is the colour that fails first — `amber-500` on near-black is fine, `amber-600` (the light-mode choice) is not, and `amber-100` fills disappear entirely. Every score state must hold WCAG AA in **both** schemes; check all three bands at both ends of their range.
- **The camera screens are already dark and stay dark.** `/karaoke` is a full-bleed camera feed with dark chrome in both schemes — that is correct and deliberate, not an inconsistency to fix. Same for the recording controls. What changes there is only that the chrome should use the dark token values rather than ad-hoc blacks. Note this exception in `docs/design-direction.md` so nobody "fixes" it later.
- **The over-length mirror layer on `/`.** The amber tail tint (`bg-amber-100`) is a fill behind transparent text; in dark mode it needs a low-alpha amber over the dark surface instead, and the text under it must stay legible. This is a token, not a one-off class — and see the regression risk about `TEXT_BOX` before changing anything in that block.
- **Test both schemes.** Vitest/jsdom will not catch a dark-mode failure. The Playwright screenshots in Phase 4 are the real check.

## Phase 3 — Screens

In scope, in priority order:

1. **`/` — `client/src/app/page.tsx`.** Post-T-10021 this is: wordmark, slogan, script textarea with the amber over-length tail, the estimate row, and one **Record it** button. The hierarchy should make the 30-second constraint feel like the product's point rather than a validation warning. The over-length mirror layer is geometry-critical — see the regression risks.
2. **`/results` — `client/src/app/results/page.tsx`** (193 lines). The headline overall score, the three AI dimension bars plus timing and accuracy, the coach comments, and the three actions (Try again / New video / Share) plus Edit text. This is the screen a user shows someone else. Give it the most attention.
3. **`/wait` — `client/src/app/wait/page.tsx`** (115 lines). Staged progress copy already exists in `lib/evalStages.ts`; make the wait feel accounted for rather than hung.
4. **`/karaoke` — `client/src/app/karaoke/page.tsx`** (112 lines): **chrome only** — the countdown ring, the stop control, the error block, the safe-area handling. The `Prompter` component itself is out of scope (see non-scope).
5. **`/videos` — `client/src/app/videos/page.tsx`.** Not linked from the product today (T-1170 §B4) but reachable by URL. Bring it to the same tokens; do not invest beyond that.

`client/src/app/admin/page.tsx` and `client/src/app/dev/**` are internal tools — **leave both alone**.

## Phase 4 — Review artifact

Eli reviews UI by looking at it, so produce something to look at.

Add `client/tests-layout/screens.spec.ts` capturing full-page screenshots at **390×844** (iPhone 12 portrait) and **1440×900**, **in both colour schemes** (Playwright's `colorScheme: 'light' | 'dark'` context option), written to `docs/ui/` and committed. Name them so a pair is obvious at a glance, e.g. `results-390-dark.png`. Follow the existing `/dev/prompter-layout/[fixture]` precedent (`client/src/app/dev/prompter-layout/[fixture]/page.tsx`) for anything that needs seeded state: add dev-only fixture routes under `/dev/ui/[screen]` that render the real `/results` and `/wait` screens against a fixed fixture, so they can be shot without a live backend. `/` needs no fixture. `/karaoke` needs a camera and is excluded — check it by hand instead.

The existing `playwright.config.ts` already boots the dev server on port 3123 with `reuseExistingServer`, so this needs config changes only if you add a second viewport project.

---

## Explicitly NOT in scope — read this twice

This task changes **how the app looks**. It changes nothing about what it does. Specifically, do not touch:

- `client/src/hooks/useRecorder.ts`, `useKaraokeClock.ts`, `useWakeLock.ts` — recording, the 30s cap, `stopReason`, the karaoke clock.
- `client/src/components/Prompter.tsx` — its geometry is the subject of a real-browser layout proof (`tests-layout/prompter-rtl.spec.ts`, T-1163). Restyling it risks breaking RTL word positioning in a way jsdom cannot catch. Colour and font-size **inside** the prompter are also part of a legibility trade-off made on-device with a tester; leave it.
- `client/src/lib/clock.ts`, `estimate.ts`, `evalStages.ts`, `limits.ts`, `recorderConstraints.ts`, `textDir.ts`, `api.ts` — no logic, no thresholds, no constants.
- `client/src/store/session.ts` — no state-shape changes.
- **The entire `server/` directory.** Not one file.
- Scoring, prompts, the eval pipeline, the DB schema.
- Routes and navigation: same screens, same order, same buttons doing the same things. No new screens, no onboarding flow, no marketing landing page, no settings.
- Copy, except where a direction change makes a label wrong. The slogan is settled (T-10021). Coach comments come from the model and are not editable here.
- Ads. `AdSlot` renders on `/wait` when `/api/ad` returns a config; whether it shows at launch is a separate decision (tracked as T-10023) — restyle the component to the new tokens if you touch it, but do **not** change when it appears.
- `package.json` dependencies, beyond `next/font` usage if a typeface is adopted. No component library swap, no animation library, no icon library change (`lucide-react` stays).

If the research suggests a change that requires touching anything on this list, **write it into `docs/design-direction.md` as a proposal for a follow-up task** and do not implement it.

## Edge cases

- **Hebrew / RTL.** Hebrew is first-class. Every screen must survive `dir="rtl"`: use logical properties (`ps-`/`pe-`, `ms-`/`me-`, `text-start`/`text-end`) rather than `pl-`/`pr-`/`text-left`. A directional icon next to text needs to flip. Check the home screen with Hebrew typed into it — the textarea flips direction as you type (T-1164) and the over-length mirror layer must flip with it.
- **Safe areas.** `.safe-b-4/8/12` and `.safe-pos-4` in `globals.css` exist because iOS Safari's toolbar ate the bottom CTAs. `viewport-fit=cover` is set in `layout.tsx`. Any bottom-anchored element must keep using them.
- **Reduced motion.** `globals.css` already honours `prefers-reduced-motion` for `.ring-pulse`. Any motion added here must do the same.
- **Long content.** A 1200-character script (`MAX_SCRIPT_CHARS`), a 3-line coach comment in Hebrew, a score of 100 and a score of 7 — none may break the layout.
- **Small phones.** 360×640 is the floor. Nothing may require horizontal scrolling.
- **Error and loading states.** Every screen has them (`/karaoke`'s camera-denied block from T-10010, `/wait`'s 504 message, `/`'s server rejection). They are part of the design pass, not an afterthought, and they must not cause a layout jump when they appear.

## Regression risks

- **The over-length mirror layer on `/` is the single most fragile thing in this task.** A hidden mirror `<div>` sits behind the textarea and tints the words past the 30-second mark. Both layers share the `TEXT_BOX` constant (`px-3 py-2 text-base leading-relaxed whitespace-pre-wrap break-words`) and scroll in sync. **Any divergence in font, size, line-height, padding or letter-spacing between the two layers silently misaligns the amber tail** — no error, no failing unit test, just a highlight over the wrong words. If you change the textarea's typography, change it through `TEXT_BOX` and nowhere else, and verify visually with text that wraps across at least four lines.
- **The RTL layout proof** (`npx playwright test`) must stay 2/2. It measures real word geometry in a real browser.
- **Tests that assert on classes.** `client/src/app/__tests__/results.test.tsx` checks that "Try again is the green primary". If the direction changes the primary treatment, update that test deliberately and say so in STATUS — do not delete the assertion.
- **Contrast, twice.** The current palette is high-contrast neutral by accident. Whatever replaces it must hold WCAG AA (4.5:1 body, 3:1 large) **in both schemes** — a token pair that passes on white and fails on near-black is a half-finished token. The score colours are the usual failure: amber on white, and amber on near-black.
- **`next build` and bundle size.** A self-hosted font with full Hebrew coverage is not small; subset it.

## Acceptance criteria

1. `docs/design-direction.md` exists, names its source, and cites 6–10 specific product references with a concrete borrowed decision each.
2. Tokens are defined once in `globals.css` and used by every in-scope screen; no screen still hardcodes raw `neutral-` steps against a token that exists for the purpose.
3. Dark mode works on every in-scope screen, follows the OS, and is a designed dark theme rather than an inversion — no white flashes, no invisible borders, no unreadable score colours. Grep proves it: no in-scope screen hardcodes a light-only colour where a semantic token exists.
4. All five in-scope screens are visibly a single designed product, including their error and loading states.
5. Screenshots for `/`, `/results` and `/wait` at both viewports are committed under `docs/ui/`.
6. Every screen holds up at 390×844, 360×640 and 1440×900, in both `ltr` and `rtl`, and in both light and dark.
7. `npx vitest run` green, `npm run build` exit 0, `npx playwright test` green including the RTL proof.
8. `git diff --stat` shows **zero** changed files under `server/`.

## Before commit

Run `git diff --stat` and review it. Expect changes confined to `client/src/app/globals.css`, `layout.tsx`, the five in-scope `page.tsx` files, `client/src/components/ui/*`, the new `tests-layout/screens.spec.ts` + `/dev/ui` fixtures, `docs/ui/*.png`, `docs/design-direction.md`, `docs/STATUS.md` and `docs/TASKS.md`. **Any file under `server/`, or any of the hooks/lib files listed as non-scope, is a bug — revert it.**

Then:

```
git add -A && git commit -m "T-10022: release UI pass — researched design direction applied across the product screens"
```

and push.

Finally, update `docs/STATUS.md` per `docs/update_status.md` — including the dark-mode decision and any deviation from this spec — and mark T-10022 done in `docs/TASKS.md`.

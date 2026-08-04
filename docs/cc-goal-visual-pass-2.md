# T-10024 — PitchMi second visual pass: player, desktop, accent, composer

Read `CLAUDE.md`/`AGENTS.md` and `docs/update_status.md` first. After completing all
changes, update `docs/STATUS.md` by following `docs/update_status.md`, update
`docs/TASKS.md` if task state changes, commit and push the changes.

**Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Task ID:** T-10024
**Predecessor:** T-10022 (`45c8da2`) — the token layer, type scale and dark scheme it
built are correct and stay. This task does not redo them.

---

## Why this exists

T-10022 replaced first-draft Tailwind with a real design system, researched against
shipped products via the Refero MCP, and it worked: the typography, the token layer,
the two-scheme colour model and the dark theme are sound.

Eli reviewed the 16 screenshots in `docs/ui/` and the verdict was **"UI extremely
schematic."** That is accurate, and it is not a failure of the system — it is four
specific gaps the system does not cover:

1. **The video is the browser's default `<video controls>` chrome.** `/results` is
   the screen users show other people, and the largest object on it is stock Chrome
   UI. It reads as a prototype regardless of what surrounds it.
2. **There is no desktop layout.** At 1440×900 every screen is the 512px phone column
   centred in the window. Two thirds of a desktop viewport is empty canvas.
3. **The composer does not fill the viewport.** On a phone, the home screen ends
   below the Record button and the remaining ~40% of the screen is bare canvas.
4. **There is no brand accent, by deliberate decision.** T-10022 chose "no accent so
   that green/amber/red only ever mean score band" (`docs/design-direction.md` §Colour).
   The reasoning was right; the conclusion overshot. The result is a product with
   correct typography and zero identity — a wireframe. This task adds **exactly one**
   accent hue, chosen so it cannot be confused with a score band.

The reference products this app was benchmarked against (Linear, Grammarly, Teal) are
dense with content, so their restraint reads as calm. PitchMi's screens are nearly
empty, so the same restraint reads as unfinished. That is the problem to solve.

---

## Research first — this is not optional

**The Refero MCP was connected during T-10022 and was the real source.** Use it again.
If it is not available in your session, say so in writing in the design doc and fall
back to named public references — but try it first.

T-10022's research was about the *system* (type, colour, layering). This round is
about four concrete objects. Search for those objects specifically, not for "clean UI":

- **Custom video players in product UI** — playback controls that are part of a
  product's design language rather than the browser's. Look at how the scrubber,
  time, and play affordance are treated when the video is short and the point is
  review, not entertainment. Loom, Descript, Riverside, Vimeo's embed, Instagram
  story playback are the shape; find real screens.
- **Desktop layouts for a fundamentally single-column mobile product** — how apps
  that are phone-first avoid a centred 512px column on a 1440 screen without
  inventing a sidebar they do not need. Two-column result/report views, media +
  panel splits, generous but bounded max-widths.
- **Single-input composer screens that own the whole viewport** — the writing surface
  as the screen, with the frame doing the work. WhatsApp status composer was the
  T-10022 reference; find two or three more, including at least one where the screen
  is mostly empty on purpose and still looks finished.
- **Products with exactly one accent colour alongside a semantic red/amber/green
  scale** — how they keep the accent from reading as a status. This is the hardest
  of the four and the one most likely to go wrong.

**Deliverable:** append a new top-level section `## T-10024 — second pass` to the
existing `docs/design-direction.md`. Do not create a second design doc. Cite **6–10
specific references**, each with the one concrete decision being borrowed and, where
you can, whether you read it as an image or as metadata. "Modern, clean, minimal" is
an explicitly rejected finding — if a citation reduces to that, it is not a citation.

---

## What to build

### 1. `VideoPlayer` component — new file `client/src/components/ui/VideoPlayer.tsx`

Replace the native `controls` attribute on `/results` (`client/src/app/results/page.tsx`,
the `<video src={takeBlobUrl} controls playsInline .../>` block) with a component built
from the token layer.

Requirements:

- Props: `src: string`, optional `className`. Keep it presentational — no session
  store access, no blob handling. `/results` still owns `takeBlobUrl`.
- Controls: play/pause affordance, current time / duration in `nums` type, a scrubber
  that seeks, and mute. **No fullscreen and no playback-rate control** — a ≤30 second
  self-review take needs neither, and both add failure surface.
- `playsInline` stays. It is load-bearing on iOS Safari — without it the take opens
  in the native fullscreen player and the user leaves the results screen.
- Keep `object-contain` and the `bg-media` letterbox. Takes are portrait on a phone
  and landscape on a desktop; the player must not crop or sideways-letterbox either.
- Click anywhere on the video toggles play/pause. Space toggles play/pause when the
  player has focus. The player is keyboard reachable and the play control has an
  `aria-label` that reflects state ("Play" / "Pause").
- Controls may auto-hide during playback, but **must be visible when paused and on
  hover/focus**, and must be visible on first paint. A control that is invisible in
  a screenshot cannot be reviewed.
- Respect `prefers-reduced-motion` for any transition, matching the existing
  `.ring-pulse` guard in `globals.css`.

**The edge case that will bite you:** the dev fixture at
`client/src/app/dev/ui/[screen]/page.tsx` seeds a `Blob(["fixture"], { type: "video/webm" })`
— it is **not a decodable video**. `loadedmetadata` never fires and `duration` is
`NaN`. The player must render its full control layout in that state without crashing
and without printing `NaN:NaN`; show `0:00` until a real duration arrives. This is
also what makes the screenshot review possible, so it is a requirement, not a nicety.

Also handle: `duration === Infinity` (a known MediaRecorder/WebM quirk — a recorded
blob can report infinite duration until it is seeked), and a scrub attempt before
metadata loads.

### 2. Real desktop layout at `lg` and up

Today every screen is `max-w-lg mx-auto`. That is right for a phone and wrong at 1440.

- **`/results`** is the screen that matters. At `lg`+ it should stop being a stack.
  The video and the score panel are the two primary objects; put them in a genuine
  two-column relationship (research decides which side and which proportion) with the
  coach feedback and actions placed so the screen reads as one composition rather
  than a scrolling ribbon. The mobile stack order must not change.
- **`/`** — the composer gets a bounded, deliberate desktop treatment. It does not
  need two columns; it needs to not look abandoned. See §4.
- **`/wait`** (`client/src/components/WaitView.tsx`) — the Airtable-derived hairline
  progress pinned to the viewport top edge is correct and stays. The centred content
  block below it needs a desktop-appropriate scale.
- **`/videos`** — same max-width treatment as the rest; a grid at `lg`+ if the
  research supports it. Lowest priority of the four.
- **`/karaoke`** — **layout untouched.** See Do Not Touch.

Pick and state a desktop content max-width in the design doc. Do not scatter one-off
`max-w-*` values across screens — if screens share a shell width, that is a token or a
shared wrapper, not five literals.

### 3. One brand accent

Add `--l-accent` / `--l-accent-fg` / `--l-accent-soft` and the `--d-*` twins to the raw
palette block in `client/src/app/globals.css`, mapped to `--color-accent` etc. in
`@theme`, exactly following the existing pattern.

Constraints:

- **The hue must not be confusable with a score band.** `good` is green (`#16a34a`),
  `warn` is amber (`#d97706`), `bad` is red (`#dc2626`). The accent must sit clearly
  outside that arc. Blue, violet, teal and near-black-with-a-cast are all open;
  orange, lime and rose are not.
- It must hold **WCAG AA in both schemes** — 4.5:1 for body text, 3:1 for large text
  and for UI boundaries. T-10022 found that `amber-700` passed on white (4.99:1) but
  dropped to ~4.45:1 as badge text on `warn-soft`; check the accent **in the context
  it is actually used in**, not against a plain canvas. State the measured ratios in
  the design doc.
- Use it sparingly and consistently. State the rule in the design doc and follow it —
  e.g. the primary action, focus rings, and the wordmark, and nothing else. An accent
  applied to six unrelated things is the same wireframe with more colour.
- The `Button` `default` variant is currently `bg-primary text-primary-fg` (near-black).
  Whether the primary action becomes the accent is a research-informed decision — make
  it, state it, and if it changes, check `client/src/app/__tests__/results.test.tsx`,
  which asserts "the one filled button", and `home.test.tsx`.

**HARD REQUIREMENT — the bug T-10022 already found once.** Every colour token added to
`globals.css` must also be added to the `extend.theme.colors` array in
`client/src/lib/utils.ts`. `tailwind-merge` guesses any unknown `text-*` as a font size,
so an undeclared `text-accent-fg` will silently lose to `text-body` and render invisible
text. There is a test for this in §Tests — write it first if it helps.

### 4. The composer fills the viewport

`client/src/app/page.tsx` currently ends after the Record button, leaving the lower
~40% of a phone screen as bare canvas.

Fix the composition, not the padding. Options the research should decide between:
letting the writing surface grow to consume the available height (a composer that is
the screen), anchoring the action to the bottom safe area with the surface filling the
space between, or giving the screen a third element that earns its place. **Do not add
decorative filler** — no illustration, no gradient blob, no marketing copy.

Constraints:

- Top-aligned on a phone is deliberate and must stay — a vertically centred
  composition fights the on-screen keyboard. Read the comment on the `<main>` element
  before changing it.
- `safe-b-12` and the iOS safe-area classes stay.
- The estimate footer strip (`~12s` / "About 4 seconds over — trim it a little") keeps
  its current behaviour and its `warn` colouring at over-length.

**THE NAMED FRAGILITY — read this before touching `page.tsx`.** The over-length amber
tint is a mirror `<div>` positioned absolutely behind the `<textarea>`. Both share the
`TEXT_BOX` constant:

```ts
const TEXT_BOX = "px-4 py-3 text-body leading-relaxed whitespace-pre-wrap break-words"
```

Any divergence in font, size, line-height, padding, letter-spacing or width between the
two layers makes the tint drift off the words it marks — **with no failing test and no
error**, just a highlight over the wrong text. If the composer's height, padding or
type changes, you must re-prove alignment, not assume it. T-10022 proved it by painting
the real textarea text red over the tint at 360×640 and 390×844, in English and Hebrew,
with 8+ wrapped lines. Do the same.

---

## Do not touch

- **Anything under `server/`.** This task is presentational. `git diff --stat` must
  show zero server files.
- `client/src/components/Prompter.tsx` — its layout is proved by a real-browser RTL
  test (`client/tests-layout/prompter-rtl.spec.ts`). Not in scope.
- `client/src/hooks/useRecorder.ts`, the karaoke clock, and every constant under
  `client/src/lib/` (`limits.ts`, `estimate.ts`, `textDir.ts`, `evalStages.ts`).
- `/karaoke`'s layout. It is a camera surface with a live prompter and a hard 30s
  auto-stop; its chrome is pinned dark in both schemes via `.scheme-dark` **on purpose**
  and must stay dark in light mode. Do not "fix" it. Applying the new accent to its
  Stop control is also out of scope — `--color-danger` is scheme-independent by design.
- The type scale, the two radii, the no-shadow policy and the dark-scheme model from
  T-10022. This task adds an accent and fixes composition; it does not relitigate the
  system.
- `AdSlot.tsx` behaviour. Restyle only if the accent touches it; the ads-at-launch
  decision is a separate open task (T-10023) and is a server flag, not a visual change.
- The `Button` variant **names** (`default | destructive | outline | ghost | secondary
  | success`) and the `size` names. Five screens call them by name. Treatments may
  change; names may not.

---

## Edge cases

- **Undecodable fixture blob** — `duration` is `NaN`, `loadedmetadata` never fires.
  Player renders fully, shows `0:00`, does not crash. (This is how the screenshots get
  taken.)
- **`duration === Infinity`** from a MediaRecorder WebM until seeked. Do not render
  `Infinity:NaN`; degrade to elapsed-only.
- **Scrub before metadata** — seeking a player with no known duration must be a no-op,
  not a thrown exception.
- **Portrait take on desktop** — a 9:16 video in a two-column desktop layout must not
  blow out the column height. Cap it and keep `object-contain`.
- **Landscape take on a phone** — must not letterbox sideways inside an already
  letterboxed slot.
- **RTL** — Hebrew scripts right-align. Every new layout uses logical properties
  (`ps-*`/`pe-*`/`border-s`/`text-end`), matching the existing code. The player's
  scrubber direction in RTL is a real decision: time still runs left-to-right. State it.
- **Over-length Hebrew script** past 30s — the tint sits exactly under the last words.
- **Reduced motion** — auto-hiding controls and any transition respect it.
- **360px width** — the narrowest phone still in use. No horizontal overflow.
- **Dark mode on every one of the above.**

---

## Regression risks

- **Token/merge parity.** A new colour in `globals.css` that is missing from
  `utils.ts` renders invisible text and nothing fails. §Tests makes this impossible to
  ship silently — write that test.
- **The mirror layer.** Covered above. The single highest-risk change in this task.
- **Class assertions in existing tests.** `results.test.tsx` asserts "the one filled
  button"; `home.test.tsx` asserts `/text-warn-fg/`. If the accent changes the primary
  button, **rewrite the assertion to its intent, do not delete it**, and record the
  rewrite in `docs/STATUS.md` — that is the T-10022 precedent.
- **`playsInline` removal on iOS** would silently break the results screen on the
  primary target device and no test would catch it. Assert it in the DOM.
- **Desktop layout leaking into mobile.** The mobile stack order and top-alignment are
  deliberate. Every desktop change is `lg:`-prefixed or inside a container query.
- **Accent creep.** Applying the accent to score bars, flags or badges destroys the
  meaning of the semantic scale. Grep for it.

---

## Tests

Add or update, then run all of it:

1. **Token parity test** (new, Vitest) — parse `client/src/app/globals.css`, extract
   every `--color-*` name declared in the `@theme` block, and assert each one appears
   in the `extend.theme.colors` (or `borderRadius`, or `font-size`) arrays in
   `client/src/lib/utils.ts`. This is the permanent fix for the class of bug T-10022
   found by accident. It must fail if someone adds a token and forgets the merge list.
2. **`VideoPlayer` unit tests** (new, Vitest + Testing Library) — renders with a
   non-loading source without crashing; shows `0:00` when `duration` is `NaN`; shows
   `0:00` when `duration` is `Infinity`; play control `aria-label` flips between "Play"
   and "Pause"; Space toggles playback; scrub before metadata does not throw; the
   `<video>` element carries `playsInline` and does **not** carry `controls`.
   Stub `HTMLMediaElement.prototype.play`/`pause` — jsdom does not implement them.
3. **Existing suites** — `client/src/app/__tests__/{home,results,wait,karaoke}.test.tsx`
   and `Prompter.test.tsx` all pass. Rewrite-to-intent only where the design genuinely
   changed; never delete an assertion to make it green.
4. **Playwright layout proofs** in `client/tests-layout/`:
   - Extend `screens.spec.ts` to regenerate all 16 screenshots into `docs/ui/`
     (4 screens × 2 viewports × 2 schemes) plus a `videos` screen if you restyle it.
     Add a **1024×768** viewport — the width where a desktop layout most often breaks.
   - **Composer fill (new, runnable):** at 390×844 and at 1440×900, load `/`, measure
     the bounding box of the outermost content wrapper inside `<main>`, and assert its
     height is **≥ 80% of the viewport height**. This is the objective form of "the
     screen does not end two thirds of the way down."
   - **Desktop two-column (new, runnable):** at 1440×900 on `/dev/ui/results`, assert
     the video element and the score panel have **overlapping vertical ranges and
     non-overlapping horizontal ranges** — i.e. genuinely side by side, not stacked.
     Assert the opposite at 390×844 (stacked, not side by side).
   - **Mirror alignment (re-proof):** the T-10022 method — paint the real textarea text
     red over the tint at 360×640 and 390×844, English and Hebrew, 8+ wrapped lines,
     and assert the tint's box matches the tail's box in both directions.
   - `prompter-rtl.spec.ts` must pass **untouched**.
5. **Grep assertions** (state the results in `docs/STATUS.md`):
   - No raw hex outside the palette block in `globals.css` — no `#` colour literal in
     any file under `client/src/app/` or `client/src/components/`.
   - No surviving `bg-white` / `bg-neutral-*` / `text-neutral-*` / `bg-black` in any
     in-scope screen or component.
   - No `controls` attribute on a `<video>` in `client/src/app/results/page.tsx`.
   - `accent` appears **only** where the design doc says it should.

---

## Acceptance criteria

1. `docs/design-direction.md` has a `## T-10024 — second pass` section with 6–10
   specific cited references, each carrying one concrete borrowed decision. Whether
   the Refero MCP was reachable is stated in writing.
2. `/results` renders a custom `VideoPlayer`. The native `controls` attribute is gone,
   `playsInline` remains, and the player is fully visible in the committed screenshots
   despite the fixture blob being undecodable.
3. At 1440×900, `/results` is a genuine two-column composition — proved by the
   bounding-box assertion, not by eye. At 390×844 it is still the current stack.
4. `/` fills ≥80% of the viewport height at both 390×844 and 1440×900, with no
   decorative filler added, and the composer is still top-aligned on a phone.
5. Exactly one accent hue exists as tokens in both schemes, is registered in
   `utils.ts`, holds AA **in the context it is used in** with the measured ratios
   written down, is not confusable with green/amber/red, and appears only where the
   design doc says.
6. The token parity test exists and fails if a token is added without updating
   `utils.ts`.
7. The over-length mirror is re-proved by the paint test in English and Hebrew at
   360×640 and 390×844. No drift.
8. Everything green: Vitest, `npm run build` exit 0, `npx playwright test` including
   `prompter-rtl.spec.ts` 2/2.
9. `git diff --stat` shows **zero files under `server/`**.
10. `docs/ui/` screenshots regenerated and committed at all three viewports in both
    schemes.

---

## Before committing

Run `git diff --stat` and review it. Confirm no files under `server/`, no changes to
`Prompter.tsx`, `useRecorder.ts`, or any `client/src/lib/` constant file, and that no
test assertion was deleted rather than rewritten.

Then:

```
git add -A && git commit -m "T-10024: second visual pass — custom player, desktop layout, one accent, composer fills the viewport"
```

and push.

If `.git/index.lock` blocks the commit, check for a running git process by executable
name (`ps -o comm=`), **not** with a `pgrep -f` pattern that matches any shell whose
command text merely contains the word "git" — that false match cost time in T-10022.

---

REMINDER: Do not forget to commit, push, and update `docs/STATUS.md` by following
`docs/update_status.md`, and update `docs/TASKS.md`.

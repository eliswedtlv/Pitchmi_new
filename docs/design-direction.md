# PitchMi — design direction (T-10022)

The written direction behind the release UI pass. Read this before changing anything visual;
it is the reason each decision is what it is, and it names what is deliberately left alone.

## Source

**Refero MCP (`https://api.refero.design/mcp`) was connected in this session and was used.**
Every reference below is a real screen or a real extracted style pulled from Refero, viewed
as an image or as a full style reference — not a product recalled from memory. Screen and
style UUIDs are cited so any of them can be reopened.

No fallback list was needed.

---

## The references, and the one thing borrowed from each

### The score screen — `/results` (the screen that matters most)

1. **Teal — "Final Resume Check" panel** (screen `43037b5d-b7b1-4085-9ae3-e711c226dd0a`).
   The 58% donut sits **to the left of** the dimension bars, not above them, so the eye lands
   on the number and then reads *across* into the breakdown as one object. Borrowed exactly:
   the overall score and the five dimension bars are now **one panel, two columns** at ≥`sm`
   (number left, bars right), stacking to number-then-bars on a phone. Today they are two
   separate cards, which reads as two unrelated facts.

2. **Grammarly — "Performance" modal** (screen `866e2b05-b3d0-465b-b51f-07ecd6fb08b8`).
   The 97 score is a *modest* ring beside an explanatory sentence, and the sub-metrics are
   plain label-left / value-right rows with thin inline bars. Borrowed: the sub-dimensions
   get **no colour of their own beyond the bar fill**, and the value sits right-aligned in
   tabular figures. Also borrowed: the score is never the only thing on its row — it is
   labelled and given a one-line context, so a bare "62" is never left to be interpreted.
   *Not* borrowed: the ring. A ring at phone width costs more space than it earns.

3. **Duolingo — lesson step screen** (screen `3f55bcc4-abc6-4e63-8d97-08fcf23856ba`).
   Exactly **one** filled, coloured button on the screen; everything else is text or outline,
   and the CTA sits alone below a rule. Borrowed: `/results` now has one filled primary
   (**Try again**) and three outline actions. This is the one place the direction overrules
   existing code — see "What changed that wasn't purely visual" below.

### The wait screen — `/wait`

4. **Airtable — "Generating your app…"** (screen `318130f4-8c83-4c21-9b54-ea7511073bec`).
   The process *is* the headline — set at full heading size, with a muted second line naming
   the current sub-step, and a **hairline progress bar pinned to the very top edge of the
   viewport** rather than a bar floating in the middle of the composition. Borrowed whole.
   It makes a 60-second wait read as work in progress instead of a stalled dialog.

5. **Hers — three-step loading screen** (screen `7b3ba649-e405-4845-a12f-88eade469475`).
   The named stages stay on screen and **keep a check mark once passed** instead of being
   replaced by the next label. Borrowed: `/wait` lists both real stages ("Uploading your
   take…", "Analyzing your take…") permanently; the passed one gets a check, the active one
   a ring, the pending one stays dim. The stage strings and the two-stage machine come from
   `lib/evalStages.ts` unchanged — this is a rendering of existing state, not a new state.

6. **Meiro — "Generating images"** (screen `666ea689-7d95-4de0-8527-63c52da3428f`).
   A single centred column with a lot of negative space around it and nothing else competing.
   Borrowed: the wait screen is the only screen in the product with a vertically centred
   composition, and it holds nothing but the ad slot, the stages and the reassurance line.

### The composer — `/`

7. **WhatsApp — status composer** (screen `0b25c0f7-4f45-4010-bbc8-c04624eb19f1`).
   There is no card and no field label; the writing surface **is** the screen, with the chrome
   pushed to the corners. Borrowed in the spirit rather than the letter: the script box loses
   its `Card` shell and becomes the dominant surface of the page, with the counter attached to
   it as a footer strip. (The "What are you going to say?" label survives as a quiet caption —
   the copy is not this task's to delete.)

8. **Product Hunt — launch submission form** (screen `9820b69a-dc71-47ec-804a-22d7373760f7`).
   A live character counter that lives **inside the input's own footer**, on a hairline rule,
   in the same muted tone as the helper text — a fact about the text, not a warning. Borrowed:
   the `~18s` estimate row is now a bordered footer strip on the script panel, and it only
   changes colour when the script is actually over 30 seconds.

### The visual language (light and dark)

9. **Linear — changelog** (style `11d3e58a-87d7-4a9a-bbf5-720f4fd3ffc6`, full style reference).
   The foundation. Three things taken directly: (a) **depth comes from tonal layering and 1px
   borders, never from shadows** — Linear's own don't-list says so outright, and it is the
   only elevation model that survives a dark background; (b) **headlines use a medium weight
   (500) at large sizes**, not bold — authority from size and spacing instead of ink; (c) an
   almost-black canvas (`#08090a`) with a *lighter* surface above it, which is where PitchMi's
   `canvas → surface → raised` ladder comes from.

10. **Cron / Metaview / Pipe** (styles `0528b40d-…`, `13ff020d-…`, `c00d3961-…`).
    All three are near-black canvases carrying **exactly one** accent, spent on exactly one
    action. Borrowed as a rule rather than a colour: PitchMi has **no brand accent at all**.
    The primary action is monochrome (near-black on light, near-white on dark), which leaves
    green/amber/red meaning one thing only — a score band. That is the colour discipline of
    this product: three hues, all semantic, none decorative.

---

## The direction, concretely

### Type scale — six steps, and no seventh

| Token | Size | Line height | Used for |
|---|---|---|---|
| `text-micro` | 12px | 1.4 | counters, "evaluations left today", helper captions |
| `text-meta` | 13px | 1.5 | labels, dimension names, badges, stage sub-lines |
| `text-body` | 15px | 1.6 | body copy, the script textarea, coach comments |
| `text-lead` | 17px | 1.45 | the slogan, the active wait stage |
| `text-title` | 24px | 1.25 / −0.02em | screen headings, wait headline |
| `text-display` | 48px | 1.0 / −0.03em | **the overall score, and nothing else** |

Weights used: 400, 500, 600. Nothing is `font-bold` (700) any more — per Linear, large text
gets its authority from size, not weight. The old `text-7xl` score is gone; 48px against a
15px body is already a 3.2× jump, and the previous 72px only worked because nothing else on
that screen had any weight to it.

### Colour — semantic tokens only, two schemes, one set of names

Defined once in `client/src/app/globals.css`. Raw hex values appear in exactly one place (the
`--l-*` / `--d-*` palette block); every token points at one of them, and every screen
references the token. There is no brand hue.

| Token | Light | Dark | Role |
|---|---|---|---|
| `canvas` | `#f6f6f7` | `#0b0b0c` | page background |
| `surface` | `#ffffff` | `#141416` | panels |
| `raised` | `#ffffff` | `#1c1c1f` | inputs, hover, elevation *above* a panel |
| `line` / `line-strong` | `#e5e5e8` / `#d1d1d6` | `#27272b` / `#3a3a40` | borders |
| `track` | `#e4e4e7` | `#2a2a2f` | progress / score bar tracks |
| `fg` | `#18181b` | `#f4f4f5` | primary text |
| `fg-muted` | `#52555c` | `#a1a3aa` | secondary text |
| `fg-subtle` | `#676a71` | `#83868e` | tertiary text (still AA at 15px) |
| `primary` / `primary-fg` | `#18181b` / `#fafafa` | `#f4f4f5` / `#111113` | the one filled action |
| `good` / `good-fg` / `good-soft` | `#16a34a` / `#15803d` / `#dcfce7` | `#22c55e` / `#4ade80` / `rgb(34 197 94 / .15)` | score ≥ 80 |
| `warn` / `warn-fg` / `warn-soft` | `#d97706` / `#96470a` / `#fef3c7` | `#f59e0b` / `#fbbf24` / `rgb(245 158 11 / .16)` | score ≥ 65, over-length |
| `bad` / `bad-fg` / `bad-soft` | `#dc2626` / `#b91c1c` / `#fee2e2` | `#ef4444` / `#f87171` / `rgb(239 68 68 / .15)` | score < 65, errors |

The three-way split per hue is what makes the two schemes work: the **plain** value is a fill
(bar, dot — needs 3:1 against its track), the **`-fg`** value is text (needs 4.5:1 against both
`surface` and `canvas`), and **`-soft`** is a tint behind text. In dark, `-soft` is a *low-alpha
overlay* rather than a pale tint — `amber-100` on near-black simply disappears, which is the
exact failure the task called out.

Amber is the token that was checked hardest, at both ends of both schemes. Light `warn-fg` is
`#96470a`, not `amber-600` — `amber-600` measures ~3.5:1 on white and fails outright, and
`amber-700` (`#b45309`) measures 4.99:1 on white but drops to ~4.45:1 as badge text on
`warn-soft`, i.e. it fails the case it is most used in. `#96470a` holds ≥ 5.6:1 everywhere it
appears. Dark `warn-fg` is `#fbbf24` (amber-400) — deliberately *lighter and less saturated
against its background* than the light-mode choice, because a mid-amber vibrates on near-black.

### Spacing, radius, elevation, motion

- **Spacing rhythm:** a 4px base, used at 4 / 8 / 12 / 16 / 24 / 32. Section gap is 24px
  (Linear's), panel padding is 20px on phone and 24px from `sm` up, element gap 8px.
- **Radius:** two values. `rounded-control` (10px) for buttons, inputs, badges-that-aren't-pills;
  `rounded-panel` (14px) for panels and the video. Pills stay `rounded-full`. Nothing else.
- **Elevation:** **no shadows in the product surface.** Depth is `canvas` → `surface` → `raised`
  plus a 1px `line` border. The two exceptions are both floating over video and both keep their
  shadow: the karaoke Stop button and the `/videos` playback modal.
- **Motion:** two motions exist. The recorder ring pulse (`.ring-pulse`, untouched, already
  honours `prefers-reduced-motion`) and the wait progress bar width transition (`.progress-fill`,
  700ms ease-out, now also disabled under `prefers-reduced-motion`). Plus `transition-colors` on
  interactive elements. Nothing else animates, and no animation library was added.

### Typeface

`next/font` with **Inter** (latin) for the UI and **Heebo** (hebrew) as the immediately
following family in the same stack, then `system-ui`. Inter has no Hebrew coverage at all —
requesting a `hebrew` subset from it fails — so a single-family choice would have dropped every
Hebrew screen into an unstyled system fallback mid-sentence, which is precisely the failure the
task warned about. Both are self-hosted by `next/font` at build time and subset to the one
script each is there for, so the added weight is two small woff2 files rather than a full
multi-script family.

### Dark mode

- **Follows the OS** via `prefers-color-scheme`. **No in-app toggle**, deliberately: a toggle
  needs persisted preference state, a hydration-safe read of it before first paint, and a
  settings surface this product does not have. **Follow-up proposal:** if a manual toggle is
  ever wanted, it is a small task on top of this token layer — add `.scheme-light` beside the
  existing `.scheme-dark` class, put a persisted class on `<html>` from an inline pre-hydration
  script, and no screen needs to change. Filed as `FU-THEME-TOGGLE`.
- **`/karaoke` is dark in both schemes and that is correct.** It is a full-bleed camera feed;
  light chrome over live video is unreadable and would wash out the preview. The screen carries
  a `.scheme-dark` class that pins the dark token values on its subtree, so its chrome uses the
  same `surface` / `line` / `bad-soft` tokens as everywhere else instead of ad-hoc blacks. **Do
  not "fix" this into a light variant.** The same applies to the `/videos` playback overlay.
- **Testing:** jsdom cannot see a dark-mode failure. The Playwright screenshots
  (`client/tests-layout/screens.spec.ts` → `docs/ui/`) are the real check, and they run every
  screen at both viewports in both schemes.

---

## What changed that wasn't purely visual, and why

Two class-asserting tests were updated deliberately rather than deleted. Both are recorded in
`docs/STATUS.md`.

1. **`/results`: Try again is now the monochrome primary, not a green filled button.**
   Under this direction green means "you scored ≥ 80". A permanently green button next to a
   green-when-good score number teaches the user that the colour means nothing. Try again is
   still unambiguously the primary action — it is the only filled button on the screen, full
   width, above the other three — which is what `results.test.tsx` was actually protecting. The
   assertion was rewritten from `bg-green-600` to "the only filled/primary button on the
   screen", not removed. The `success` button variant still exists with its name intact.

2. **`home.test.tsx` matched the over-length flag on `/amber/`.** That was matching a raw
   Tailwind palette class, which this task exists to remove. It now matches the `warn` token.
   The behaviour under test — over-length flags, never blocks — is unchanged.

One structural change, presentational only: **`/wait`'s markup was extracted into
`client/src/components/WaitView.tsx`.** All logic — the effects, the eval call, the error
mapping, the routing — stays in `wait/page.tsx`. The extraction exists so the dev fixture
`/dev/ui/wait` can screenshot the *real* wait markup without firing a live evaluation against a
backend that is not running. `/results` needed no equivalent: it renders purely from seeded
session state.

---

## Deliberately not changed

- **`Prompter.tsx`, in full.** Its geometry is the subject of a real-browser RTL layout proof
  and its colour and font-size were settled on-device with a tester. The karaoke *chrome*
  around it is restyled; the prompter itself is not touched.
- **`TEXT_BOX`'s role on `/`.** The over-length mirror and the textarea still share one
  constant, and it is still the only place either layer's typography is set. The constant's
  value changed once (`text-base` → `text-body`, padding `px-3 py-2` → `px-3.5 py-3`) and both
  layers moved together; verified visually against a script wrapping over four lines.
- **Every hook, every `lib/` constant, the session store, and the entire `server/` directory.**
  No thresholds, no limits, no scoring, no prompts, no schema.
- **Routes, copy and behaviour.** Same five screens, same order, same buttons doing the same
  things, same strings. The 30-second promise is now the largest thing on the home screen, but
  its wording is the settled one from T-10021.
- **The ad slot's timing.** `AdSlot` was restyled to the tokens; *when* it appears is untouched
  and remains T-10023's decision.
- **`/admin` and `/dev/prompter-layout`.** Internal tools, left as they were.

## Proposals for follow-up tasks (not implemented here)

- `FU-THEME-TOGGLE` — a manual light/dark override, per the note above.
- `FU-SCORE-CONTEXT` — Grammarly and Teal both put the score in context ("compared to other
  users", "we recommend hitting 60%"). PitchMi shows a bare number with no sense of what good
  is. That needs product copy and possibly a cohort baseline, i.e. it is a product decision and
  a server change, so it is out of scope here.
- `FU-RESULTS-SCORE-HISTORY` — the strongest thing the reference score screens do that this one
  cannot is show *movement* between takes. That needs stored takes, which the MVP flow does not
  write.

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

---

# T-10024 — second pass

T-10022 built the system. Eli looked at the 16 screenshots it produced and the verdict
was **"UI extremely schematic."** That is accurate, and it is not a failure of the
system — it is four things the system does not cover. The reference products T-10022
was benchmarked against (Linear, Grammarly, Teal) are dense with content, so their
restraint reads as calm. PitchMi's screens are nearly empty, so the same restraint reads
as unfinished.

This pass does not relitigate the type scale, the two radii, the no-shadow policy or the
dark-scheme model. It replaces the browser's video chrome, gives the product a desktop,
adds exactly one accent hue, and makes the composer fill the screen it is on.

## Source

**The Refero MCP (`https://api.refero.design/mcp`) was connected in this session and was
used.** The fallback to named-from-memory references was not needed. Every citation below
is a real screen or a real extracted style, and each one says whether it was read as an
**image** or as **metadata** (Refero's structured layout/function description).

The searches were for the four concrete objects, not for "clean UI" — and "modern, clean,
minimal" is not a finding, so nothing below reduces to it.

## The references, and the one thing borrowed from each

### The player

11. **Flask.do — collaborative video review** (screen `c7137d8f-a991-4824-8ac4-92d9b566a6fe`,
    read as an **image**). The decisive one. Its controls are **a row beneath the frame,
    not chrome floating over the picture**: pause at the left, then `11:31 / 20:09` in
    tabular figures, then a full-width scrubber whose played portion is the product's
    accent. Borrowed whole, and it buys two things beyond looking designed — the controls
    can never sit on top of the speaker's face, and they are unconditionally visible in a
    screenshot, which is the only reason this player can be reviewed at all (see the
    fixture note below).

12. **Anam — session recording review** (screen `cf4d4dda-6b59-41ec-87b1-92cd1e747d01`,
    read as an **image**). Cited as a **don't**: Anam is a review-a-recording screen that
    ships the browser's own `<video controls>` in the middle of an otherwise carefully
    designed page, and it looks exactly as unfinished there as it did on `/results`.
    Seeing the identical mistake in a shipped product is what settled that this was worth
    a component rather than a restyle.

13. **TwelveLabs — clip result modal** (screen `a007b688-ad2d-40ea-8b74-143cd865ec31`,
    read as **metadata**: "two-column modal: video player on the left and
    metadata/feedback controls on the right"). Borrowed: the convention. Where a screen
    is *a clip plus a judgement of it*, the clip goes left and the judgement right. That
    is the arrangement `/results` now uses, and it is not a coin flip — it is what the
    category does.

### The desktop layout

14. **Anam again** (same screen, image). The composition, precisely: the recording and
    its details rail sit side by side at the top, and the **long-form generated text runs
    full width underneath** rather than being squeezed into one of the columns. `/results`
    is that shape — video beside the score panel, coach feedback below — because the coach
    comments are prose, and prose in a 400px column beside a 540px video reads as a
    leftover. Also borrowed: the short right-hand panel keeps **its own height** rather
    than stretching to match the video (`items-start`).

15. **Metaview — conversation summary** (screen `bdd91772-5ba9-4400-9ade-4184eb0afb82`,
    read as **metadata**: "right side stacks video player, action buttons, and chat box").
    Borrowed: **the actions belong in the narrow column, stacked under the panel they act
    on** — not spanning the full width. A 960px-wide "Try again" is a banner, not a
    button. This is what stopped the desktop layout from becoming a wide ribbon with a
    wide CTA at the bottom.

16. **Cursor — agents composer** (screen `47f556b0-409d-4078-9e5e-6aa39732afbf`, read as
    an **image**). Borrowed: a writing surface stays a **bounded column on a 1440 screen**
    — Cursor's composer is roughly 370px inside an 800px content area and never stretches.
    That is why `.shell` stops at 40rem while only `/results` gets `.shell-wide` at 60rem.
    Explicitly **not** borrowed: Cursor's card floats in the upper third and leaves the
    rest of the viewport empty, which is the exact failure this task exists to fix.

### The composer

17. **Wabi — full-screen text composer** (screen `939ed5e8-a0b0-4670-80dd-c4fe9a7dd5ac`,
    read as an **image**). The answer to "mostly empty on purpose and still finished". The
    text area owns everything between the header and a hairline divider; the action sits
    below that divider, near the bottom. The screen is ~90% blank and reads as complete
    because the **frame** spans the full height — nothing floats in the middle of an
    unclaimed page. Borrowed exactly: the script panel grows to consume what the header
    and the Record button leave. No filler of any kind was added; the space went to the
    one element the screen is about.

### The accent

18. **Default (`default.com`) — "Revenue-Grade Automation"** (style
    `8bc1389b-c2a7-41e7-937c-ca8fb53c581d`, read as a **full style reference**). A
    near-monochrome system carrying exactly one electric violet (`#5757f8`), spent on the
    primary action and active navigation. Its own don't-list says it outright: *"Do not
    introduce new vibrant colors outside of the Electric Violet accent."* Borrowed: the
    rule and the hue family. **Not** the value — see the contrast table.

19. **shadcn/ui** (style `c14c0a94-1037-449e-bf5b-4cb972656ac7`, read as **metadata**:
    "black used for primary actions and emphasis, light gray for separators, and **only
    tiny semantic accents for status cues**"). This is the answer to the hardest of the
    four questions — how a product keeps its accent from reading as a status. It is a
    **division of labour by size and role**, not by hue: the semantic colours stay confined
    to small, labelled objects (a 6px bar, a badge), and the accent takes the large
    interactive ones (the filled button, the focus ring). A user never has to ask which
    scale a colour belongs to, because the shapes are different.

20. **OpenSea** (style `2465f692-3a79-4576-970c-ee56c1e72375`, read as **metadata**: "a
    single electric blue accent used sparingly for active states, verified markers, and
    links"). Borrowed: the accent's job is **state and position**. That is the direct
    reason the `/wait` progress bar, the active wait stage and the player's scrubber get
    it, and the score bars do not.

21. **Linear — product site** (style `554b801c-3b31-4086-a7e5-ae613cdd618b`, read as
    **metadata**: "a single vivid lime accent used sparingly to draw the eye and break up
    the monochrome scheme"). The companion to T-10022's Linear *changelog* citation, and
    the correction to it. T-10022 read Cron/Metaview/Pipe as "near-black plus one accent →
    therefore have no accent". Linear's own product surface makes the actual rule plain:
    the monochrome discipline exists **so that** one accent can carry weight. Removing the
    accent does not strengthen the discipline; it removes the thing the discipline was
    protecting.

## The direction, concretely

### One accent: fuchsia (T-10027; indigo, T-10024, considered and rejected)

| Token | Light | Dark | Role |
|---|---|---|---|
| `accent` | `#a21caf` | `#e879f9` | the filled action, the focus ring, progress and position fills, the wordmark |
| `accent-fg` | `#ffffff` | `#111113` | text and icons **on** an accent fill |
| `accent-soft` | `#fae8ff` | `rgb(232 121 249 / .16)` | the tint form — the active wait stage |

**Two constraints, and the accent has to satisfy both.**

1. **Far from all three score bands.** They sit at red 0°, amber 32°, green 142°. The
   whole reason this token exists is that "is that green or is that the brand?" must never
   be a question a user can ask, which is also why teal was rejected despite being
   nominally open — it is the closest open hue to `good`.
2. **Outside the ~240–280° indigo-violet band.** That band is the default accent of
   AI-built interfaces: Tailwind UI shipped `indigo-500` as its placeholder in 2019, it
   propagated through tutorials, templates and open-source projects, models trained on
   that corpus, and a purple-blue button is now the statistical median of a generated
   interface. A product about to go public cannot wear the colour that says "generated".

**Indigo `#4f46e5` — considered, shipped in T-10024, and rejected here.** It was picked by
the first constraint alone and it satisfies it perfectly: at 243° it is the hue furthest
from all three bands at once. But 243° is dead centre of the second band. The research
that produced it (Default's electric violet, shadcn/ui's division of labour by size and
role, OpenSea's state-and-position rule, Linear's product site — references 18–21 above)
is still the entire reason the accent exists and none of it is overturned; only the hue
is. A research-led pick lands in 240–280° *by gravity*, because the reference corpus is
full of AI products. Recorded rather than deleted so the next reader knows indigo was
evaluated, not overlooked.

What survives both constraints is blue (~220°) or magenta/fuchsia (~295°). **Fuchsia**,
because it is the further of the two from the generic-SaaS default and reads as
performance/stage rather than enterprise dashboard, which is what PitchMi is — and
because its light value is contrast-equivalent to indigo's, so the swap cost no
re-tuning anywhere. Light `#a21caf` is 295°, dark `#e879f9` is 292°; the minimum
separation from any score band is **65°** (to red, measured the short way round the
wheel), and both sit clear above the 280° edge of the AI band. In dark the accent is
still a *lighter, less saturated* step, for the same reason `warn-fg` is (`#fbbf24`, not
a mid-amber): a mid-fuchsia vibrates on near-black.

**Measured, in the context each value is actually used in** — T-10022's lesson was that
`amber-700` passes on white at 4.99:1 and fails at 4.45:1 in the place it is really used,
so a bare against-the-canvas number proves nothing.

| Use | Needs | Light | Dark |
|---|---|---|---|
| `accent-fg` on an accent fill — the Record it / Try again label | 4.5:1 | **6.32** | **7.66** |
| `accent` as text on `surface` | 4.5:1 | **6.32** | **7.48** |
| `accent` as text on `canvas` — the wordmark | 4.5:1 | **5.85** | **8.00** |
| `accent` fill against `track` — the scrubber, the wait bar | 3:1 | **4.98** | **5.80** |
| `accent` focus ring against `canvas` | 3:1 | **5.85** | **8.00** |
| `accent` border against `surface` — the composer's focused frame | 3:1 | **6.32** | **7.48** |
| `accent` border on `accent-soft` against `canvas` — the active wait stage | 3:1 | **5.85** | **8.00** |
| `fg` text on `accent-soft` — the active wait stage's label | 4.5:1 | **15.23** | **14.28** |

Nothing is below its threshold, and every dark row improved over indigo's. The dark
`accent-soft` number is measured on the **composite** — 16% `#e879f9` over `--d-canvas`
`#0b0b0c` is `#2e1d32` — not on the rgba literal. The active wait stage's border started
at `accent/30`, which measures 1.63:1 (light) / 2.01:1 (dark) — no worse than the existing
`border-line-strong` at 1.41:1, and the row is identified by its tint, its type size and
its spinner rather than by its outline, so it would not have been a violation. It was
taken to full strength anyway because the number was free.

**`accent-soft` is fuchsia-100, not fuchsia-50, and that is deliberate.** Measured against
`--l-canvas` `#f6f6f7` — the one surface the tint is ever used on, since the active wait
stage sits on `canvas` — fuchsia-50 `#fdf4ff` is **1.006:1**, i.e. the tint effectively
does not exist. Indigo-50 `#eef2ff` was **1.035:1**. Fuchsia-100 `#fae8ff` is **1.077:1**,
which preserves a visible tint of the same order. Do not "fix" this back to the 50.

Default's own `#5757f8` was **not** adopted in T-10024: it measures 4.47:1 against
`surface`, which clears the bar for a button label but leaves no margin at all for the
wordmark on `canvas`. That reasoning stands on its own terms and is moot now — the whole
hue family it belongs to is what T-10027 moved away from.

### Where the accent is allowed — the whole rule

**The accent marks PitchMi acting.** Three categories, and nothing else:

1. **Identity** — the `PitchMi` wordmark eyebrow on `/` and `/wait`.
2. **The one action** — the single filled `Button` on a screen, and the focus ring that
   follows the user around every control (including the composer's `focus-within` frame,
   which is the same statement made by a border).
3. **Progress and position** — the `/wait` hairline bar and its active stage, and the
   player's scrubber.

Never on a score bar, a dimension value, a flag badge, the `AdSlot`, or the karaoke Stop
control (`danger` is scheme-independent by design and stays that way). A
`grep -oE '\-accent'` over `src/app` and `src/components` returns exactly those call sites
and no others; that grep is the enforcement.

**Consequence, recorded:** the `Button` `default` variant moved from `bg-primary`
(near-black) to `bg-accent`. The T-10022 discipline is intact — still at most one filled
button per screen, still never a score colour — and `results.test.tsx` was **rewritten to
its intent, not deleted**. See `docs/STATUS.md`.

### The two content widths

Declared once, in `globals.css`, as `.shell` and `.shell-wide`:

| Class | < `lg` | ≥ `lg` | Used by |
|---|---|---|---|
| `.shell` | 32rem | **40rem** | `/`, `/wait` — anything that is a single column of reading or writing |
| `.shell-wide` | 32rem | **60rem** | `/results`, `/videos` — the screens that become a real grid |

32rem below `lg` is the previous `max-w-lg` exactly, so no phone layout moved. They are
plain CSS classes rather than `@theme` container tokens because tailwind-merge has no
`maxWidth` theme key to extend, so a custom `max-w-*` token would sit outside `cn()`'s
conflict resolution — the same class of trap that produced T-10022's invisible-text bug.
Add a third width there if a screen genuinely needs one; do not scatter `max-w-*` literals
back across the screens.

### `/results` on a desktop

One grid, `lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`, and **DOM order is visual
order** in both layouts:

```
< lg                    >= lg
─────────────           ────────────────────────────
heading                 heading  (spans both)
video                   video          | score panel
score panel             coach feedback | actions
coach feedback
actions
```

The mobile stack is the order it always was, so reading order and focus order never
diverge from the phone. The score panel goes back to a **single** column at `lg`
(`lg:grid-cols-1`) — from `sm` it puts the number beside the bars, but at `lg` it is no
longer the full width of the screen, it is the ~400px right-hand column, and the 48px
number and five bars do not both fit across that.

Proved by `tests-layout/desktop-layout.spec.ts`, not by eye: at 1440×900 the video and
the score panel must have **overlapping vertical ranges and non-overlapping horizontal
ranges**, and at 390×844 exactly the opposite. A stack passes the first half of that and
fails the second, which is the point. 1024×768 — the `lg` breakpoint itself, where the
second column appears in the same frame the container stops growing — is asserted too, and
so is zero horizontal overflow at 360px on every screen.

### The composer

`min-h-screen` flex column → the `.shell` wrapper takes `flex-1` → the script section
takes `flex-1` → the panel takes `flex-1` → the textarea is `absolute inset-0` inside it.
Top-alignment on a phone is unchanged and still deliberate (a vertically centred
composition fights the on-screen keyboard); what went is the `sm:justify-center` that used
to centre it on wider screens, because the screen no longer needs centring — it no longer
ends early. Measured at ≥ 80% of the viewport height at both 390×844 and 1440×900, with a
second assertion that more than half of that height went to the **textarea** rather than
to padding, because "fix the fill with whitespace" is the obvious wrong way to pass.

`absolute inset-0` rather than `h-full`, for two reasons: a percentage height against a
flex item stays `auto` here so `rows={8}` was winning, and — more importantly — it makes
the textarea and the over-length mirror **literally the same rectangle** instead of two
boxes that happen to agree.

That mirror is still the most fragile thing on the screen, and it is now proved by
`tests-layout/mirror-align.spec.ts` rather than by hand. `TEXT_BOX` is unchanged. The test
builds a probe layer carrying the **textarea's own computed typography**, fills it with
the same head/tail split, and asserts the probe's tail box and the mirror's tail box agree
within a pixel — at 360×640 and 390×844, in English and Hebrew, over a tail wrapping 8+
lines, plus a direct equality check on all 26 computed properties that can move a glyph.
It was verified to fail rather than assumed to work: adding `tracking-wide` to one layer
alone reports `"letterSpacing"` by name.

### The player's RTL decision

The control row is `dir="ltr"` and **stays that way in Hebrew**. The scrubber is a picture
of *time*, and time in a 30-second take runs left to right for every speaker of every
language; mirroring it would put "the end of the take" where every other video player on
the device puts the beginning. There is no language-shaped text on that row — it is a
clock. Every other new layout uses logical properties (`ps-*`/`pe-*`/`border-s`/`text-end`)
exactly as the existing code does.

### The fixture blob is a requirement, not an edge case

`/dev/ui/[screen]` seeds a `Blob(["fixture"], { type: "video/webm" })`, which is not a
decodable video: `loadedmetadata` never fires and `duration` is `NaN` forever. The player
renders its full control layout in that state and shows `0:00`. **That is what makes the
screenshot review possible at all** — a control that is invisible in a PNG cannot be
reviewed, and reviewing PNGs is how this product's UI gets judged. The same code path
covers the two real states: `duration === Infinity` (a MediaRecorder/WebM quirk our own
takes hit routinely until seeked) and a scrub attempt before metadata, which is a no-op
rather than a throw. All three are unit-tested.

## Deliberately not changed

- **`/karaoke`, in full.** Its layout, its `.scheme-dark` pinning, and its Stop control.
  The accent is **not** applied there: `danger` is scheme-independent by design.
- **`Prompter.tsx`, `useRecorder.ts`, the karaoke clock, every `lib/` constant.** Zero-line
  diffs. `prompter-rtl.spec.ts` passes untouched.
- **The `Button` and `Badge` variant names and size names.** Five screens call them by
  name. `Badge`'s `default` variant keeps `bg-primary` — a badge is a status object and
  must never be able to wear the brand colour.
- **`--color-primary`.** It still exists and still means near-black-on-light. It is now
  used only by `Badge` `default` and the wait check mark's glyph colour; it was not
  deleted, because "the near-black fill" is a real role a future non-brand-coloured filled
  surface will want.
- **The type scale, the two radii, the no-shadow policy, the dark-scheme model, the
  typeface pairing.** All T-10022, all still correct.
- **`AdSlot` behaviour**, and `/admin` and `/dev/prompter-layout` (internal tools).
- **The `/videos` playback modal's native `controls`.** It plays a *saved* take from a
  signed URL inside a dark overlay, which is a different object from the take under
  review; swapping it was not asked for and would have been scope the task ruled out.

## Proposals for follow-up (not implemented here)

- `FU-VIDEOS-PLAYER` — reuse `VideoPlayer` in the `/videos` playback modal, so the product
  has exactly one player. It needs the component to accept `autoPlay` and to sit on the
  `.scheme-dark` overlay, both small.
- `FU-RESULTS-DESKTOP-DENSITY` — at 1440 the second grid row leaves real empty space below
  the actions column. The honest fix is more content (see `FU-SCORE-CONTEXT` and
  `FU-RESULTS-SCORE-HISTORY` from T-10022), not a taller button.

# T-10027 — Swap the brand accent from indigo to fuchsia

Read `CLAUDE.md`/`AGENTS.md` and `docs/update_status.md` first. After completing all changes, update `docs/STATUS.md` by following `docs/update_status.md`, update `docs/TASKS.md` if task state changes, commit and push the changes.

**Task ID:** T-10027
**Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Predecessor:** T-10024 (`89b7fab`), which introduced the accent token layer this task re-values. Nothing about T-10024's *structure* is in question — only the hue.

---

## Why this exists

T-10024 picked indigo `#4f46e5` / `#818cf8` on the reasoning (written into `globals.css` and `docs/design-direction.md`) that it is the hue furthest from all three score bands at once. That reasoning is sound and is **not** being overturned. What it missed is a second constraint that matters just as much for a product about to go public:

Indigo-violet in the 240–280° hue band is the default accent of AI-built products. Tailwind UI shipped `indigo-500` as its placeholder accent in 2019; it propagated through tutorials, templates and open-source projects; models trained on that corpus; and purple-blue buttons are now the statistical median of generated interfaces. The owner's reaction to the shipped screens was exactly this — *"it's not very AI this indigo?"* — and he is right. A research-led pick lands in that band by gravity, because the reference corpus is full of AI products.

So the accent must satisfy **both** constraints: far from the score bands, *and* outside the AI-default band.

The score bands sit at hue 0° (red `#dc2626`), 32° (amber `#d97706`) and 142° (green `#16a34a`). The AI-default band is ~240–280°. Indigo is 243° — dead centre of it. What survives both constraints is blue (~220°) or magenta/fuchsia (~295°). Fuchsia is chosen: it is the further of the two from the generic-SaaS default, it reads as performance/stage rather than enterprise dashboard, which is what PitchMi is, and its light value is contrast-equivalent to indigo's so the swap costs no re-tuning anywhere.

**This is a re-value of six CSS custom properties plus the prose that justifies them. It is not a redesign.** If you find yourself changing a layout, a component's structure, or where the accent is spent, you have left the task.

---

## What to change

### 1. The token values — `client/src/app/globals.css`

In the raw palette block, exactly six declarations change value. The token **names** do not change, and no token is added or removed.

```css
/* light */
--l-accent: #a21caf;        /* was #4f46e5 */
--l-accent-fg: #ffffff;     /* unchanged — keep the line, it is still correct */
--l-accent-soft: #fae8ff;   /* was #eef2ff */

/* dark */
--d-accent: #e879f9;        /* was #818cf8 */
--d-accent-fg: #111113;     /* unchanged — keep the line, it is still correct */
--d-accent-soft: rgb(232 121 249 / 0.16);   /* was rgb(129 140 248 / 0.16) */
```

Note on `--l-accent-soft`: the naive pick is fuchsia-50 `#fdf4ff`, and it is wrong here. Measured against `--l-canvas: #f6f6f7` it is 1.006:1 — the tint effectively disappears on the one surface it is used on (the active wait stage sits on `canvas`). Indigo-50 measured 1.035:1. Fuchsia-100 `#fae8ff` measures 1.077:1, which preserves a visible tint of the same order. Use `#fae8ff`. State the three measured numbers in the design doc so the next person does not "fix" it back to the 50.

### 2. The comment above `--color-accent` in the `@theme` block

The current comment names indigo, gives its hue separation (≈244°) and quotes its eight measured ratios. Rewrite it to describe fuchsia, and make it carry **both** constraints — the score-band separation *and* the AI-default-band exclusion — so the reasoning survives the next person who wonders why the accent is not blue. Quote the newly measured ratios, not the old ones.

### 3. `docs/design-direction.md` — the `### One accent: indigo` section

Rename the heading and rewrite the section so it documents the decision that actually holds:

- The two constraints, stated together, with the hue numbers: bands at 0°/32°/142°, AI-default band ~240–280°, indigo 243°, fuchsia 295°, minimum separation from any band 65°.
- Indigo recorded as **considered and rejected**, with the reason. Do not delete its history — the Refero research that produced it is still the reason the accent exists at all, and a future reader needs to know indigo was evaluated rather than never considered.
- The token table updated to the new values.
- The contrast table re-measured and updated. Every row keeps its threshold; the numbers change.
- The `### Where the accent is allowed — the whole rule` section is **unchanged in substance** — the three categories (the one filled action + focus rings, progress and position, the wordmark) still hold exactly as written. Update it only if a literal hex appears in it.

Expected ratios for the new values (compute them yourself and correct me if any differ — do not copy these numbers without verifying):

| Context | Threshold | Light | Dark |
|---|---|---|---|
| `accent-fg` on an accent fill — the Record it / Try again label | 4.5:1 | 6.32 | 7.66 |
| `accent` as text on `surface` | 4.5:1 | 6.32 | 7.48 |
| `accent` as text on `canvas` — the wordmark | 4.5:1 | 5.85 | 8.00 |
| `accent` fill against `track` — the scrubber, the wait bar | 3:1 | 4.98 | 5.80 |
| `accent` focus ring against `canvas` | 3:1 | 5.85 | 8.00 |
| `accent` border against `surface` — the composer's focused frame | 3:1 | 6.32 | 7.48 |
| `accent` border on `accent-soft` against `canvas` — the active wait stage | 3:1 | 5.85 | 8.00 |
| `fg` text on `accent-soft` — the active wait stage's label | 4.5:1 | 15.23 | 14.28 |

Dark `accent-soft` is the 16% composite over `--d-canvas: #0b0b0c`; measure it composited, not as an rgba literal.

### 4. Re-shoot the screenshots

Re-run the screenshot spec so all 30 PNGs in `docs/ui/` show the shipped accent. Stale screenshots are worse than none — the owner reviews the product from these files, so a PNG showing indigo after this lands will be read as "the swap did not work."

---

## Do Not Touch

- **Where the accent is spent.** Three categories, unchanged: the single filled action + focus rings, progress and position fills, the wordmark. Do not add a fourth. Do not remove one.
- **Any other token.** `good`/`warn`/`bad` and their `-fg`/`-soft` twins, `primary`, `danger`, `media`, the neutrals, the type steps, the radii — all untouched. In particular do **not** "harmonise" the score bands with the new accent; their separation from it is the point.
- **`client/src/lib/utils.ts`.** No token is added or renamed, so the `extendTailwindMerge` list does not change. If you find yourself editing it, you have added a token you were not asked for.
- **Layout, component structure, `VideoPlayer.tsx`, the `.shell`/`.shell-wide` widths, the composer's `absolute inset-0` fill.** All T-10024 work, all correct, all out of scope.
- **`server/`.** Zero files.
- **The `danger` token.** It is scheme-independent by design and is the karaoke Stop control over a live camera feed. It is not the accent and does not become fuchsia.
- **Class names in components.** `bg-accent`, `text-accent`, `border-accent`, `ring-accent`, `bg-accent-soft` all stay exactly as they are. This task changes what those names *resolve to*, which is the entire benefit of the token layer — if you are editing `.tsx` files to change colours, stop and re-read this spec.

---

## Edge cases

- **The active wait stage.** `border-accent bg-accent-soft` on `canvas` is the only place `accent-soft` is used and the only place an accent border sits on an accent tint. It is the most likely thing to look wrong after the swap. Check it in both schemes in the screenshots.
- **The disabled Record button.** The home screen's primary is disabled with empty script text, which is how `home-*.png` is captured. Confirm the disabled fuchsia still reads as disabled and not as an enabled button in a lighter shade — this is a real regression risk, since fuchsia at reduced opacity is closer in lightness to its enabled state than near-black was.
- **The scrubber dot and played bar in `VideoPlayer`.** Small objects at 3:1 against `track`. The measured 4.98 (light) / 5.80 (dark) clears it, but confirm visually in `results-390-*.png` that the dot is still findable.
- **Colourblind separation from the score bars.** Fuchsia's nearest band is red at 65°. Under deuteranopia and protanopia magenta shifts toward blue-grey while red shifts toward dark yellow-brown, so they remain distinguishable — but the `/results` screen puts the accent-filled Try again button directly under a red Accuracy bar, which is the one place the two are adjacent. Look at it.
- **`text-accent` on the wordmark** is uppercase micro text with `tracking-[0.18em]`. Thin letterforms at 12px are where a hue change is most likely to look weak even when the ratio passes.

---

## Regression risks

- A literal `#4f46e5`, `#818cf8`, `#eef2ff` or `rgb(129 140 248` surviving anywhere outside the historical note in `docs/design-direction.md`. Grep for all four.
- The contrast table in `docs/design-direction.md` left with indigo's numbers under fuchsia's heading — a stale table is a trap for whoever audits accessibility next.
- Screenshots not re-shot, or re-shot at the wrong viewport set. It is 30 files: 5 screens (home, results, wait, wait-error, videos) × 3 widths (390/1024/1440) × 2 schemes.
- `tokenParity` going red because a token name was accidentally changed rather than re-valued.

---

## Tests and verification — all runnable, no judgment calls

Run from `/Users/eliswed/Dropbox/Code/Pitchmi_new/client`:

1. `npx vitest run` — all tests pass, including `lib/__tests__/tokenParity.test.ts` (token names unchanged, so it must stay green untouched) and `app/__tests__/results.test.tsx` (still asserts `bg-accent` and exactly one filled button — the class name does not change, so this test must pass **without being edited**; editing it is a signal you changed the wrong thing).
2. `npx tsc --noEmit` — clean.
3. `npm run build` — exit 0.
4. `npx playwright test` — all pass, including `tests-layout/desktop-layout.spec.ts`, `tests-layout/mirror-align.spec.ts` and `tests-layout/prompter-rtl.spec.ts`. None of these assert on hue, so all must pass unedited.
5. `npx playwright test tests-layout/screens.spec.ts` — regenerates all 30 PNGs in `docs/ui/`. Confirm with `git status --short docs/ui/` that files are modified, and that the count is 30.
6. `grep -rn "4f46e5\|818cf8\|eef2ff\|129 140 248" client/ docs/` — the only permitted hits are inside the historical "considered and rejected" note in `docs/design-direction.md`. Report every hit and why it is allowed.
7. `grep -rnoE "\-accent(-fg|-soft)?\b" client/src/app client/src/components | sort | uniq -c` — the call sites must be the same set as before the change. Paste the output.

---

## Acceptance criteria

1. `--l-accent` is `#a21caf`, `--d-accent` is `#e879f9`, `--l-accent-soft` is `#fae8ff`, `--d-accent-soft` is the 16% composite of `#e879f9`. No other token changed value.
2. No token was added, renamed or removed; `client/src/lib/utils.ts` is untouched; `tokenParity` passes.
3. No `.tsx` file changed a colour class. Any `.tsx` diff must be explained in the commit message.
4. Every contrast ratio in the design doc's table is re-measured, stated, and at or above its threshold. If any row falls below, **stop and report rather than adjusting the hue yourself** — the owner picked this colour.
5. `docs/design-direction.md`'s accent section states both constraints (score-band separation and AI-default-band exclusion) and records indigo as considered and rejected with its reason.
6. The `globals.css` `@theme` comment matches the new values and reasoning; no sentence in it still claims the accent is indigo.
7. All 30 PNGs in `docs/ui/` are regenerated and show fuchsia.
8. `vitest`, `tsc --noEmit`, `npm run build` and the full Playwright suite all pass with no test file edited.
9. Zero files changed under `server/`.
10. `docs/STATUS.md` updated per `docs/update_status.md`; `docs/TASKS.md` T-10027 row set to done.

---

## Before committing

Run `git diff --stat` and review it. The expected shape is small: `globals.css`, `docs/design-direction.md`, `docs/STATUS.md`, `docs/TASKS.md`, and 30 PNGs. Anything else in that list needs a sentence of justification in the commit message.

Then:

```
git add -A && git commit -m "T-10027: swap the brand accent from indigo to fuchsia"
git push
```

REMINDER: Do not forget to commit, push, and update `docs/STATUS.md`.

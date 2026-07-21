# T-1163 — Hebrew/RTL prompter done right + clean-verbatim transcript draft (CC /goal)

Read CLAUDE.md and docs/update_status.md first. After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, commit and push the changes.

- **Task ID:** T-1163
- **Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
- **Context:** two prior RTL attempts (T-1161 `<bdi>` per word, T-1162 kept it) still render Hebrew "completely broken" on device. This spec is evidence-based; follow it exactly and prove the fix with a real-layout test, not jsdom.

## A. P0 — RTL prompter (and all script-bearing text)

**Diagnosed root cause (verify in code first, document in STATUS):** per-word `<bdi>`/span elements laid out as separate boxes (flex items / inline-block) render in DOM order regardless of `dir` — the Unicode bidi algorithm only reorders characters within a continuous inline text run, and `<bdi>` on EVERY word further isolates each word from its neighbors (also breaking punctuation placement). Reference: W3C "Inline markup and bidirectional text in HTML".

**Required implementation (Prompter.tsx and any word-span rendering in editor/results):**
1. The line container carries `dir` from the project's detected language (`rtl` for he/ar/fa/ur, else `ltr`) and `text-align: start`.
2. Words are rendered as **plain inline `<span>`s inside one continuous text flow** — no flex, no grid, no inline-block, no float, no absolute positioning on word spans; normal spaces between them (real text nodes, not margins). Highlighting = color/background/font-weight changes only, which never affect bidi order.
3. Remove the per-word `<bdi>` wrappers. Isolate ONLY tokens whose script direction opposes the line (Latin brand names / numbers inside Hebrew): `unicode-bidi: isolate` (or `<bdi>`) on those tokens alone, detected by character-range check.
4. If any animation currently translates individual word boxes, move the animation to the line level; the active word indicator must not require per-word layout boxes.
5. Same treatment audit for: transcript editor display, results accuracy/flags view, coach comments (`dir="auto"` per comment), project titles.

**Proof (mandatory, this is the acceptance gate):** add a minimal Playwright check (chromium headless; `npx playwright install chromium` if needed) that mounts/loads the Prompter with the Hebrew fixture "היי אני רוצה להציג לכם את PitchMi היום" and asserts via `getBoundingClientRect` that (a) word x-positions are strictly right-to-left for the Hebrew words, (b) the Latin token sits between its Hebrew neighbors per logical order, (c) with an English fixture x-positions are left-to-right. Wire it as `npm run test:layout` (does not need to join vitest). If Playwright is impossible in this repo, stop and say so rather than shipping unproven again.

## B. Transcript editor = clean-verbatim draft, readable line-by-line

Goal: the user should land on a **usable draft** — industry "clean verbatim" style — not raw STT output.

**Server — new cleanup stage in `/api/transcribe` (after Scribe, before storing `script`):**
1. Deterministic pass (existing `fillers.js`): strip fillers/disfluencies — keep as is.
2. NEW `server/src/lib/cleanVerbatim.js`: one cheap **text-only** LLM call (OpenRouter, same `EVAL_MODEL`, JSON mode, temperature 0.2) that converts the raw transcript to clean verbatim in the SAME language: remove false starts, stutters, word repetitions and self-corrections ("we, we went" → "we went"); fix STT misrecognitions only when contextually obvious; add standard punctuation and capitalization; NEVER paraphrase, summarize, reorder, or translate — wording stays the speaker's. Output JSON `{"sentences": ["…", "…"]}`. On any failure fall back silently to the deterministic-pass text (feature must degrade, not break transcribe). Log `clean_ms` into the transcribe event metadata.
3. `script` is stored as the cleaned text (sentences joined with `\n`); `original_words` unchanged (raw + timestamps). The existing path algorithm §6 already treats script-vs-original divergence as user edits — no path changes needed; verify the anchor/diff step tolerates the cleaned text (test below).

**Client — editor presentation:**
- Show the draft **one sentence per line** (split on `\n`), comfortable reading typography (~17–19px, 1.6 line-height), `dir` per language, right-aligned for RTL.
- Keep it editable as plain text (textarea or equivalent preserving the per-line layout); duration/fit meter and speed slider behavior unchanged.
- Small caption under the title: "We cleaned up your transcript — fix anything we got wrong." (EN/HE strings).

## Do not touch

Auth, DB schema, evaluate/scoring pipeline, provider routing from T-1162, ad, admin.

## Verification

- Layout proof from §A (`npm run test:layout`) — the gate for RTL.
- Server Jest: cleanVerbatim success-shape mock test; fallback-on-LLM-failure test (transcribe still 200 with deterministic text); path anchor test with a "cleaned" Hebrew script vs raw original_words fixture (anchors still found, no crash). `npx jest` green, `npx standard` clean.
- Client: vitest green (sentence-per-line rendering, dir attributes), `npm run build` exit 0.
- STATUS.md: root-cause writeup for the RTL bug (what T-1161/62 got wrong), manual QA items: Hebrew karaoke readable on iPhone; Hebrew draft reads naturally sentence-by-sentence.

git diff --stat review before commit, then git add -A && git commit -m "RTL prompter rebuilt on continuous text flow + clean-verbatim transcript draft (T-1163)" && git push.

REMINDER: Do not forget to commit, push, and update docs/STATUS.md and docs/TASKS.md.

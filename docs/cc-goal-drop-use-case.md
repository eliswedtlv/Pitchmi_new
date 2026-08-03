# T-10021 — New slogan + delete the use-case picker (UI **and** prompt)

Read `CLAUDE.md`/`AGENTS.md` and `docs/update_status.md` first. After completing all changes, update `docs/STATUS.md` by following `docs/update_status.md`, update `docs/TASKS.md` if task state changes, commit and push the changes.

**Task ID:** T-10021
**Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
**Type:** one cohesive CC task — client + server + prompt + tests. Small, mechanical, fully reversible.

---

## Product decision (Eli, verbatim)

1. The slogan is **"If you can't say it in 30 seconds, don't say it"** — not "Perfect your spoken video in minutes."
2. **Remove the use-case buttons from the UI and from the prompt.**

The picker was a five-way choice (Pitch / Intro / Sales / Social / Custom) that a first-time user has to answer before they are allowed to type a word, and its only downstream effect is a single sentence of tone guidance in the eval prompt. It buys one line of prompt nuance at the cost of the first interaction in the product. It goes.

This is a **release-readiness** change: the app ships without ads, so the first screen has one job — get the script typed and the camera open.

---

## Context from code inspection

Read before changing anything:

- `client/src/app/page.tsx` — 196 lines. Slogan at **line 81**. `UseCase` type at 14, `USE_CASES` array at 16–22, `useCase`/`customText` state at 32–33, the picker `<Card>` at **84–117** (grid of buttons + the conditional custom `<textarea>`), `use_case`/`use_case_custom` passed to `createProject` at **52–55**, and `useCase === "custom" && !customText.trim()` inside the Record button's `disabled` expression at **175**.
- `client/src/lib/api.ts` — `Project` interface at 61 (`use_case`, `use_case_custom`), `createProject(data: { title?, use_case, use_case_custom? })` at 74.
- `server/src/lib/evaluate.js` — `USE_CASE_GUIDANCE` map at **20–25**, `buildPrompt({ useCase, useCaseCustom, language })` at **27–34**, which substitutes `{{USE_CASE_GUIDANCE}}` into the prompt template.
- `server/src/prompts/eval.md` — `## Use-case adaptation` heading at **21** and the `{{USE_CASE_GUIDANCE}}` placeholder at **23**.
- `server/src/routes/evaluate.js` — passes `useCase: project.use_case` / `useCaseCustom: project.use_case_custom` into the prompt context at **146–147**.
- `server/src/routes/projects.js` — `USE_CASES` allowlist at 9, `bad_use_case` 400 at 15–16, defaults to `'pitch'` at 21.
- `server/src/lib/db.js` — `createProject` writes `use_case: useCase || 'pitch'` at 82–85.
- `client/src/app/__tests__/home.test.tsx` — has a test literally named **"keeps the use-case picker"** and asserts `createProject` was called with `{ use_case: "pitch", use_case_custom: undefined }` at line 96.
- `server/tests/evalPrompt.test.js` — calls `buildPrompt({ useCase: 'pitch', language: 'Hebrew' })` at line 11 but asserts **nothing** about use-case guidance, so only the call needs trimming.

**Stale prompt copy found during inspection (fix it here).** `server/src/prompts/eval.md` still says *"a short spoken video (≤ 60 seconds)"* (line 1) and *"## Micro-timeline for a ≤60s take"* (line 17). The hard cap has been **30s** since T-1172. The model is currently being told to calibrate a close-out arc against a 60-second take that can no longer exist. This is a one-word fix in the file you are already editing and it is in scope.

---

## Scope A — the slogan

`client/src/app/page.tsx` line 81:

```
Perfect your spoken video in minutes.
```
becomes
```
If you can’t say it in 30 seconds, don’t say it
```

Use **typographic apostrophes (`’`, U+2019)**, no trailing period. Straight quotes in JSX text trip `react/no-unescaped-entities` and look wrong next to the wordmark.

Also update `client/src/app/layout.tsx` metadata `description` (currently "Record, transcribe, and perfect your spoken video with AI coaching.") — the flow no longer has a transcript-editing step and the promise is now the 30-second constraint. Replace with:

```
If you can’t say it in 30 seconds, don’t say it. Rehearse to a teleprompter of your own words and get AI delivery coaching.
```

Leave the metadata `title` alone.

## Scope B — remove the picker from the client

- Delete the `UseCase` type, the `USE_CASES` array, the `useCase` and `customText` state, the whole picker `<Card>` (84–117) and the custom textarea inside it.
- `handleStart` calls `createProject()` with **no** use-case fields.
- The Record button's `disabled` becomes `loading || !text.trim()`.
- `client/src/lib/api.ts`: `createProject` takes `data?: { title?: string }` and posts `{}` when nothing is given. **Keep** `use_case` / `use_case_custom` on the `Project` interface — the server still returns those columns and the type should stay honest about the row shape.
- The script `<Card>` becomes the first thing under the header. Do **not** redesign the screen here — spacing and hierarchy are T-10022's job. This task removes; it does not restyle.

## Scope C — remove the use case from the prompt

- `server/src/prompts/eval.md`: delete the `## Use-case adaptation (shifts delivery expectations only)` heading and the `{{USE_CASE_GUIDANCE}}` placeholder (lines 21–23), leaving no orphan blank block. In the same file, `≤ 60 seconds` → `≤ 30 seconds` (line 1) and `## Micro-timeline for a ≤60s take` → `## Micro-timeline for a ≤30s take` (line 17). The micro-timeline body ("First ~3s… Middle… Toward the close") is still correct at 30s — leave the wording.
- `server/src/lib/evaluate.js`: delete `USE_CASE_GUIDANCE`; `buildPrompt` takes `{ language }` only and does a single `{{LANGUAGE}}` substitution. Everything else in the file — the Vertex provider pin, `usage: { include: true }`, the JSON extractor, retry/deadline logic — is untouched.
- `server/src/routes/evaluate.js`: delete the two `useCase` / `useCaseCustom` lines from the prompt context (146–147).

## Scope D — tests

- `client/src/app/__tests__/home.test.tsx`: invert **"keeps the use-case picker"** into **"has no use-case picker"** — assert none of `Pitch` / `Intro` / `Sales` / `Social` / `Custom` render and that no "What are you recording?" heading exists. Update the `createProject` assertion to expect no use-case fields. Add an assertion that the new slogan text renders and the old one does not.
- `server/tests/evalPrompt.test.js`: drop `useCase` from the `buildPrompt` call, and add two assertions: the built prompt contains **no** `{{` placeholder at all (catches an orphaned substitution token reaching the model), and contains neither `Use-case adaptation` nor `≤ 60 seconds` / `≤60s`.
- `server/tests/evaluate.test.js` passes `{ useCase: 'pitch' }` as prompt context in ~10 places. `buildPrompt` will simply ignore an extra key, but clean them to `{}` or `{ language: … }` anyway so nothing reads as still-wired.
- `client/src/app/__tests__/karaoke.test.tsx:44` seeds `use_case: "pitch"` on a **project row fixture**. That column still exists. Leave it.

---

## Explicitly NOT in scope

- **No DB migration.** `projects.use_case` and `projects.use_case_custom` stay in the schema and stay written with their `'pitch'` default. Same precedent as T-1169 leaving `projects.speed` in place. Dropping columns for a UI change is not worth a migration on a live database.
- **`server/src/routes/projects.js` keeps accepting and validating an optional `use_case`.** The API stays backward compatible; the client just stops sending it. Do not delete the allowlist or the `bad_use_case` 400 — `tests/api.killswitch.test.js` posts `{ use_case: 'pitch' }` in three places and must keep passing untouched.
- `server/src/lib/db.js` — untouched.
- No restyling, no layout changes, no copy changes beyond the slogan, the meta description and the two `60s` corrections.
- `score.js`, `scriptPath.js`, `subtitles.js`, `Prompter.tsx`, `useRecorder.ts`, the karaoke/wait/results screens, admin — all untouched.

## Edge cases

- Existing projects in production have `use_case = 'pitch'` (or another value) on the row. Nothing reads it after this change, and nothing should crash on it — `buildPrompt` no longer receives it at all.
- An old client build still posting `use_case` must keep working. That is exactly why Scope C leaves `routes/projects.js` alone.
- A user who had typed into the custom textarea has no state to lose — that state is created and discarded on the same screen.

## Regression risks

- **An orphaned `{{USE_CASE_GUIDANCE}}` reaching the model.** If the placeholder is removed from `evaluate.js` but left in `eval.md`, the literal token is sent to Gemini as prompt text. The "no `{{` in the built prompt" test above is the guard — do not skip it.
- **The Record button locking.** If the `useCase === "custom"` clause is left in `disabled` after `useCase` is deleted, the build fails (good) — but if it is replaced with something wrong, the button can end up permanently disabled with text typed. Cover it: the existing "keeps the button disabled until something is typed" test must still pass unchanged.
- **A blank gap where the card was.** The picker `<Card>` sat inside a `space-y-8` stack; removing an element from that stack is safe, but check the screen at 390×844 and confirm no stray empty `<Card>` shell is left behind.
- Hebrew: the slogan is English and does not flip. The script textarea's `dir` logic (T-1164) is untouched.

## Acceptance criteria

1. The home screen shows the new slogan and no use-case buttons, no "What are you recording?" card, no custom-description textarea.
2. Typing a script and pressing **Record it** creates a project and navigates to `/karaoke` exactly as before.
3. `POST /api/projects` with **no body** creates a project (server default `'pitch'`); with `{ use_case: 'sales' }` it still works; with `{ use_case: 'nonsense' }` it still 400s `bad_use_case`.
4. The built eval prompt contains no `{{` placeholder, no use-case section, and says 30 seconds rather than 60.
5. Client `npx vitest run` green, `npm run build` exit 0, `npx playwright test` (layout proof) 2/2.
6. Server `npx jest` green and `npx standard` clean.

## Before commit

Run `git diff --stat` and review it. The diff should touch roughly: `client/src/app/page.tsx`, `client/src/app/layout.tsx`, `client/src/lib/api.ts`, `client/src/app/__tests__/home.test.tsx`, `server/src/lib/evaluate.js`, `server/src/routes/evaluate.js`, `server/src/prompts/eval.md`, `server/tests/evalPrompt.test.js`, `server/tests/evaluate.test.js`, plus `docs/STATUS.md` and `docs/TASKS.md`. Anything outside that list is a mistake — explain it or revert it.

Then:

```
git add -A && git commit -m "T-10021: new 30-second slogan, drop the use-case picker from UI and prompt"
```

and push.

Finally, update `docs/STATUS.md` per `docs/update_status.md` and mark T-10021 done in `docs/TASKS.md`.

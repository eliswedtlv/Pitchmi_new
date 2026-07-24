# T-1169 — Zero-edit MVP flow: remove editor + pacing engine, subtitles at original pace (CC /goal)

Read CLAUDE.md and docs/update_status.md first. After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, commit and push the changes.

- **Task ID:** T-1169
- **Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`
- **Why:** Product decision for the free MVP. Editing the transcript created a pacing problem that repeatedly failed on-device (T-1167/T-1168): any edit re-paces the karaoke and never feels like the user's own rhythm. The fix is to REMOVE editing entirely. Subtitles are simply the user's spoken words (fillers stripped) shown at their exact recorded timestamps. To change wording or pace, the user just records again. This deletes a whole class of pacing logic rather than tuning it further.

## New flow (the whole product)

Record take 1 → transcribe (Scribe, strip fillers) → subtitles built directly from the Scribe word timestamps (minus fillers), grouped into teleprompter lines → karaoke re-record guided by those subtitles → evaluate → results (score + coach comments). "Try again" re-records the karaoke take against the SAME subtitles. "Start over / New video" discards and captures a fresh take 1. No editing step, no speed control, no re-pacing.

Rehearsal semantics (unchanged in spirit): take 1 establishes the script AND its pace; later takes are rehearsals guided by and scored against it.

## Remove (delete code + screens + tests)

1. The transcript **editor screen** (`client/src/app/editor/**`) and its route/navigation. Recorder no longer routes to `/editor`.
2. **Clean-verbatim LLM rewrite** (`server/src/lib/cleanVerbatim.js` and its call in `/api/transcribe`). Subtitles must be the user's ACTUAL words with their ACTUAL timestamps — an LLM rewrite would desync words from their timings. Filler stripping stays (see Keep).
3. The **pacing / re-pacing engine** in `server/src/lib/path.js`: `measureRate`/`measureEffectiveRate`, `layUniform`, `layAnchored`, anchor-coverage gating, `smoothRates`, comfort bias, and the `/api/path` endpoint. There is no longer any rate synthesis or anchoring — words already carry real timestamps.
4. The **speed slider** (lived on the editor screen; global pace control is gone — pace is always the user's original recording). Remove `speed` from the request/flow. You may leave the `projects.speed` column in the DB unused (do NOT drop columns — schema untouched), just stop reading/writing it.

## Keep (unchanged or lightly rewired)

1. **Filler stripping** — `server/src/lib/fillers.js`. Subtitles must read clean (no אה/אמ/um/uh). When a filler word is dropped, its time simply becomes a natural gap between the neighboring words (do not reflow timings — the remaining words keep their original start/end).
2. **Line-breaking** — the phrase-boundary line grouper currently in `path.js` (≤~32 chars / ≤6 words, break at sentence → comma → conjunction → preposition, no orphan lines, EN+HE). This is the ONLY part of path.js that survives. Move it to a small `server/src/lib/subtitles.js` (or keep in path.js trimmed to just this) that takes filler-stripped timestamped words and returns the karaoke structure.
3. **Prompter** (`client/src/components/Prompter.tsx`) — centered, RTL-correct, 3-line window. No change needed beyond consuming the same shape.
4. **Scoring** — `server/src/lib/score.js` accuracy + timing of the new take vs the subtitle words/timestamps. Still valid: timing now measures how closely a rehearsal matches the user's own take-1 rhythm. Verify it still reads the subtitle structure correctly after the shape move.
5. **Evaluate** pipeline, provider routing, transcode proxy (T-1166), auth, save, videos — untouched.

## Subtitle structure (rewire)

Fold subtitle building into `/api/transcribe` so there is no separate path call:
- `/api/transcribe` returns the SAME shape the karaoke screen already consumes today (`{ words: [{w, t_start, t_end, line}], lines: [...], total_s, language, script }`), built as: Scribe words → strip fillers → assign each surviving word its own `t_start`/`t_end` from Scribe → run the line-breaker → `total_s` = last word end.
- `script` = filler-stripped transcript text (for storage/reference only; nothing edits it).
- Persist this structure to the project (reuse the existing `path` jsonb column) so karaoke/results read it as before.
- Client: after transcribe succeeds, store the project + subtitle structure and navigate straight to `/karaoke` (skip `/editor`). Delete the `/api/path` client call.

If a take is so short/empty that Scribe returns no usable words, show the standard error ("We couldn't hear you — try again"), don't crash.

## Coach comments — add pace guidance, KEEP THE PERSONA

The coach persona is good and must be preserved exactly — the existing tough-but-fair, direct, slightly-witty startup-coach voice in `server/src/prompts/eval.md`, 3 comments, 5–8 words each, in the take's spoken language. This change is PURELY ADDITIVE: since editing is gone, comments are now the only improvement lever, so allow them to include **delivery-pace and timing direction** where relevant — e.g. "slow down the opening," "you rushed the close," "let the key line breathe." Do not change the tone, count, length, language rule, or the judge-the-messenger-not-the-message rule. Just permit pace/timing coaching within the same voice.

## Scope boundaries — do NOT touch

Auth, DB schema (leave `speed`/unused columns in place), Supabase, storage/save, videos screen, admin, evaluate/scoring math, provider routing, the T-1166 transcode proxy, the T-1163 RTL renderer, the T-1167 centered prompter.

## Acceptance criteria (runnable)

| # | Check | Assertion |
|---|---|---|
| 1 | No editor route | `client/src/app/editor` removed; grep for `/editor` in client shows no navigation to it; `npm run build` exit 0 |
| 2 | No path endpoint | `/api/path` removed; server has no route for it; grep clean |
| 3 | Subtitles = real timestamps | Jest: `/api/transcribe` given a mocked Scribe response with fillers returns words whose `t_start`/`t_end` equal the Scribe timings of the surviving (non-filler) words exactly — no rate synthesis, no reflow |
| 4 | Fillers become gaps | Jest: a filler between two words is dropped and the two neighbors keep their original timings (gap widens, neighbors unchanged) |
| 5 | Line-breaking intact | Jest: EN + HE fixtures still group into ≤32-char / ≤6-word phrase-boundary lines, no orphan lines |
| 6 | Pacing engine gone | grep: `layUniform`/`layAnchored`/`measureEffectiveRate`/`smoothRates` absent from the codebase; their tests removed |
| 7 | Flow | Jest/vitest: after transcribe resolves, client stores subtitle structure and the next route is `/karaoke` (not `/editor`) |
| 8 | Scoring still works | `npx jest score` green against the subtitle structure |
| 9 | Eval persona preserved + pace note | eval prompt still specifies 3 comments / 5–8 words / spoken language / coach tone / messenger-not-message; adds pace-coaching allowance. A prompt-shape test (or snapshot) confirms the persona lines are intact |
| 10 | Suites green | `cd server && npx jest && npx standard`; `cd client && npx vitest run && npm run build`; `npm run test:layout` still 2/2 |

## Docs

STATUS.md: record the flow change (editor + pacing engine removed, subtitles at original pace), the deviation that `projects.speed` and any now-unused columns are intentionally left in place (schema untouched), and updated manual-QA items (Hebrew take: subtitles read clean at natural recorded pace, no editor step). TASKS.md updated.

git diff --stat review before commit, then git add -A && git commit -m "Zero-edit MVP flow: remove editor + pacing engine, subtitles at original pace (T-1169)" && git push.

REMINDER: Do not forget to commit, push, and update docs/STATUS.md and docs/TASKS.md.

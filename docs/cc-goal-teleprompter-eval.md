# T-1162 — Teleprompter redesign, filler stripping, OpenRouter video routing fix (CC /goal)

Read CLAUDE.md and docs/update_status.md first. After completing all changes, update docs/STATUS.md by following docs/update_status.md, update docs/TASKS.md if task state changes, commit and push the changes.

- **Task ID:** T-1162
- **Project path:** `/Users/eliswed/Dropbox/Code/Pitchmi_new`

## A. P0 — OpenRouter video eval 500s: fix the request, don't fall back

Production evidence (2026-07-19): `/api/evaluate` intermittently fails with `OpenRouter 500 {"error":{"message":"Internal Server Error","code":500}}`; one earlier call succeeded (200). Root-cause hypothesis, from OpenRouter's video-input docs (verify against https://openrouter.ai/docs — read it during implementation):

- Video must be sent as a content part `{"type": "video_url", "video_url": {"url": "data:video/mp4;base64,..."}}` (verify the exact field casing/name in the current docs — docs have shown both `video_url` and `videoUrl` styles; match what the API actually accepts).
- Base64 data-URL video is supported by the **Vertex** Gemini backend only; the **AI Studio** backend accepts YouTube URLs only. OpenRouter load-balances between backends → base64 video 500s whenever it routes to AI Studio. This matches our intermittent success/failure exactly.

Fix in the OpenRouter provider (`server/src/lib/evaluate.js`):
1. Verify/correct the video content-part shape against the live docs.
2. Add OpenRouter **provider routing preferences** to the request body so the call only goes to backends that support base64 video (e.g. `"provider": {"only": ["google-vertex"]}` — confirm exact slug and syntax in OpenRouter's provider-routing docs; if an allow-list is impossible, use `order` + `allow_fallbacks: false`).
3. Keep JSON-mode + existing parse hardening. On upstream 5xx: up to 2 retries with short backoff (in addition to the JSON retries, which only apply to 200-with-bad-body).
4. Log which upstream provider actually served each call (OpenRouter returns provider metadata in the response) into the evaluate event's `scores.timings` blob as `upstream` — metadata only.
5. Correct mime: pass the take's real mime (video/mp4 from iOS, video/webm from Chrome) into the data URL, not a hardcoded one.

Do NOT add a Gemini-direct fallback or require new env vars; EVAL_PROVIDER stays as-is.

## B. Teleprompter redesign — "a good teleprompter"

Current prompter is very hard to follow (confirmed on-device, Hebrew and English). Rebuild `components/Prompter.tsx` + the server line-breaker to broadcast-teleprompter standards:

**Line construction (server, path.js §6 step-7 line-breaking — update it, keep the timing algorithm untouched):**
- Max **4–6 words / ~28–32 chars per line** (character-based so Hebrew behaves; CJK by grapheme count).
- Break at **natural phrase boundaries**, priority: sentence punctuation → commas/semicolons → clause conjunctions ("and", "but", "so", "ו", "אבל", "כי", …) → prepositions. Never split a number from its unit or leave a 1-word orphan line (rebalance with the previous line).
- Each line keeps its word timings; expose line start/end times.

**Display (client):**
- Active line: **large** — on phones ≥ ~8vw (clamp 26–44px), bold, white, subtle shadow, over the bottom-scrim; text fills at most ~90% width, centered column.
- Exactly 3 lines visible: previous (small, 50% opacity), **active (big, fixed vertical position — the text moves, the reading position doesn't)**, next (medium, 70% opacity). Smooth scroll between lines, no jumps.
- Reading position sits in the **upper third of the screen, near the front camera**, so the user's eyes stay close to the lens (move the prompter block from bottom to top; scrim follows).
- Word highlight: current word tinted (e.g. brand green) within the active line — clean per-word transition, `<bdi>` isolation kept for RTL; line alignment follows direction (right for Hebrew).
- First-use one-time hint overlay: "Follow the highlighted word — it moves at your pace" (localized string table EN/HE at minimum), dismissed on first countdown.
- Countdown and recording indicator keep the overlay style.

## C. Clean transcripts — strip fillers

Fillers must never reach the editable transcript: strip disfluency tokens from the Scribe result before storing/returning `script` in `/api/transcribe` — multilingual list at minimum: `uh, um, erm, mm, hmm, eh, ah` + Hebrew `אה, אהה, אמ, אממ, אהם` + standalone `like`-type tokens ONLY if Scribe tags them as disfluencies (do not strip real words); if Scribe marks word type/disfluency in its response, prefer that signal over the list. Stripped tokens keep their timestamps in `original_words` (they remain valid pause evidence for the path algorithm) but are excluded from the script text and from accuracy scoring's expected words (score.js already treats fillers as insertions — extend its filler list to match this same shared list, single source of truth `server/src/lib/fillers.js`).

## Do not touch

Auth, DB schema, admin, ad stub, client transport (fixed in T-1161), scoring weights.

## Verification

- Server: new/updated Jest tests — line-chunker fixtures EN + HE (char cap, phrase-boundary preference, no orphans, timings preserved), filler stripping (EN+HE fixtures; real words never stripped; shared list used by both transcribe and score), OpenRouter request-shape test asserting provider-routing preferences + correct mime in data URL. `npx jest` green, `npx standard` clean.
- Client: Prompter tests — 3-line window, active-line fixed position class, RTL alignment, hint shows once. `npx vitest run` green, `npm run build` exit 0.
- Append to STATUS.md manual QA: Hebrew karaoke readability on iPhone (top-position prompter, large type), eval completes twice in a row.

git diff --stat review before commit, then git add -A && git commit -m "Teleprompter redesign + filler stripping + OpenRouter video routing (T-1162)" && git push.

REMINDER: Do not forget to commit, push, and update docs/STATUS.md and docs/TASKS.md.

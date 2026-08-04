# PitchMi Product Contract

Status: launch-ready v1 product contract. This document describes the product that exists now and the surface the redesign must support. It supersedes stale one-minute language in older top-level documentation; the shipped format is 30 seconds.

## Product definition

PitchMi is a private rehearsal studio for people who need to deliver a short scripted video with conviction. A user brings the words; PitchMi helps them perform those words better.

The product deserves to exist because most video tools help people edit footage after a weak take. PitchMi intervenes one step earlier: it makes the next performance better by combining a teleprompter, objective timing and accuracy measurement, and delivery coaching.

Primary users are founders, creators, salespeople, and job seekers preparing a short camera-facing message. They are comfortable using modern software but are not video-production specialists. Secondary users are anyone rehearsing a concise spoken introduction in English or Hebrew.

Product principles:

- Coach the messenger, never judge the message.
- The user’s script is the source of truth for words.
- The user’s own take is the source of truth for pace.
- One screen should make one decision obvious.
- Recording is ephemeral by default; saving is always explicit.
- No account ceremony before the user experiences the core loop.

Goals:

- Move a new user from a blank script to a rehearsed take without onboarding.
- Make the second take feel materially more personal than the first.
- Give coaching specific enough to change the next performance.
- Make privacy and the 30-second constraint understandable without legal copy.

Non-goals for v1:

- Writing or rewriting the user’s message.
- Editing footage, adding visual effects, or generating a presenter.
- Public publishing, profiles, feeds, leaderboards, comments, or likes.
- Cross-device identity and history.
- Persistent project navigation in the main loop.

Assumptions:

- The browser supports camera and microphone capture through MediaRecorder.
- External speech and multimodal evaluation services are available.
- A take fits within the 30-second client limit and 33-second server tolerance.

## Core journey

1. The user opens PitchMi and types or pastes a script.
2. PitchMi shows a rough duration estimate but does not rewrite or block long text.
3. The user chooses “Record it.”
4. The system creates an anonymous project, stores the script, and creates a disposable seed teleprompter path.
5. After a three-second countdown, the user records against the full-screen camera and karaoke prompter.
6. PitchMi uploads the in-memory take and shows only honest processing stages.
7. The server extracts audio, transcribes the take, scores accuracy and timing against the path the user followed, retimes the next path when alignment is trustworthy, and asks the video model to judge voice, body, and delivery.
8. The results screen shows the take, overall score, five dimensions, three coach comments, and objective flags.
9. The user’s moment of value is seeing a specific delivery diagnosis and then choosing “Try again” against a path shaped by their own pace.
10. The user may instead edit the script, start a new video, or share/download the take through the operating system.

## Information architecture

MVP product surfaces:

- `/` — script studio and entry point.
- `/karaoke` — full-screen camera rehearsal with timed prompter.
- `/wait` — evaluation processing and failure recovery.
- `/results` — take playback, scoring, coaching, and next actions.
- `/videos` — dormant owner-only saved-take library, intentionally unlinked from the current main flow.

Administrative surface:

- `/admin` — password-authenticated event logs, aggregates, and service switch.

Development-only surfaces:

- `/dev/ui/[screen]` — deterministic visual fixtures.
- `/dev/prompter-layout/[fixture]` — real-browser prompter layout fixtures.

Future v2 surfaces in `docs/pitchmi-v2-spec.md` are not part of this contract.

## Functional requirements

### Script studio

- Entry condition: none.
- The page presents one dominant writing surface, the 30-second format, and a single record action.
- Empty text disables recording.
- The text direction follows the content so Hebrew is immediately comfortable.
- Text beyond the rough 30-second estimate is visibly identified without being rewritten or blocked.
- Submitting creates a project, saves the script, seeds the path, and moves to rehearsal.
- API failure stays on the page and explains the failure near the action.
- Returning through “Edit text” preserves the existing script.

### Camera rehearsal

- Entry requires an active project and karaoke path; otherwise route home.
- Camera and microphone permission is requested only when rehearsal starts.
- A three-second countdown precedes recording.
- The camera fills the viewport and the prompter remains readable in portrait, landscape, English, and Hebrew.
- Recording stops manually or at its configured ceiling.
- Camera denial shows a readable recovery path instead of a dead black surface.
- Leaving the page releases media tracks and cancels countdown timers.

### Evaluation

- Entry requires an active project and recorded blob; otherwise route home.
- The interface distinguishes request upload from server analysis and never advances on a cosmetic timer.
- Skipping an optional ad affects only the ad.
- The screen stays awake where the browser allows.
- Successful evaluation adopts a returned retimed path before routing to results.
- Rate limits, kill switch, provider timeouts, and generic network failures produce actionable error states.
- Error recovery returns home without exposing raw provider payloads.

### Results

- Entry requires the recorded blob and evaluation result; otherwise route home.
- The video plays inline in a custom player.
- Overall score and voice, body, delivery, timing, and accuracy are shown without implying that the topic was judged.
- Exactly three coach comments are rendered in the response language.
- Objective flags name rushing, dragging, pauses, skipped lines, or off-script behavior where present.
- “Try again” is the primary action and preserves the current path.
- “Edit text” preserves the script and allows reseeding.
- “New video” resets the in-memory session.
- “Share” opens the native file share sheet when possible and downloads otherwise.

### Saved videos

- The current main loop does not write cloud videos or link to this route.
- If opened directly, the route lists only the current anonymous owner’s saved takes through RLS.
- Loading, configuration error, empty, populated, playback, deletion, and playback failure states are represented.

## Data and integrations

Core entities:

- `projects`: owner, script, current path, language, and legacy compatibility fields.
- `saved_takes`: explicit cloud video metadata and score snapshot.
- `events`: content-free operational metadata, scores, cost, latency, and errors.
- `app_settings`: service enablement.
- In-memory client session: active project, script, recording blob and object URL, current path, and evaluation result.

Sources of truth:

- Script text is the word source of truth.
- Scribe word timestamps are the measured speech source.
- The pre-take path is the scoring timing reference.
- The aligned post-take path is the next rehearsal reference.
- The server-combined evaluation object is the results source.

Integrations:

- Supabase anonymous authentication, Postgres, RLS, and private Storage.
- ElevenLabs Scribe for language detection and word-level transcription.
- OpenRouter with a Gemini model, or direct Gemini fallback, for delivery-only video evaluation.
- Bundled ffmpeg for audio extraction, duration observation, and evaluation proxy generation.

## Trust and operations

- Uploaded evaluation video is not persisted.
- Event logs contain no video, transcript, or coach-comment text.
- The service-role Supabase key remains server-only.
- Admin surfaces may inspect metadata and aggregate behavior but not private content.
- Anonymous auth must not be presented as “no identity”; it is an invisible per-device identity.
- Keyboard access, visible focus, reduced motion, contrast, RTL, and inline iOS playback are launch requirements.
- Spend controls include daily user limits, per-IP billable-route limits, media admission control, a surge trip, and an operator kill switch.

## Measurement

Launch measures should answer whether the rehearsal loop works:

- Script submitted → first take completed.
- First take completed → results reached.
- Results reached → Try again selected.
- Second take overall, timing, and accuracy movement.
- Share selected after a completed result.
- Evaluation success rate, p50/p95 latency, cost per completed result, and timeout rate.
- Alignment coverage distribution and the proportion of takes that produce a retimed path.

Do not use page views or total anonymous accounts as primary success measures.

## Acceptance criteria

- A first-time user can understand the product and start from `/` without onboarding.
- The primary action is identifiable within one glance at 390px and 1440px.
- The live flow from script through results preserves all existing API and state behavior.
- Results visually distinguish AI delivery judgement from objective timing and accuracy.
- No UI claims that content, truth, or message quality was evaluated.
- No private recording is stored without an explicit save action.
- All core surfaces work in light and dark OS schemes, except the intentionally dark camera/media contexts.
- English and Hebrew remain legible and correctly directed.
- Automated server, client, layout, type, lint, and production-build gates pass.
- A manual iPhone rehearsal, evaluation, inline playback, and share pass succeeds before launch.

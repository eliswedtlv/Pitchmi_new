# PitchMi UI Contract — Studio 2026

Status: implementation contract for the launch-ready visual redesign.

## Reference lock

### Betas — user-provided identity reference

Borrow: the economy of a compact app symbol paired with a quiet wordmark. The mark must work at favicon size and never need an illustration, gradient, mascot, or explanatory strapline.

Do not copy: Betas’ letterform, exact geometry, color, or app-icon treatment.

Fit: PitchMi needs to look like a real tool before it needs a campaign identity. A small mark that can sit on a camera screen, report, and mobile header gives it that continuity.

### Granola — calm private AI

Borrow: AI is embedded in a familiar work surface and stays subordinate to the user’s own material. Generated content is visually distinguishable without making the whole interface shout “AI.”

Do not copy: notebook metaphors, beige palette, editor chrome, or meeting-specific hierarchy.

Fit: PitchMi also augments the user’s work rather than generating an identity for them. Privacy should feel structural, not like a compliance banner.

### Wispr Flow — immediate core action

Borrow: one unmistakable interaction that demonstrates the product immediately, with confident plain-language instruction and little setup.

Do not copy: keyboard affordances, dictation metrics, yellow selection states, or onboarding sequence.

Fit: the product lives or dies on starting a take. The script surface and record action must feel like one instrument.

### Captions — video as a working object

Borrow: video belongs inside a purposeful studio frame with controls and analysis attached to it, not as a browser element dropped into a dashboard.

Do not copy: mobile editor timeline, transcript editing, purple styling, or generation features PitchMi does not have.

Fit: results are a take review, and the take should carry more visual weight than surrounding metadata.

### Visual thesis

PitchMi is a precision rehearsal studio: editorial in hierarchy, instrument-like in controls, and confident enough to let the user’s script and face remain the hero.

### Design anchors

1. A compact three-bar “rising voice” mark and lowercase `pitchmi` wordmark.
2. Warm paper and near-black foundations with one signal-blue product accent.
3. Large editorial statements paired with compact instrument labels.
4. Media and scoring composed as a studio deck, not a grid of equal cards.
5. Visible, honest process states with domain-native waveform/rhythm details.

### Explicit rejection list

- Purple, violet, fuchsia, and blue-purple gradients.
- Aurora glow, glassmorphism, floating blobs, and sparkle icons.
- Generic centered form cards on a mostly empty viewport.
- Every section inside an identical rounded rectangle.
- Fake analytics, invented social proof, and decorative AI labels.
- Huge radius values, pill-shaped primary buttons, and shadow-heavy elevation.
- Stock browser video chrome.

### Originality

The references contribute separate principles: Betas to identity economy, Granola to AI posture, Flow to interaction clarity, and Captions to media framing. PitchMi’s rising-voice mark, editorial split composer, rehearsal rail, scoring language, and script-specific states come from its own product mechanics.

## Foundations

### Color

Light scheme:

- Canvas: warm paper `#f2f0e9`.
- Surface: clean `#fbfaf7`.
- Raised: cool tint `#eae8e1`.
- Ink: `#101113`.
- Muted ink: `#545861`.
- Signal blue: `#1746ff`.

Dark scheme:

- Canvas: `#08090b`.
- Surface: `#111318`.
- Raised: `#191c23`.
- Ink: `#f6f7f9`.
- Muted ink: `#a6abb6`.
- Signal blue: `#6f8cff`.

The signal blue is used for product action and position: brand mark, focus, current stage, scrubber, and the one primary action. It is not used for score quality.

Score colors remain semantic green, amber, and red. They appear in compact bars, score numerals, and warning details only.

Media remains true black. Error and destructive actions remain red.

Contrast expectations:

- Body and control text meet WCAG AA.
- Focus indicators and non-text controls maintain at least 3:1 against adjacent surfaces.
- Weak decorative rules may be lower contrast only when they carry no information.

### Typography

- Latin UI and display: Instrument Sans.
- Hebrew: Heebo immediately behind Instrument Sans in the shared stack.
- Utility labels use 11–12px uppercase, 0.12–0.18em tracking, and medium weight.
- Body is 15–16px with a relaxed 1.55–1.65 line height.
- Screen titles are 28–36px.
- The home statement is fluid from 42px on mobile to 72px on desktop.
- Overall score is 64–88px with tabular figures.
- Bold weight is reserved for the prompter and score; ordinary hierarchy uses 500–600.

### Spacing and layout

- Base spacing unit: 4px.
- Core rhythm: 8, 12, 16, 24, 32, 48, 72.
- Product chrome max width: 80rem.
- Reading/editor column max width: 42rem.
- Results studio uses a 12-column desktop grid.
- Mobile side padding: 18px; desktop: 32px.
- Desktop split occurs at 1024px, not at tablet widths.

### Borders, radii, shadows, and surfaces

- Controls: 10px radius.
- Instrument panels: 16px radius.
- Media frame: 18px radius.
- Small status elements may use full rounding.
- Most separation comes from a 1px line and tonal change.
- One restrained shadow is allowed on floating overlays and the main composer in light mode.
- Panels should be grouped by workflow, not used as default wrappers.

### Icons and logo

- Lucide icons remain for actions.
- Icons never decorate headings.
- The logo mark is three ascending vertical bars inside a compact square, representing voice, pace, and improvement.
- The mark appears with the wordmark in normal chrome and alone over live media.
- The wordmark is lowercase and tightly set; no “AI” badge is attached.

### Motion

- 120–180ms color and transform feedback on controls.
- Wait-state voice bars may pulse with staggered opacity/scale.
- Progress width changes over 500–700ms.
- No ambient page motion, parallax, or decorative entrance sequence.
- `prefers-reduced-motion` removes pulses, spins, transforms, and progress interpolation.

## Page contracts

### Script studio `/`

User intent: turn a thought into a rehearsable take.

First focus: “Say it like you mean it.” paired with the writing instrument.

Hierarchy:

1. Brand and private-by-default status.
2. Editorial promise and concrete explanation.
3. Script editor with timing state.
4. Record action.
5. Quiet proof: 30 seconds, no signup, nothing saved.

Desktop: an asymmetric split. The left side holds product promise and trust; the right side is a tall script deck with a compact utility header and footer. The split should fill the viewport without looking like a marketing landing page.

Mobile: brand, statement, one-line explanation, then the editor. Trust facts collapse to a single line below the action.

States:

- Empty: purposeful prompt and disabled action.
- Writing: live time estimate.
- Over length: only the estimated overflow and tail receive warning treatment.
- Submitting: action says “Setting up…” and remains in place.
- Error: inline below the action with a direct explanation.

### Rehearsal `/karaoke`

User intent: look near the lens and deliver the script.

First focus: camera and active prompter line.

Composition:

- Full-bleed live camera.
- Compact logo mark and “Rehearsal” cue at the top safe area.
- Prompter retains its tested geometry and bidi behavior.
- Stop action remains bottom-centered and visibly destructive.
- Permission failure uses an opaque dark surface over the camera context.

This page is always dark regardless of OS scheme.

### Evaluation `/wait`

User intent: understand that work is progressing and know what is happening.

First focus: “Your take is in the booth.”

Composition:

- Dark studio context in both schemes.
- Brand at top.
- A domain-native three-bar voice mark/waveform as the only expressive motion.
- Two honest stages remain visible, with completed/current/upcoming states.
- A slim progress rail stays pinned to the top.
- Reassurance and privacy line sit beneath the stages.
- If an ad exists, it is secondary and visually separated from product progress.

Error: stop the motion, replace the central message with the failure and one recovery action, and keep the brand/studio context.

### Results `/results`

User intent: understand this take and decide what to change next.

First focus: the take and overall performance score.

Desktop:

- Brand/report header spans the page.
- Video occupies seven columns.
- Summary occupies five columns.
- Coach notes sit below the video.
- Next actions sit below the summary.
- Empty grid space is removed through an intentional “next take” action deck, not stretched buttons.

Mobile:

- Report header.
- Score summary before the video so the result arrives immediately.
- Video.
- Dimension detail.
- Coach notes.
- Actions, with “Try again” full width and secondary actions in a stable grid.

Score context:

- Label the result “Delivery report,” never “AI verdict.”
- Explain the overall score composition in one short line.
- Use separate headings for “Delivery” and “Script match” to clarify AI versus objective measures.
- Preserve all five numeric dimensions.

### Saved videos `/videos`

User intent: inspect an explicitly saved take.

The page shares the report header and wide shell. Empty state is an editorial explanation with one action, not a lone sentence. Populated takes use a compact list/deck with score, duration, date, playback, and deletion.

Playback uses the custom player in a dark overlay rather than native controls.

### Admin `/admin`

Internal and secondary. It should inherit typography, tokens, button treatment, and focus styles, but it does not need the expressive studio composition. Dense tables remain dense.

## Component contracts

### Brand

- `Brand` renders mark-only or mark-plus-wordmark.
- The link variant returns home.
- Mark-only includes an accessible label only when it is the sole brand text.
- Size variants are compact, default, and media overlay.

### Script deck

- Textarea and over-length mirror remain pixel-identical in font, padding, line height, width, and scroll position.
- The utility header names the object (“SCRIPT”) and constraint (“30 SEC MAX”).
- Footer shows the estimate and privacy note.

### Score summary

- Overall score is the largest numeral.
- Five dimension values remain visible without interaction.
- Bars include labels and numbers; color never carries the value alone.
- Evaluations remaining is tertiary operational text.

### Video player

- Controls stay below the frame.
- Space toggles playback.
- Scrubber remains keyboard-operable and left-to-right in RTL content.
- Unknown, infinite, and finite duration states remain safe.
- No fullscreen or rate control is added.

### Buttons

- One filled signal-blue action per screen.
- Secondary actions are surface or outline treatments.
- Destructive actions are never visually confused with the primary action.
- Minimum tap height is 44px; icon-only controls are square and labelled.

## Content direction

Voice: direct, assured, and specific. Never praise the product or use AI superlatives inside the app.

Preferred:

- “Say it like you mean it.”
- “Paste your script. We’ll cue the take and coach the delivery.”
- “Your take is in the booth.”
- “Delivery report.”
- “Private by default. Nothing is saved.”

Avoid:

- “Unlock your potential.”
- “AI-powered magic.”
- “Revolutionary coaching.”
- “Generate better content.”
- “Perfect your pitch instantly.”

Errors name the failed action and next step. Labels stay under five words where possible.

## Quality acceptance

- Inspect at 390×844, 1024×768, and 1440×900 in light and dark schemes.
- No page has horizontal overflow at 360px.
- The home action remains reachable with a mobile keyboard open.
- Results preserve DOM order compatible with mobile reading and keyboard focus.
- Every interactive element has a visible focus state.
- Reduced motion removes the wait pulse and all nonessential transitions.
- Hebrew script, prompter, comments, and mixed Latin/Hebrew remain correctly directed.
- Camera screens stay legible in the light OS scheme because they pin the dark media tokens.
- Unit tests, strict TypeScript, StandardJS, Playwright layout tests, and production build pass.
- New screenshots replace the existing `docs/ui/` review set.

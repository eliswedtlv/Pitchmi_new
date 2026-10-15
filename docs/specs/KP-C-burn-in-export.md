# KP-C — Client: share/download the take with karaoke words + KillerPitch mark burned in

Product definition: `/Users/eliswed/Dropbox/Code/tlvg-launch-plan/apps/killerpitch.md` (change 5).
Should take ~40 min. If it takes much longer, stop and report.
Scope: NEW files only — `client/src/lib/burnIn.ts` and `client/src/lib/__tests__/burnIn.test.ts`. Do not edit any existing file (a parallel task rewrites the results page; the project session wires your function in afterwards). `docs/STATUS.md` is the one exception: add one bullet (KP-C).

## API
```ts
import type { KaraokePath } from "@/lib/api"
export interface BurnInOptions { dir?: "ltr" | "rtl"; mirror?: boolean; onProgress?: (fraction: number) => void }
export async function burnInKaraoke(take: Blob, path: KaraokePath | null, opts?: BurnInOptions): Promise<Blob>
export function burnInSupported(): boolean
```
`KaraokePath` = `{ words: {w, t_start, t_end, line}[], lines: {index, text, t_start, t_end}[], total_s }`, times in seconds from the start of the take.

## Behaviour
- Play the take in an off-DOM `<video>` (muted for the user, but its audio must be in the output: use `captureStream()` on the video element or WebAudio `createMediaElementSource` → `MediaStreamDestination`), draw each frame onto a `<canvas>` at the take's native size via `requestAnimationFrame` (or `requestVideoFrameCallback` where available), record `canvas.captureStream(30)` + the audio track with `MediaRecorder` (prefer `video/mp4` if `isTypeSupported`, else `video/webm;codecs=vp9,opus` / `vp8,opus`), resolve with the Blob when the video ends.
- Overlay, drawn on the canvas each frame:
  - **Karaoke caption** in the lower third: the current line (`lines[]` whose `[t_start, t_end]` contains currentTime, else the most recent) centred, white bold text with a dark rounded backdrop; words already spoken (`t_start <= currentTime`) in the accent fuchsia `#e879f9`, the rest white. Wrap to max 2 rows at ~85% width; font size ≈ 4.5% of the canvas height. RTL: when `dir === "rtl"` set `ctx.direction = "rtl"` and lay words right-to-left. If `path` is null, draw no caption.
  - **KillerPitch mark** top-left (or top-right for RTL), ~6% of the shorter side: fuchsia `#a21caf` rounded square with the white K strokes from `client/src/components/Brand.tsx` (`M7.25 5.5v13M18.25 5.75 9.8 12M12.2 10.35 18.7 18.4` in a 24×24 box, stroke 2.6, round caps — use `Path2D`), plus the word `killerpitch` next to it in white semibold.
- `mirror: true` flips the video frame horizontally (NOT the text/mark).
- `onProgress(currentTime / duration)` on each frame.
- Never upload anything; all local.
- `burnInSupported()` = canvas.captureStream + MediaRecorder exist.
- Keep layout math in pure exported helpers (e.g. `activeLineAt(path, t)`, `wrapWords(...)`, `markRect(w, h, dir)`) so they're unit-testable without a real browser.

## Done when
- `cd client && npx vitest run src/lib/__tests__/burnIn.test.ts` green (pure helpers: active line selection, spoken/unspoken split, wrap to ≤2 rows, mark position LTR/RTL, null path → no caption).
- `npx tsc --noEmit` clean for the new file, and `npm run build` exits 0.
- Commit on your branch and push the branch to origin (never main, never force).

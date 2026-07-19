/**
 * Recorder capture constraints. Pure logic so the portrait/landscape decision
 * is unit-testable without a real MediaDevices.
 *
 * Phones record in PORTRAIT (ideal 720×1280) so the take fills the phone frame;
 * desktop keeps the classic landscape 16:9 (1280×720).
 */

export function recorderConstraints(portrait: boolean): MediaTrackConstraints {
  return portrait
    ? {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 720 / 1280 },
      }
    : {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 1280 / 720 },
      }
}

/** True when the current viewport is portrait (taller than wide). SSR-safe. */
export function isPortraitViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.innerHeight >= window.innerWidth
}

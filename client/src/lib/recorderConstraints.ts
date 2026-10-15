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

export type FrameOrientation = "portrait" | "landscape" | "unknown"

/** Orientation of a frame size; "unknown" until the camera reports real dimensions. */
export function frameOrientation(width?: number, height?: number): FrameOrientation {
  if (!width || !height) return "unknown"
  return height > width ? "portrait" : "landscape"
}

/**
 * KP-F: what the camera is actually delivering. Prefers the preview element's
 * decoded frame size and falls back to the track settings when the preview has
 * no frames yet (or is not mounted).
 */
export function streamOrientation(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight"> | null,
  stream: MediaStream,
): FrameOrientation {
  const fromVideo = video ? frameOrientation(video.videoWidth, video.videoHeight) : "unknown"
  if (fromVideo !== "unknown") return fromVideo
  const track = typeof stream.getVideoTracks === "function" ? stream.getVideoTracks()[0] : undefined
  const settings = track && typeof track.getSettings === "function" ? track.getSettings() : {}
  return frameOrientation(settings.width, settings.height)
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The take player on `/results` (T-10024).
 *
 * `/results` is the screen users show other people, and until now the largest
 * object on it was the browser's own `<video controls>` chrome — stock Chrome UI
 * in the middle of a designed product. This is the same player built from the
 * token layer.
 *
 * Shape from Flask.do's review player (screen `c7137d8f-…`, read as an image):
 * the controls are a **row beneath the frame**, not chrome floating over the
 * picture — play affordance, then the time, then a full-width scrubber whose
 * played portion is the one brand accent. Two consequences, both wanted: the
 * controls can never be sitting on top of the speaker's face, and they are
 * unconditionally visible in a screenshot, so a reviewer can actually review
 * them.
 *
 * Deliberately no fullscreen and no playback-rate control. A ≤30 second
 * self-review take needs neither, and both are failure surface — fullscreen in
 * particular is the thing `playsInline` exists to prevent on iOS.
 *
 * Presentational only: it takes a `src` and owns nothing else. `/results` still
 * owns `takeBlobUrl` and the blob behind it.
 */

interface VideoPlayerProps {
  src: string
  className?: string
}

/** `m:ss`, and `0:00` for every flavour of "we don't know yet". */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/**
 * A duration we can actually scrub against, or null.
 *
 * Three real states arrive here, and only one of them is a number:
 *  - `NaN` — metadata has not loaded. The dev fixture at /dev/ui/[screen] seeds
 *    a `Blob(["fixture"])` that is not a decodable video at all, so this state
 *    is permanent there and the player still has to draw itself.
 *  - `Infinity` — a known MediaRecorder/WebM quirk: a freshly recorded blob
 *    reports an infinite duration until it is seeked. Our own takes are exactly
 *    that kind of blob, so this is the common case, not the exotic one.
 *  - a finite number — the only one worth showing.
 */
function usableDuration(raw: number | undefined): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null
}

export function VideoPlayer({ src, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)

  // Playback state is read from the element's own events rather than set
  // optimistically next to the play() call: play() can be rejected (autoplay
  // policy, a source that will not decode) and a button whose label says
  // "Pause" over a video that never started is worse than no label at all.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setCurrent(video.currentTime)
    const onMeta = () => setDuration(usableDuration(video.duration))
    const onVolume = () => setMuted(video.muted)

    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    video.addEventListener("ended", onPause)
    video.addEventListener("timeupdate", onTime)
    video.addEventListener("loadedmetadata", onMeta)
    // WebM blobs that reported Infinity settle to a real number later, so the
    // duration has to be re-read on change, not only once on load.
    video.addEventListener("durationchange", onMeta)
    video.addEventListener("volumechange", onVolume)

    return () => {
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
      video.removeEventListener("ended", onPause)
      video.removeEventListener("timeupdate", onTime)
      video.removeEventListener("loadedmetadata", onMeta)
      video.removeEventListener("durationchange", onMeta)
      video.removeEventListener("volumechange", onVolume)
    }
  }, [])

  const toggle = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play()?.catch(() => {})
    else video.pause()
  }, [])

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  function seek(to: number) {
    const video = videoRef.current
    // Seeking a player with no known duration is a no-op, not an exception:
    // assigning currentTime before metadata throws in some engines, and the
    // scrubber is reachable (and focusable) from first paint.
    if (!video || duration === null) return
    video.currentTime = to
    setCurrent(to)
  }

  // Space toggles playback wherever focus is inside the player. preventDefault
  // is load-bearing: without it the space that reaches the focused play button
  // would also fire its click and cancel this toggle out.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== " " && e.key !== "Spacebar") return
    e.preventDefault()
    toggle()
  }

  const progress = duration === null ? 0 : Math.min(100, (current / duration) * 100)

  return (
    <div
      onKeyDown={onKeyDown}
      className={cn("overflow-hidden rounded-panel border border-line bg-surface", className)}
    >
      {/* The frame. `min-h` is what keeps it a real object while the video has
          no intrinsic size — mid-load, or forever under the dev fixture. The
          desktop cap stops a 9:16 portrait take from blowing out the column in
          the two-column layout; `object-contain` means neither a portrait take
          on a phone nor a landscape one gets cropped or pillarboxed. */}
      <div className="relative flex min-h-[13.5rem] items-center justify-center bg-media sm:min-h-[18rem]">
        <video
          ref={videoRef}
          src={src}
          playsInline
          className="max-h-[60vh] w-auto max-w-full object-contain lg:max-h-[26rem]"
        />
        {/* Click anywhere on the picture to toggle. This is also the frame's tab
            stop, so the player is keyboard reachable before the control row. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        />
      </div>

      {/* Controls. `dir="ltr"` is deliberate and stays that way in Hebrew: the
          scrubber is a picture of TIME, and time in a 30-second take runs left
          to right for every speaker of every language. Mirroring it in RTL would
          put "the end of the take" where every video player on the device puts
          the beginning. Only the text on this row is language-shaped, and there
          is none — it is a clock. */}
      <div
        dir="ltr"
        className="player-controls flex items-center gap-3 border-t border-line px-3 py-2.5"
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        {/* Elapsed only until a real duration arrives — never `NaN:NaN`, and
            never `0:00 / Infinity`. */}
        <span className="nums shrink-0 text-micro text-fg-muted">
          {duration === null ? clock(current) : `${clock(current)} / ${clock(duration)}`}
        </span>

        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration ?? 100}
          step={0.01}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          className="player-scrubber min-w-0 flex-1"
          style={{ "--played": `${progress}%` } as React.CSSProperties}
        />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

import type { KaraokePath, KaraokeWord } from "@/lib/api"

export interface BurnInOptions {
  dir?: "ltr" | "rtl"
  mirror?: boolean
  onProgress?: (fraction: number) => void
}

/** Before the first line there is no caption. Gaps hold the previous line. */
export function activeLineAt(path: KaraokePath | null, t: number) {
  const lines = path?.lines ?? []
  return lines.find(line => line.t_start <= t && t <= line.t_end)
    ?? lines.filter(line => line.t_start <= t).reduce<(typeof lines)[number] | null>(
      (latest, line) => !latest || line.t_start > latest.t_start ? line : latest,
      null,
    )
}

export function captionWordsAt(path: KaraokePath | null, t: number) {
  const line = activeLineAt(path, t)
  return line && path
    ? path.words.filter(word => word.line === line.index).map(word => ({
      ...word, spoken: word.t_start <= t,
    }))
    : []
}

/** Preserve every word in at most two rows. The renderer fits oversized rows. */
export function wrapWords<T extends Pick<KaraokeWord, "w">>(
  words: readonly T[],
  maxWidth: number,
  measure: (text: string) => number,
): T[][] {
  const rows: T[][] = []
  for (const word of words) {
    if (!rows.length) rows.push([])
    let row = rows[rows.length - 1]
    if (rows.length < 2 && row.length && measure([...row, word].map(w => w.w).join(" ")) > maxWidth) {
      rows.push([])
      row = rows[rows.length - 1]
    }
    row.push(word)
  }
  return rows
}

export function markRect(w: number, h: number, dir: "ltr" | "rtl" = "ltr") {
  const size = Math.min(w, h) * 0.06
  const margin = size * 0.5
  return { x: dir === "rtl" ? w - margin - size : margin, y: margin, size }
}

export function burnInSupported(): boolean {
  return typeof HTMLCanvasElement !== "undefined"
    && typeof HTMLCanvasElement.prototype.captureStream === "function"
    && typeof MediaRecorder !== "undefined"
}

function drawOverlay(
  ctx: CanvasRenderingContext2D, path: KaraokePath | null, t: number,
  dir: "ltr" | "rtl", mark: Path2D,
) {
  const { width: w, height: h } = ctx.canvas
  const { x, y, size } = markRect(w, h, dir)
  ctx.save()
  ctx.fillStyle = "#a21caf"
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, size * 0.28)
  ctx.fill()
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 2.6
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke(mark)
  ctx.restore()
  ctx.direction = "ltr"
  ctx.textAlign = dir === "rtl" ? "right" : "left"
  ctx.textBaseline = "middle"
  ctx.font = `600 ${size * 0.65}px sans-serif`
  ctx.fillStyle = "#ffffff"
  ctx.fillText("killerpitch", dir === "rtl" ? x - size * 0.3 : x + size * 1.3, y + size / 2)

  const words = captionWordsAt(path, t)
  if (words.length) {
    let fontSize = h * 0.045
    ctx.font = `bold ${fontSize}px sans-serif`
    const maxWidth = w * 0.85
    const rows = wrapWords(words, maxWidth, text => ctx.measureText(text).width)
    const widest = Math.max(...rows.map(row => ctx.measureText(row.map(word => word.w).join(" ")).width))
    fontSize *= Math.min(1, maxWidth / Math.max(1, widest))
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.direction = dir
    ctx.textAlign = dir === "rtl" ? "right" : "left"
    const gap = ctx.measureText(" ").width
    const widths = rows.map(row => row.reduce((sum, word) => sum + ctx.measureText(word.w).width, 0) + gap * (row.length - 1))
    const padding = fontSize * 0.4
    const boxWidth = Math.max(...widths) + padding * 2
    const rowHeight = fontSize * 1.3
    const boxHeight = rows.length * rowHeight + padding * 2
    const top = Math.min(h * 0.76, h * 0.95 - boxHeight)
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)"
    ctx.beginPath()
    ctx.roundRect((w - boxWidth) / 2, top, boxWidth, boxHeight, padding)
    ctx.fill()
    rows.forEach((row, index) => {
      let cursor = (w + (dir === "rtl" ? widths[index] : -widths[index])) / 2
      for (const word of row) {
        ctx.fillStyle = word.spoken ? "#e879f9" : "#ffffff"
        ctx.fillText(word.w, cursor, top + padding + rowHeight * (index + 0.5))
        cursor += (dir === "rtl" ? -1 : 1) * (ctx.measureText(word.w).width + gap)
      }
    })
  }
  ctx.restore()
}

function mediaEvent(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, ready)
      video.removeEventListener("error", failed)
    }
    const ready = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error("Unable to decode the take")) }
    video.addEventListener(event, ready, { once: true })
    video.addEventListener("error", failed, { once: true })
  })
}

type CaptureVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream
  mozCaptureStream?: () => MediaStream
}

/** Local, real-time export. Audio is routed to the recording, never speakers. */
export async function burnInKaraoke(
  take: Blob, path: KaraokePath | null, opts: BurnInOptions = {},
): Promise<Blob> {
  if (!burnInSupported()) throw new Error("Video export is not supported in this browser")
  const video = document.createElement("video") as CaptureVideo
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  const url = URL.createObjectURL(take)
  let audio: AudioContext | undefined
  let source: MediaElementAudioSourceNode | undefined
  let destination: MediaStreamAudioDestinationNode | undefined
  let canvasStream: MediaStream | undefined
  let captured: MediaStream | undefined
  let recorder: MediaRecorder | undefined
  let frame = 0
  try {
    // Resume during the initiating user gesture, before waiting for metadata.
    if (typeof AudioContext !== "undefined") {
      audio = new AudioContext()
      await audio.resume()
      source = audio.createMediaElementSource(video)
      destination = audio.createMediaStreamDestination()
      source.connect(destination)
      // A muted element feeds silence into Web Audio. The graph only reaches the
      // recording destination, never the speakers, so unmuting stays silent.
      video.muted = false
    } else if (!video.captureStream && !video.mozCaptureStream) {
      throw new Error("Audio capture is not supported in this browser")
    }
    const metadata = mediaEvent(video, "loadedmetadata")
    video.src = url
    await metadata
    // MediaRecorder WebM often omits duration. Seeking discovers its real end.
    if (!Number.isFinite(video.duration)) {
      const end = mediaEvent(video, "seeked")
      video.currentTime = 1e10
      await end
      const start = mediaEvent(video, "seeked")
      video.currentTime = 0
      await start
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    if (!canvas.width || !canvas.height) throw new Error("The take has no video frames")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Unable to create the export canvas")
    const mark = new Path2D("M7.25 5.5v13M18.25 5.75 9.8 12M12.2 10.35 18.7 18.4")
    const draw = () => {
      ctx.save()
      if (opts.mirror) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.restore()
      drawOverlay(ctx, path, video.currentTime, opts.dir ?? "ltr", mark)
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : path?.total_s
      opts.onProgress?.(duration ? Math.min(1, video.currentTime / duration) : 0)
    }
    canvasStream = canvas.captureStream(30)
    let audioTracks = destination?.stream.getAudioTracks()
    if (!audioTracks) {
      // Some implementations expose capture tracks only once playback begins.
      await video.play()
      captured = (video.captureStream ?? video.mozCaptureStream)!.call(video)
      audioTracks = captured.getAudioTracks()
    }
    for (const track of audioTracks) canvasStream.addTrack(track)
    const mimeType = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"]
      .find(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) throw new Error("No supported video recording format")
    recorder = new MediaRecorder(canvasStream, { mimeType })
    const result = await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []
      const fail = (error: unknown) => reject(error instanceof Error ? error : new Error("Video export failed"))
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder!.onerror = fail
      recorder!.onstop = () => {
        if (chunks.length) resolve(new Blob(chunks, { type: recorder!.mimeType || mimeType }))
        else fail(new Error("Video export produced no data"))
      }
      const tick = () => {
        try {
          draw()
          if (!video.ended) frame = requestAnimationFrame(tick)
        } catch (error) { fail(error) }
      }
      video.onerror = fail
      video.onended = () => {
        try {
          cancelAnimationFrame(frame)
          draw()
          opts.onProgress?.(1)
          if (recorder!.state !== "inactive") recorder!.stop()
        } catch (error) { fail(error) }
      }
      recorder!.start()
      void video.play().then(tick, fail)
    })
    return result
  } finally {
    cancelAnimationFrame(frame)
    video.onended = null
    video.onerror = null
    video.pause()
    if (recorder && recorder.state !== "inactive") recorder.stop()
    canvasStream?.getTracks().forEach(track => track.stop())
    captured?.getTracks().forEach(track => track.stop())
    destination?.stream.getTracks().forEach(track => track.stop())
    source?.disconnect()
    if (audio && audio.state !== "closed") await audio.close().catch(() => {})
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(url)
  }
}

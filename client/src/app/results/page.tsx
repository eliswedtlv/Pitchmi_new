"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, LockOpen, Pencil, RotateCcw, Share2, Video } from "lucide-react"
import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"
import { VideoPlayer } from "@/components/ui/VideoPlayer"
import { useSession } from "@/store/session"
import { burnInKaraoke, burnInSupported } from "@/lib/burnIn"
import { resolveDir } from "@/lib/textDir"
import { LangToggle } from "@/components/LangToggle"
import { useUiLang } from "@/hooks/useUiLang"

export default function ResultsPage() {
  const router = useRouter()
  const { t } = useUiLang()
  const {
    takeBlob, takeBlobUrl, pathResult, rhythmLocked, takeRhythm, lastTakeTeleprompter, setRhythmLocked, reset, project, script,
  } = useSession()
  // The shareable video: the take with the karaoke words and the mark burned in
  // (KP-C). Built on the first Share tap; null until then.
  const [exported, setExported] = useState<Blob | null>(null)
  const [exportProgress, setExportProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!takeBlob) router.push("/")
  }, [takeBlob, router])

  if (!takeBlob) return null

  // Which rhythm the NEXT take follows (KP-B). No score: this screen is the
  // take, the rhythm status and the next step.
  const hasRhythm = Boolean(pathResult)
  const rhythmNote = rhythmLocked
    ? t.noteLocked
    : takeRhythm === "new"
      ? lastTakeTeleprompter ? t.noteFirstRhythm : t.noteNew
      : hasRhythm
        ? t.noteEarlier
        : t.noteTeleprompter

  // Sharing needs a fresh tap (iOS drops the user gesture during the export),
  // so the first tap builds the video and the second one shares it.
  async function handleShare() {
    if (!takeBlob || exportProgress !== null) return
    if (!exported && burnInSupported()) {
      setExportProgress(0)
      try {
        const blob = await burnInKaraoke(takeBlob, pathResult?.path ?? null, {
          dir: resolveDir(project?.language, script),
          mirror: true,
          onProgress: setExportProgress,
        })
        setExported(blob)
        // Desktop browsers can't share files: download right away.
        if (!navigator.canShare) downloadBlob(blob)
      } catch {
        // Export failed: fall back to the plain take.
        shareBlob(takeBlob)
      } finally {
        setExportProgress(null)
      }
      return
    }
    shareBlob(exported ?? takeBlob)
  }

  async function shareBlob(blob: Blob) {
    const ext = blob.type.includes("mp4") ? "mp4" : "webm"
    const file = new File([blob], `killerpitch-take.${ext}`, { type: blob.type })
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ title: t.shareTitle, files: [file] }).catch(() => {})
      return
    }
    downloadBlob(blob)
  }

  function downloadBlob(blob: Blob) {
    const ext = blob.type.includes("mp4") ? "mp4" : "webm"
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `killerpitch-take.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const shareLabel =
    exportProgress !== null
      ? t.preparing(Math.round(exportProgress * 100))
      : exported
        ? t.shareVideo
        : t.share

  return (
    <main className="min-h-screen px-[18px] safe-b-8 sm:px-8">
      <div className="studio-shell results-grid py-5 sm:py-7 lg:py-8">
        <header className="results-header flex items-center justify-between border-b border-line pb-5">
          <Brand />
          <div className="flex items-center gap-4">
            <div className="text-end">
              <p className="text-micro font-semibold uppercase tracking-[0.16em] text-fg">
                {t.yourTake}
              </p>
              <p className="nums mt-1 text-micro text-fg-subtle">{t.takeMax}</p>
            </div>
            <LangToggle />
          </div>
        </header>

        <div className="results-video">
          {/* Mirrored like the live preview: people see themselves as in a mirror.
              KP-G: on phones the picture is capped at ~45svh so the no-score line
              and Try again stay on screen with it (390×844) without scrolling. */}
          {takeBlobUrl && (
            <VideoPlayer
              src={takeBlobUrl}
              mirrored
              className="[&>div:first-child]:min-h-[11rem] [&_video]:max-h-[45svh] sm:[&>div:first-child]:min-h-[18rem] sm:[&_video]:max-h-[60vh] lg:[&_video]:max-h-[26rem]"
            />
          )}
          <div className="mt-2 flex items-center justify-between text-micro text-fg-subtle">
            <span>{t.takeCaption}</span>
            <span className="nums">{t.takeMaxClock}</span>
          </div>
          {/* KP-G: no score, on purpose — say so, and point at the two next steps. */}
          <p data-testid="no-score-note" className="mt-3 text-meta text-fg-muted">
            {t.noScore}
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
            <Button
              onClick={() => router.push("/karaoke")}
              size="lg"
              className="h-12 w-full gap-2 shadow-[0_6px_20px_rgba(23,70,255,0.2)]"
            >
              <RotateCcw className="h-5 w-5" />
              {t.tryAgain}
            </Button>
            <Button
              onClick={handleShare}
              disabled={exportProgress !== null}
              variant="outline"
              size="lg"
              className="h-12 w-full gap-2 px-2"
            >
              <Share2 className="h-4 w-4" />
              {shareLabel}
            </Button>
          </div>
        </div>

        <section className="results-actions overflow-hidden rounded-panel border border-accent/30 bg-accent-soft">
          <div className="p-5 sm:p-6">
            <p className="text-micro font-semibold uppercase tracking-[0.16em] text-accent">
              {t.nextTake}
            </p>
            <h2 className="mt-2 text-title font-semibold tracking-[-0.04em] text-fg">
              {t.resultsTitle}
            </h2>
            {takeRhythm === "unchanged" && (
              <p data-testid="rhythm-kept-note" className="mt-2 text-meta text-fg-muted">
                {t.rhythmKept}
              </p>
            )}
            {takeRhythm === "failed" && (
              <p data-testid="rhythm-failed-note" className="mt-2 text-meta text-fg-muted">
                {t.rhythmFailed}
              </p>
            )}
            <p data-testid="rhythm-note" className="mt-2 text-meta text-fg-muted">
              {rhythmNote}
            </p>
            {rhythmLocked ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-control border border-accent/30 bg-surface px-4 py-2.5">
                <span
                  data-testid="rhythm-locked-note"
                  className="flex items-start gap-2 text-meta font-medium text-fg"
                >
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {t.rhythmLocked}
                </span>
                <Button
                  onClick={() => setRhythmLocked(false)}
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                >
                  <LockOpen className="h-4 w-4" />
                  {t.unlock}
                </Button>
              </div>
            ) : (
              hasRhythm && (
                <div className="mt-4">
                  <Button
                    onClick={() => setRhythmLocked(true)}
                    variant="outline"
                    aria-pressed={false}
                    aria-describedby="keep-rhythm-help"
                    className="w-full gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    {takeRhythm === "new" ? t.keepThisRhythm : t.keepCurrentRhythm}
                  </Button>
                  {/* KP-G: what the lock does, right where it is. */}
                  <p id="keep-rhythm-help" data-testid="keep-rhythm-help" className="mt-2 text-micro text-fg-subtle">
                    {takeRhythm === "new" ? t.keepThisRhythmHelp : t.keepCurrentRhythmHelp}
                  </p>
                </div>
              )
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-accent/20 p-3">
            <Button
              onClick={() => router.push("/")}
              variant="ghost"
              className="gap-1.5 text-meta text-fg-muted"
            >
              <Pencil className="h-4 w-4" />
              {t.editText}
            </Button>
            <Button
              onClick={() => {
                reset()
                router.push("/")
              }}
              variant="ghost"
              className="gap-1.5 text-meta text-fg-muted"
            >
              <Video className="h-4 w-4" />
              {t.newVideo}
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}

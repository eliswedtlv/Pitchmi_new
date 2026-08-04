"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Pencil, RotateCcw, Share2, Video } from "lucide-react"
import { Brand } from "@/components/Brand"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VideoPlayer } from "@/components/ui/VideoPlayer"
import { useSession } from "@/store/session"

const DIM_LABELS: Record<string, string> = {
  voice: "Voice",
  body: "Body",
  delivery: "Delivery",
  timing: "Timing",
  accuracy: "Accuracy",
}

const FLAG_LABELS: Record<string, string> = {
  rushed_line: "Rushing",
  dragged_line: "Dragging",
  long_pause: "Long pause",
  skipped_line: "Skipped line",
  off_script: "Off script",
}

function band(score: number) {
  if (score >= 80) return { bar: "bg-good", text: "text-good-fg" }
  if (score >= 65) return { bar: "bg-warn", text: "text-warn-fg" }
  return { bar: "bg-bad", text: "text-bad-fg" }
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3">
      <span className="text-meta text-fg-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-track">
        <div
          className={`h-full rounded-full ${band(score).bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="nums text-end text-meta font-semibold text-fg">{score}</span>
    </div>
  )
}

function scoreReadout(score: number) {
  if (score >= 85) return "Confident and controlled. Keep the edge."
  if (score >= 75) return "The delivery lands. Now make it memorable."
  if (score >= 65) return "The rhythm is forming. Give it more shape."
  return "Reset the rhythm and make every line deliberate."
}

export default function ResultsPage() {
  const router = useRouter()
  const { takeBlob, takeBlobUrl, evalResult, reset } = useSession()

  useEffect(() => {
    if (!evalResult || !takeBlob) router.push("/")
  }, [evalResult, takeBlob, router])

  if (!evalResult || !takeBlob) return null

  async function handleShare() {
    if (!takeBlob) return
    const file = new File([takeBlob], "pitchmi-take.webm", { type: takeBlob.type })
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ title: "My PitchMi take", files: [file] }).catch(() => {})
      return
    }
    handleDownload()
  }

  function handleDownload() {
    if (!takeBlobUrl) return
    const a = document.createElement("a")
    a.href = takeBlobUrl
    a.download = "pitchmi-take.webm"
    a.click()
  }

  return (
    <main className="min-h-screen px-[18px] safe-b-8 sm:px-8">
      <div className="studio-shell results-grid py-5 sm:py-7 lg:py-8">
        <header className="results-header flex items-center justify-between border-b border-line pb-5">
          <Brand />
          <div className="text-end">
            <p className="text-micro font-semibold uppercase tracking-[0.16em] text-fg">
              Delivery report
            </p>
            <p className="nums mt-1 text-micro text-fg-subtle">Take 01 · ≤30 sec</p>
          </div>
        </header>

        <section
          data-testid="score-panel"
          className="results-score overflow-hidden rounded-panel border border-line-strong bg-surface"
        >
          <div className="border-b border-line p-5 sm:p-6">
            <p className="text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              Overall score
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span
                className={`nums text-[clamp(4.25rem,9vw,5.5rem)] font-semibold leading-[0.82] tracking-[-0.07em] ${band(evalResult.overall).text}`}
              >
                {evalResult.overall}
              </span>
              <span className="nums pb-1 text-meta text-fg-subtle">/ 100</span>
            </div>
            <p className="mt-4 max-w-sm text-body font-medium text-fg">
              {scoreReadout(evalResult.overall)}
            </p>
            <p className="mt-1 text-micro text-fg-subtle">
              Delivery 50% · timing 25% · accuracy 25%
            </p>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="space-y-3">
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                Delivery
              </p>
              {(["voice", "body", "delivery"] as const).map((dim) => (
                <ScoreBar
                  key={dim}
                  label={DIM_LABELS[dim]}
                  score={evalResult.dimensions[dim]}
                />
              ))}
            </div>
            <div className="space-y-3 border-t border-line pt-5">
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                Script match
              </p>
              {(["timing", "accuracy"] as const).map((dim) => (
                <ScoreBar
                  key={dim}
                  label={DIM_LABELS[dim]}
                  score={evalResult.dimensions[dim]}
                />
              ))}
            </div>
          </div>

          <p className="nums border-t border-line px-5 py-3 text-micro text-fg-subtle sm:px-6">
            {evalResult.evals_left_today} evaluations left today
          </p>
        </section>

        <div className="results-video">
          {takeBlobUrl && <VideoPlayer src={takeBlobUrl} />}
          <div className="mt-3 flex items-center justify-between text-micro text-fg-subtle">
            <span>Your take · processed privately</span>
            <span className="nums">00:30 max</span>
          </div>
        </div>

        <section className="results-coach overflow-hidden rounded-panel border border-line-strong bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <div>
              <p className="text-micro font-semibold uppercase tracking-[0.16em] text-fg">
                Coach notes
              </p>
              <p className="mt-1 text-micro text-fg-subtle">
                Delivery only. Never the message.
              </p>
            </div>
            <span className="nums text-micro text-fg-subtle">03 notes</span>
          </div>
          <ol>
            {evalResult.comments.map((comment, index) => (
              <li
                key={index}
                className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:px-6"
              >
                <span className="nums text-meta font-semibold text-accent">
                  0{index + 1}
                </span>
                <span dir="auto" className="text-body text-fg">
                  {comment}
                </span>
              </li>
            ))}
          </ol>

          {evalResult.flags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-raised/45 px-5 py-4 sm:px-6">
              <span className="me-1 text-micro font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                Watch
              </span>
              {evalResult.flags.map((flag, index) => (
                <Badge key={index} variant="warning">
                  {FLAG_LABELS[flag.type] ?? flag.type}
                  {flag.line !== undefined ? ` (line ${flag.line + 1})` : ""}
                </Badge>
              ))}
            </div>
          )}
        </section>

        <section className="results-actions overflow-hidden rounded-panel border border-accent/30 bg-accent-soft">
          <div className="p-5 sm:p-6">
            <p className="text-micro font-semibold uppercase tracking-[0.16em] text-accent">
              Next take
            </p>
            <h2 className="mt-2 text-title font-semibold tracking-[-0.04em] text-fg">
              Keep the words. Change the delivery.
            </h2>
            <p className="mt-2 text-meta text-fg-muted">
              Your prompter now follows the pace measured in this take.
            </p>
          </div>
          <div className="space-y-3 border-t border-accent/20 p-3">
            <Button
              onClick={() => router.push("/karaoke")}
              size="lg"
              className="h-12 w-full gap-2 shadow-[0_6px_20px_rgba(23,70,255,0.2)]"
            >
              <RotateCcw className="h-5 w-5" />
              Try again
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="gap-1 px-1.5 text-micro sm:gap-2 sm:px-2 sm:text-meta"
              >
                <Pencil className="h-4 w-4" />
                Edit text
              </Button>
              <Button
                onClick={() => {
                  reset()
                  router.push("/")
                }}
                variant="outline"
                className="gap-1 px-1.5 text-micro sm:gap-2 sm:px-2 sm:text-meta"
              >
                <Video className="h-4 w-4" />
                New video
              </Button>
              <Button
                onClick={handleShare}
                variant="outline"
                className="gap-1 px-1.5 text-micro sm:gap-2 sm:px-2 sm:text-meta"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Share2, RotateCcw, Video, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

/** The three score bands, as tokens. Same thresholds as before (≥80 / ≥65). */
function band(score: number) {
  if (score >= 80) return { bar: "bg-good", text: "text-good-fg" }
  if (score >= 65) return { bar: "bg-warn", text: "text-warn-fg" }
  return { bar: "bg-bad", text: "text-bad-fg" }
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-meta">
        <span className="text-fg-muted">{label}</span>
        <span className="nums font-medium text-fg">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-track overflow-hidden">
        <div className={`h-full rounded-full ${band(score).bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const { takeBlob, takeBlobUrl, evalResult, reset } = useSession()

  useEffect(() => {
    if (!evalResult || !takeBlob) router.push("/")
  }, [evalResult, takeBlob, router])

  if (!evalResult || !takeBlob) return null

  // Single OS-level action (T-1170 §B): the native share sheet already offers
  // both "send to app" and "save to files/photos", so it covers share AND
  // download. Desktop browsers without file sharing fall back to a plain
  // download so the button always does something.
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
    <main className="min-h-screen px-4 pt-8 safe-b-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-title font-medium text-fg">Your Results</h1>

        {/* Video playback — object-contain keeps the correct aspect for both
            portrait (phone) and landscape (desktop) takes; no sideways letterbox. */}
        {takeBlobUrl && (
          <video
            src={takeBlobUrl}
            controls
            playsInline
            className="mx-auto max-h-[60vh] w-auto max-w-full rounded-panel bg-media object-contain"
          />
        )}

        {/* Score + breakdown as ONE object (Teal's Final Resume Check): the
            headline number sits beside the dimension list rather than above it,
            so the eye lands on the number and then reads across into what made
            it. On a phone the two halves stack, separated by a rule. */}
        <section className="rounded-panel border border-line bg-surface">
          <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-6">
            <div className="flex items-baseline gap-3 sm:block sm:space-y-1">
              <p
                className={`nums text-display font-medium leading-none ${band(evalResult.overall).text}`}
              >
                {evalResult.overall}
              </p>
              <p className="text-meta uppercase tracking-[0.08em] text-fg-subtle">Overall score</p>
            </div>

            <div className="space-y-3 border-t border-line pt-5 sm:border-t-0 sm:border-s sm:ps-8 sm:pt-0">
              {Object.entries(evalResult.dimensions).map(([dim, score]) => (
                <ScoreBar key={dim} label={DIM_LABELS[dim] ?? dim} score={score} />
              ))}
            </div>
          </div>

          <p className="nums border-t border-line px-5 py-2.5 text-micro text-fg-subtle sm:px-6">
            {evalResult.evals_left_today} evaluations left today
          </p>
        </section>

        {/* Coach feedback, with the flags as its footer — they are the same
            judgement at a different resolution, not a separate report. */}
        <section className="rounded-panel border border-line bg-surface">
          <div className="p-5 sm:p-6 space-y-4">
            <h2 className="text-meta font-medium uppercase tracking-[0.08em] text-fg-subtle">
              Coach feedback
            </h2>
            <ul className="space-y-3">
              {evalResult.comments.map((c, i) => (
                <li key={i} className="flex items-start gap-3 text-body text-fg">
                  <span className="nums shrink-0 text-meta leading-6 text-fg-subtle">{i + 1}</span>
                  <span dir="auto" className="min-w-0">{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {evalResult.flags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
              <span className="text-micro uppercase tracking-[0.08em] text-fg-subtle">Flags</span>
              {evalResult.flags.map((flag, i) => (
                <Badge key={i} variant="warning">
                  {FLAG_LABELS[flag.type] ?? flag.type}
                  {flag.line !== undefined ? ` (line ${flag.line + 1})` : ""}
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* Actions (T-1170 §B): re-recording the same script is the most common
            next step, so Try again is the primary — and under this direction
            (T-10022) that means it is the screen's ONE filled button, not a
            green one: green here means "you scored ≥ 80". */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push("/karaoke")}
            size="lg"
            className="w-full gap-2"
          >
            <RotateCcw className="h-5 w-5" />
            Try again
          </Button>
          <div className="grid grid-cols-3 gap-2">
            {/* Edit text (T-10018): back to the script screen with the words
                still in the box. Saving the edit re-seeds the path server-side,
                so the next take is never scored against timings measured for
                different words. `reset()` is deliberately NOT called — that
                would wipe the script this button exists to keep. */}
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="gap-2 px-2"
            >
              <Pencil className="h-4 w-4" />
              Edit text
            </Button>
            <Button
              onClick={() => { reset(); router.push("/") }}
              variant="outline"
              className="gap-2 px-2"
            >
              <Video className="h-4 w-4" />
              New video
            </Button>
            <Button onClick={handleShare} variant="outline" className="gap-2 px-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

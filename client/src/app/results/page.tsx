"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Download, Share2, Cloud, RotateCcw, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/store/session"
import { saveTake } from "@/lib/api"
import { savedToast, myVideosLabel, savedButton } from "@/lib/strings"
import { useState } from "react"

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

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 65 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-neutral-700">{label}</span>
        <span className="font-semibold text-neutral-900">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const { project, takeBlob, takeBlobUrl, evalResult, reset } = useSession()
  const lang = project?.language
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (!evalResult || !takeBlob) router.push("/")
  }, [evalResult, takeBlob, router])

  if (!evalResult || !takeBlob) return null

  async function handleSave() {
    // Idempotent guard: never save the same take twice, even on rapid taps.
    if (!project || !takeBlob || !evalResult || saving || saved) return
    setSaving(true)
    setToast(null)
    try {
      await saveTake({ video: takeBlob, projectId: project.id, scores: evalResult })
      setSaved(true)
      setToast({ variant: "success", message: savedToast(lang) })
    } catch (e) {
      setToast({ variant: "error", message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    if (!takeBlob || !navigator.share) return
    const file = new File([takeBlob], "pitchmi-take.webm", { type: takeBlob.type })
    await navigator.share({ title: "My PitchMi take", files: [file] }).catch(() => {})
  }

  function handleDownload() {
    if (!takeBlobUrl) return
    const a = document.createElement("a")
    a.href = takeBlobUrl
    a.download = "pitchmi-take.webm"
    a.click()
  }

  const overallColor =
    evalResult.overall >= 80 ? "text-green-600" : evalResult.overall >= 65 ? "text-amber-600" : "text-red-600"

  return (
    <main className="min-h-screen bg-neutral-50 px-4 pt-8 safe-b-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-neutral-900 text-center">Your Results</h1>

        {/* Video playback — object-contain keeps the correct aspect for both
            portrait (phone) and landscape (desktop) takes; no sideways letterbox. */}
        {takeBlobUrl && (
          <video
            src={takeBlobUrl}
            controls
            playsInline
            className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl bg-black object-contain"
          />
        )}

        {/* Overall score */}
        <Card>
          <CardContent className="pt-6 text-center space-y-1">
            <p className="text-sm text-neutral-500">Overall score</p>
            <p className={`text-7xl font-bold ${overallColor}`}>{evalResult.overall}</p>
            <p className="text-xs text-neutral-400">{evalResult.evals_left_today} evaluations left today</p>
          </CardContent>
        </Card>

        {/* Dimension bars */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(evalResult.dimensions).map(([dim, score]) => (
              <ScoreBar key={dim} label={DIM_LABELS[dim] ?? dim} score={score} />
            ))}
          </CardContent>
        </Card>

        {/* Coach comments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coach feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {evalResult.comments.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="text-neutral-400 flex-shrink-0 font-mono">{i + 1}.</span>
                  <span dir="auto" className="min-w-0">{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Flags */}
        {evalResult.flags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {evalResult.flags.map((flag, i) => (
                  <Badge key={i} variant="warning">
                    {FLAG_LABELS[flag.type] ?? flag.type}
                    {flag.line !== undefined ? ` (line ${flag.line + 1})` : ""}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => router.push("/karaoke")} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            onClick={() => { reset(); router.push("/") }}
            variant="outline"
            className="gap-2"
          >
            <Video className="h-4 w-4" />
            New video
          </Button>
          <Button onClick={handleDownload} variant="secondary" className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button onClick={handleShare} variant="secondary" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || saved}
          variant="success"
          size="lg"
          className="w-full gap-2"
        >
          <Cloud className="h-5 w-5" />
          {saved ? savedButton(lang) : saving ? "Saving…" : "Save to cloud"}
        </Button>
      </div>

      {/* Save feedback snackbar (T-1167 §C): confirms the save landed and offers a
          one-tap jump to the user's saved videos; errors surface here too. */}
      {toast && (
        <div
          data-testid="save-toast"
          data-variant={toast.variant}
          role="status"
          className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
        >
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${
              toast.variant === "success" ? "bg-neutral-900" : "bg-red-700"
            }`}
          >
            <span>{toast.message}</span>
            {toast.variant === "success" && (
              <button
                type="button"
                onClick={() => router.push("/videos")}
                className="font-semibold text-green-400 underline underline-offset-2"
              >
                {myVideosLabel(lang)}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

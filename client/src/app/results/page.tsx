"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Download, Share2, Cloud, RotateCcw, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/store/session"
import { saveTake } from "@/lib/api"
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
  const { project, takeBlob, takeBlobUrl, evalResult } = useSession()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!evalResult || !takeBlob) router.push("/")
  }, [evalResult, takeBlob, router])

  if (!evalResult || !takeBlob) return null

  async function handleSave() {
    if (!project || !takeBlob || !evalResult) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveTake({ video: takeBlob, projectId: project.id, scores: evalResult })
      setSaved(true)
    } catch (e) {
      setSaveError((e as Error).message)
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

        {/* Video playback */}
        {takeBlobUrl && (
          <video
            src={takeBlobUrl}
            controls
            playsInline
            className="w-full rounded-xl bg-black aspect-video"
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
                  <span>{c}</span>
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
          <Button onClick={() => router.push("/editor")} variant="outline" className="gap-2">
            <Edit className="h-4 w-4" />
            Edit script
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
          {saved ? "Saved!" : saving ? "Saving…" : "Save to cloud"}
        </Button>

        {saveError && (
          <p className="text-sm text-red-700 text-center">{saveError}</p>
        )}
      </div>
    </main>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/store/session"
import { getPath } from "@/lib/api"
import { estimateDuration, fitMeter } from "@/lib/fit"

export default function EditorPage() {
  const router = useRouter()
  const { project, editedScript, speed, setEditedScript, setSpeed, setPathResult } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project) router.push("/")
  }, [project, router])

  const estDuration = estimateDuration(editedScript, speed)
  const fit = fitMeter(estDuration)

  // RTL: detect from project language
  const dir = project?.language
    ? ["he", "ar", "fa", "ur"].includes(project.language) ? "rtl" : "ltr"
    : "ltr"

  async function handleRehearseClick() {
    if (!project) return
    setLoading(true)
    setError(null)
    try {
      const result = await getPath({ project_id: project.id, edited_script: editedScript, speed })
      setPathResult(result)
      router.push("/karaoke")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const speedSteps = [0.75, 0.875, 1.0, 1.125, 1.25]

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900">Edit your script</h1>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            ← Home
          </button>
        </div>

        {/* Fit meter */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Estimated duration</span>
              <span className={`font-semibold ${fit.fits ? "text-green-700" : "text-red-700"}`}>
                {estDuration.toFixed(1)}s / 60s
              </span>
            </div>
            <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${fit.fits ? "bg-green-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, fit.ratio * 100).toFixed(1)}%` }}
              />
            </div>
            {fit.fits ? (
              <p className="text-xs text-green-700">{fit.remaining.toFixed(1)}s remaining</p>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{fit.over.toFixed(1)}s over limit — shorten your script or increase speed</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warning banner */}
        {!fit.fits && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Your script won&apos;t fit in 60 seconds at the current speed. Please shorten it or increase speed.
            </p>
          </div>
        )}

        {/* Speed slider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reading speed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 w-8">0.75×</span>
              <input
                type="range"
                min={0.75}
                max={1.25}
                step={0.01}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-neutral-500 w-8">1.25×</span>
            </div>
            <div className="flex justify-between">
              {speedSteps.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    Math.abs(speed - s) < 0.01
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-medium text-neutral-700">{speed.toFixed(2)}×</p>
          </CardContent>
        </Card>

        {/* Script textarea */}
        <textarea
          dir={dir}
          className="w-full min-h-[240px] rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-y"
          value={editedScript}
          onChange={(e) => setEditedScript(e.target.value)}
          placeholder="Your transcribed script will appear here. Edit freely."
        />

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button
          onClick={handleRehearseClick}
          disabled={loading || !fit.fits || !editedScript.trim()}
          size="lg"
          className="w-full h-14 text-base"
        >
          {loading ? "Building path…" : "Rehearse next take →"}
        </Button>
      </div>
    </main>
  )
}

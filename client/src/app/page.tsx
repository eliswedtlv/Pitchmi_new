"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Video, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createProject, transcribeVideo } from "@/lib/api"
import { useSession } from "@/store/session"

type UseCase = "pitch" | "intro" | "sales" | "social" | "custom"

const USE_CASES: { id: UseCase; label: string; emoji: string }[] = [
  { id: "pitch", label: "Pitch", emoji: "🚀" },
  { id: "intro", label: "Intro", emoji: "👋" },
  { id: "sales", label: "Sales", emoji: "💼" },
  { id: "social", label: "Social", emoji: "📱" },
  { id: "custom", label: "Custom", emoji: "✏️" },
]

export default function HomePage() {
  const router = useRouter()
  const { setProject, setTakeBlob, setPathResult } = useSession()

  const [useCase, setUseCase] = useState<UseCase>("pitch")
  const [customText, setCustomText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function handleRecordClick() {
    setLoading(true)
    setError(null)
    try {
      const project = await createProject({
        use_case: useCase,
        use_case_custom: useCase === "custom" ? customText : undefined,
      })
      setProject(project)
      router.push("/recorder")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const project = await createProject({
        use_case: useCase,
        use_case_custom: useCase === "custom" ? customText : undefined,
      })
      setProject(project)
      setTakeBlob(file)
      // Transcribe the upload
      const result = await transcribeVideo(file, project.id)
      // Persist the detected language for RTL resolution downstream (T-1164).
      setProject({ ...project, language: result.language })
      // Zero-edit flow (T-1169): straight to karaoke at the take's real pace.
      setPathResult({ path: result.path, fits: true, est_duration_s: result.path.total_s })
      router.push("/karaoke")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white px-4 pt-12 safe-b-12">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">PitchMi</h1>
          <p className="text-neutral-500 text-lg">Perfect your spoken video in minutes.</p>
        </div>

        {/* Use-case picker */}
        <Card>
          <CardHeader>
            <CardTitle>What are you recording?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => setUseCase(uc.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                    useCase === uc.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span>{uc.emoji}</span>
                  <span>{uc.label}</span>
                </button>
              ))}
            </div>

            {useCase === "custom" && (
              <textarea
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                rows={2}
                placeholder="Describe your video (e.g. product demo for investors)"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            )}
          </CardContent>
        </Card>

        {/* Record button */}
        <Button
          onClick={handleRecordClick}
          disabled={loading || (useCase === "custom" && !customText.trim())}
          size="lg"
          className="w-full gap-3 text-base h-14"
        >
          <Video className="h-5 w-5" />
          {loading ? "Setting up…" : "Record a take"}
        </Button>

        {/* Upload / drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
            dragging ? "border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-400"
          }`}
        >
          <Upload className="h-8 w-8 text-neutral-400" />
          <p className="text-sm text-neutral-500 text-center">
            Or drag &amp; drop an existing video<br />
            <span className="text-xs text-neutral-400">≤ 60 seconds · webm / mp4 / mov</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* No "My saved videos" nav (T-1170 §B4): nothing writes to cloud storage
            in the MVP flow, so the entry point is hidden. /videos still exists. */}
      </div>
    </main>
  )
}

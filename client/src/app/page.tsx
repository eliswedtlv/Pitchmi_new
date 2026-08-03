"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createProject, saveScript } from "@/lib/api"
import { MAX_TAKE_S } from "@/lib/limits"
import { estimateSeconds, splitAtSeconds } from "@/lib/estimate"
import { resolveDir } from "@/lib/textDir"
import { useSession } from "@/store/session"

// Shared by the textarea and the highlight layer behind it. Any divergence
// here and the amber tail stops lining up with the words it is marking.
const TEXT_BOX = "px-3 py-2 text-base leading-relaxed whitespace-pre-wrap break-words"

export default function HomePage() {
  const router = useRouter()
  const { script, setProject, setScript, setPathResult } = useSession()

  // Pre-filled when the user came back via "Edit text" on the results screen.
  const [text, setText] = useState(script)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)

  const seconds = estimateSeconds(text)
  const overBy = Math.round(seconds - MAX_TAKE_S)
  const isOver = seconds > MAX_TAKE_S
  const { head, tail } = splitAtSeconds(text, MAX_TAKE_S)
  // Hebrew right-aligns as it is typed; the language is not known yet, so the
  // content itself decides (T-1164).
  const dir = resolveDir(null, text)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const project = await createProject()
      setProject(project)
      // The server stores the script and hands back a seed path — a first,
      // disposable guess at the pace. The first take replaces it with the
      // user's real timings (T-10018).
      const result = await saveScript(project.id, text)
      setScript(text)
      setPathResult({
        path: result.path,
        fits: true,
        est_duration_s: result.est_duration_s,
      })
      router.push("/karaoke")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white px-4 pt-12 safe-b-12">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">PitchMi</h1>
          <p className="text-neutral-500 text-lg">
            If you can’t say it in 30 seconds, don’t say it
          </p>
        </div>

        {/* Script */}
        <Card>
          <CardHeader>
            <CardTitle>What are you going to say?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* The textarea sits on a transparent background over a mirror of
                its own text, so the over-length tail can be tinted in place.
                Both layers share TEXT_BOX and scroll together. */}
            <div className="relative">
              {isOver && (
                <div
                  ref={mirrorRef}
                  aria-hidden
                  dir={dir}
                  className={`pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent ${TEXT_BOX}`}
                >
                  <span className="text-transparent">{head}</span>
                  <span data-testid="over-length-tail" className="rounded bg-amber-100 text-transparent">
                    {tail}
                  </span>
                </div>
              )}
              <textarea
                aria-label="Your script"
                dir={dir}
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={(e) => {
                  if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop
                }}
                placeholder="Type or paste what you want to say…"
                className={`relative w-full resize-none rounded-md border border-neutral-300 bg-transparent text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${TEXT_BOX}`}
              />
            </div>

            {/* Estimate. A hint, never a gate — the 30s cap is checked on the
                take you actually record, at the speed you actually talk. */}
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={isOver ? "font-medium text-amber-600" : "text-neutral-500"}>
                {isOver
                  ? `About ${overBy} second${overBy === 1 ? "" : "s"} over — trim it a little`
                  : `~${Math.round(seconds)}s`}
              </span>
              <span className="text-xs text-neutral-400 text-right">
                Rough estimate · the {MAX_TAKE_S}s limit is checked on your take
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Record */}
        <Button
          onClick={handleStart}
          disabled={loading || !text.trim()}
          size="lg"
          className="w-full gap-3 text-base h-14"
        >
          <Video className="h-5 w-5" />
          {loading ? "Setting up…" : "Record it"}
        </Button>

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

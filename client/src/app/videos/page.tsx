"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSupabaseClient } from "@/lib/supabase"
import { getTakeUrl } from "@/lib/api"

interface SavedTake {
  id: string
  project_id: string
  duration_s: number | null
  scores: { overall?: number } | null
  created_at: string
}

export default function VideosPage() {
  const [takes, setTakes] = useState<SavedTake[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    supabase
      .from("saved_takes")
      .select("id, project_id, duration_s, scores, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setTakes((data ?? []) as SavedTake[])
        setLoading(false)
      })
  }, [])

  async function handlePlay(takeId: string) {
    try {
      const { url } = await getTakeUrl(takeId)
      setPlayUrl(url)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(takeId: string) {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error: err } = await supabase.from("saved_takes").delete().eq("id", takeId)
    if (err) {
      setError(err.message)
    } else {
      setTakes((prev) => prev.filter((t) => t.id !== takeId))
    }
  }

  return (
    <main className="min-h-screen px-4 pt-8 safe-b-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-title font-medium text-fg">My Videos</h1>
          <Link href="/" className="text-meta text-fg-muted hover:text-fg transition-colors">
            ← Home
          </Link>
        </div>

        {/* Playback modal. Dark chrome in both schemes, like /karaoke — it is a
            video surface, and the one other place a shadow is allowed. */}
        {playUrl && (
          <div
            className="scheme-dark fixed inset-0 z-50 bg-media/80 flex items-center justify-center p-4 safe-b-4"
            onClick={() => setPlayUrl(null)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
              <video
                src={playUrl}
                controls
                autoPlay
                playsInline
                className="mx-auto max-h-[80vh] w-auto max-w-full rounded-panel bg-media object-contain shadow-lg"
              />
              <Button onClick={() => setPlayUrl(null)} variant="secondary" className="mt-3 w-full">
                Close
              </Button>
            </div>
          </div>
        )}

        {loading && <p className="text-meta text-fg-muted text-center py-12">Loading your videos…</p>}
        {error && (
          <p className="rounded-control border border-bad/30 bg-bad-soft px-4 py-3 text-meta text-bad-fg">
            {error}
          </p>
        )}

        {!loading && takes.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <p className="text-body text-fg-muted">No saved videos yet.</p>
            <Link href="/">
              <Button>Record your first take</Button>
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {takes.map((take) => (
            <Card key={take.id}>
              <CardContent className="p-4 sm:p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {take.scores?.overall !== undefined && (
                        <Badge variant="secondary" className="nums text-meta font-medium">
                          {take.scores.overall}
                        </Badge>
                      )}
                      {take.duration_s && (
                        <span className="nums text-micro text-fg-muted">{take.duration_s.toFixed(1)}s</span>
                      )}
                    </div>
                    <p className="nums text-micro text-fg-subtle">
                      {new Date(take.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handlePlay(take.id)} className="gap-1">
                      <Play className="h-3.5 w-3.5" />
                      Play
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete take"
                      onClick={() => handleDelete(take.id)}
                      className="text-bad-fg hover:bg-bad-soft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}

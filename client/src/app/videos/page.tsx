"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Play, Trash2, Video as VideoIcon, X } from "lucide-react"
import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VideoPlayer } from "@/components/ui/VideoPlayer"
import { getSupabaseClient } from "@/lib/supabase"
import { deleteTake, getTakeUrl } from "@/lib/api"

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
    try {
      await deleteTake(takeId)
      setTakes((prev) => prev.filter((t) => t.id !== takeId))
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  return (
    <main className="min-h-screen px-[18px] safe-b-8 sm:px-8">
      <div className="studio-shell space-y-7 py-5 sm:py-7">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-meta font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </header>

        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.16em] text-accent">
              Private library
            </p>
            <h1 className="mt-2 text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-none tracking-[-0.06em] text-fg">
              My Videos
            </h1>
          </div>
          <p className="hidden max-w-sm text-end text-meta text-fg-muted sm:block">
            Only takes you explicitly save appear here. PitchMi never stores a
            rehearsal automatically.
          </p>
        </div>

        {playUrl && (
          <div
            className="scheme-dark fixed inset-0 z-50 flex items-center justify-center bg-media/90 p-4 safe-b-4"
            onClick={() => setPlayUrl(null)}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-2xl"
            >
              <button
                type="button"
                aria-label="Close player"
                onClick={() => setPlayUrl(null)}
                className="absolute -top-12 end-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-4 w-4" />
              </button>
              <VideoPlayer src={playUrl} autoPlay className="shadow-2xl" />
            </div>
          </div>
        )}

        {loading && (
          <p className="py-12 text-center text-meta text-fg-muted">Loading your videos…</p>
        )}
        {error && (
          <p className="rounded-control border border-bad/30 bg-bad-soft px-4 py-3 text-meta text-bad-fg">
            {error}
          </p>
        )}

        {!loading && takes.length === 0 && (
          <section className="grid min-h-[28rem] place-items-center border-y border-line py-14 text-center">
            <div className="max-w-md">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-panel border border-line-strong bg-surface text-accent">
                <VideoIcon className="h-6 w-6" />
              </span>
              <h2 className="mt-6 text-title font-semibold tracking-[-0.04em] text-fg">
                No saved takes yet.
              </h2>
              <p className="mt-2 text-body text-fg-muted">
                Rehearsals stay on your device. When cloud saving returns to the
                main flow, only the takes you choose will appear here.
              </p>
              <Link href="/" className="mt-7 inline-block">
                <Button size="lg">Record your first take</Button>
              </Link>
            </div>
          </section>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {takes.map((take) => (
            <Card key={take.id} className="border-line-strong">
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

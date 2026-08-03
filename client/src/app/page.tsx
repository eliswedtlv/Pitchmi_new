"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createProject, saveScript } from "@/lib/api"
import { MAX_TAKE_S } from "@/lib/limits"
import { estimateSeconds, splitAtSeconds } from "@/lib/estimate"
import { resolveDir } from "@/lib/textDir"
import { useSession } from "@/store/session"

// Shared by the textarea and the highlight layer behind it. Any divergence
// here — font, size, line-height, padding, letter-spacing — and the amber tail
// stops lining up with the words it is marking, silently. Change it HERE and
// nowhere else, and check it against a script that wraps over four lines.
const TEXT_BOX = "px-4 py-3 text-body leading-relaxed whitespace-pre-wrap break-words"

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
    // Top-aligned on a phone — a vertically centred composition fights the
    // on-screen keyboard — and centred from `sm` up, where there is nothing else
    // on the page to anchor it.
    <main className="min-h-screen flex flex-col px-4 pt-10 sm:justify-center sm:pt-4 safe-b-12">
      <div className="w-full max-w-lg mx-auto space-y-6">
        {/* Header. The slogan is the headline, not a subtitle: the 30-second
            constraint is the product's point, and the counter below is only its
            consequence. The wordmark rides above it as a quiet eyebrow. */}
        <header className="space-y-3">
          <p className="text-micro font-medium uppercase tracking-[0.18em] text-fg-subtle">
            PitchMi
          </p>
          <h1 className="text-title font-medium text-fg text-balance">
            If you can’t say it in 30 seconds, don’t say it
          </h1>
        </header>

        {/* Script. The writing surface IS the screen here (WhatsApp's status
            composer), so there is no card shell around it — the panel below is
            the box itself, with the estimate attached as its own footer strip
            on a hairline rule (Product Hunt's in-field counter). */}
        <section className="space-y-2">
          {/* Not a <label for>: the textarea's accessible name is its own
              aria-label ("Your script"), and pointing a label at it would give
              the field two competing names. This line is the section's caption. */}
          <p className="text-meta text-fg-muted">What are you going to say?</p>

          <div className="rounded-panel border border-line bg-surface overflow-hidden focus-within:border-line-strong transition-colors">
            {/* The textarea sits on a transparent background over a mirror of
                its own text, so the over-length tail can be tinted in place.
                Both layers share TEXT_BOX and scroll together. */}
            <div className="relative">
              {isOver && (
                <div
                  ref={mirrorRef}
                  aria-hidden
                  dir={dir}
                  className={`pointer-events-none absolute inset-0 overflow-hidden border border-transparent ${TEXT_BOX}`}
                >
                  <span className="text-transparent">{head}</span>
                  <span data-testid="over-length-tail" className="rounded bg-warn-soft text-transparent">
                    {tail}
                  </span>
                </div>
              )}
              <textarea
                aria-label="Your script"
                dir={dir}
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={(e) => {
                  if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop
                }}
                placeholder="Type or paste what you want to say…"
                className={`relative w-full resize-none border border-transparent bg-transparent text-fg placeholder:text-fg-subtle focus:outline-none ${TEXT_BOX}`}
              />
            </div>

            {/* Estimate. A hint, never a gate — the 30s cap is checked on the
                take you actually record, at the speed you actually talk. It only
                takes colour once the script is genuinely over. */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line px-4 py-2.5">
              <span
                className={`nums text-meta ${isOver ? "font-medium text-warn-fg" : "text-fg-muted"}`}
              >
                {isOver
                  ? `About ${overBy} second${overBy === 1 ? "" : "s"} over — trim it a little`
                  : `~${Math.round(seconds)}s`}
              </span>
              <span className="text-micro text-fg-subtle text-end">
                Rough estimate · the {MAX_TAKE_S}s limit is checked on your take
              </span>
            </div>
          </div>
        </section>

        {/* Record — the one filled action on the screen. */}
        <Button
          onClick={handleStart}
          disabled={loading || !text.trim()}
          size="lg"
          className="w-full gap-3 h-14"
        >
          <Video className="h-5 w-5" />
          {loading ? "Setting up…" : "Record it"}
        </Button>

        {/* Error */}
        {error && (
          <p className="rounded-control border border-bad/30 bg-bad-soft px-4 py-3 text-meta text-bad-fg">
            {error}
          </p>
        )}

        {/* No "My saved videos" nav (T-1170 §B4): nothing writes to cloud storage
            in the MVP flow, so the entry point is hidden. /videos still exists. */}
      </div>
    </main>
  )
}

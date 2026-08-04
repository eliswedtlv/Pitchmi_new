"use client"

import { Check, Loader2 } from "lucide-react"
import { AdSlot } from "@/components/AdSlot"
import { Button } from "@/components/ui/button"
import { STAGE_LABEL, type EvalStage } from "@/lib/evalStages"
import type { AdConfig } from "@/lib/api"

// Widths reflect ONLY the two honest, state-driven stages. No timer ever
// advances the label past reality — the eval either resolves (→ results) or
// fails (→ error screen); it never sits on a fake "Scoring" step forever.
const STAGE_WIDTH: Record<EvalStage, string> = {
  uploading: "25%",
  analyzing: "70%",
  done: "100%",
  error: "100%",
}

/** The two stages that actually exist, in order. Labels come from the machine. */
const STEPS: EvalStage[] = ["uploading", "analyzing"]

interface WaitViewProps {
  stage: EvalStage
  error: string | null
  ad: AdConfig | null
  onSkipAd: () => void
  onHome: () => void
}

/**
 * The wait screen's markup, split out from `app/wait/page.tsx` (T-10022) so the
 * dev fixture at `/dev/ui/wait` can screenshot the REAL screen without firing a
 * live evaluation. All of the logic — the eval call, the error mapping, the
 * routing, the wake lock — stays in the page; this file draws and nothing else.
 *
 * Shape borrowed from Airtable's "Generating your app…" (the process is the
 * headline, with a hairline bar pinned to the top edge of the viewport rather
 * than floating mid-composition) and Hers' three-step loader (a passed stage
 * keeps its check instead of being replaced by the next label).
 *
 * T-10024 changes three things and no more: the hairline bar and the ACTIVE
 * stage now carry the brand accent (this is the "progress and position" third of
 * the accent rule — the only screen in the product whose entire job is to say
 * "PitchMi is working"), the content block takes the shared `.shell` width so a
 * 1440 viewport is not a 28rem card marooned in the middle of it, and the active
 * row gets a little more air at `lg`. The Airtable-derived pinning, the two real
 * stages and the centred composition are untouched.
 */
export function WaitView({ stage, error, ad, onSkipAd, onHome }: WaitViewProps) {
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 safe-b-8">
        <div className="shell max-w-sm space-y-5 text-center">
          <p className="rounded-panel border border-bad/30 bg-bad-soft px-5 py-4 text-body text-bad-fg">
            {error}
          </p>
          <Button variant="ghost" size="sm" onClick={onHome}>
            Back to home
          </Button>
        </div>
      </main>
    )
  }

  const activeIdx = STEPS.indexOf(stage)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-10 safe-b-8">
      {/* Overall progress, pinned to the very top edge of the viewport. */}
      <div className="fixed inset-x-0 top-0 h-0.5 bg-track">
        <div
          data-testid="wait-progress"
          className="progress-fill h-full bg-accent"
          style={{ width: STAGE_WIDTH[stage] }}
        />
      </div>

      {/* Ad — Skip only hides this element; it never affects the pending eval. */}
      {ad && (
        <div className="w-full max-w-md">
          <AdSlot config={ad} onSkip={onSkipAd} />
        </div>
      )}

      <div className="shell space-y-6 lg:space-y-8">
        <p className="text-micro font-medium uppercase tracking-[0.18em] text-accent text-center">
          PitchMi
        </p>

        {/* The stages stay on screen: a passed one keeps its check, the active
            one spins, a pending one stays dim. The wait is accounted for.
            The ACTIVE row is the screen's headline — there is deliberately no
            separate heading above it, because the only strings available are
            these same stage labels (`lib/evalStages.ts`, untouched) and printing
            one of them twice reads as a stutter, not as hierarchy. */}
        <ol className="space-y-2">
          {STEPS.map((step, i) => {
            const done = activeIdx > i
            const active = activeIdx === i
            return (
              <li
                key={step}
                className={`flex items-center gap-3 rounded-control border transition-colors ${
                  active
                    ? "border-accent bg-accent-soft px-4 py-4 text-lead text-fg lg:py-5"
                    : "border-line bg-surface px-4 py-3 text-meta text-fg-subtle"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-good text-primary-fg" : "border border-line-strong"
                  }`}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  {active && <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-muted" />}
                </span>
                <span className="min-w-0">{STAGE_LABEL[step]}</span>
              </li>
            )
          })}
        </ol>

        <p className="text-micro text-fg-subtle text-center">
          This can take up to two minutes — keep this screen open.
        </p>
      </div>
    </main>
  )
}

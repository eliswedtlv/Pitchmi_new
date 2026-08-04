"use client"

import { Check, Loader2, LockKeyhole } from "lucide-react"
import { Brand } from "@/components/Brand"
import { AdSlot } from "@/components/AdSlot"
import { Button } from "@/components/ui/button"
import { STAGE_LABEL, type EvalStage } from "@/lib/evalStages"
import type { AdConfig } from "@/lib/api"

const STAGE_WIDTH: Record<EvalStage, string> = {
  uploading: "26%",
  analyzing: "72%",
  done: "100%",
  error: "100%",
}

const STEPS: EvalStage[] = ["uploading", "analyzing"]

interface WaitViewProps {
  stage: EvalStage
  error: string | null
  ad: AdConfig | null
  onSkipAd: () => void
  onHome: () => void
}

function VoiceSignal({ paused = false }: { paused?: boolean }) {
  const heights = ["h-8", "h-14", "h-20", "h-12", "h-6"]
  return (
    <div aria-hidden className="flex h-24 items-center justify-center gap-2.5">
      {heights.map((height, index) => (
        <span
          key={index}
          className={`${height} w-2 rounded-full bg-accent ${
            paused ? "opacity-50" : "voice-bar"
          }`}
        />
      ))}
    </div>
  )
}

export function WaitView({ stage, error, ad, onSkipAd, onHome }: WaitViewProps) {
  if (error) {
    return (
      <main className="scheme-dark min-h-screen bg-canvas px-[18px] text-fg safe-b-8 sm:px-8">
        <div className="studio-shell flex min-h-screen flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-line">
            <Brand inverse />
            <span className="text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              Evaluation stopped
            </span>
          </header>
          <div className="flex flex-1 items-center justify-center py-12">
            <section className="w-full max-w-lg text-center">
              <VoiceSignal paused />
              <p className="mt-8 text-micro font-semibold uppercase tracking-[0.16em] text-bad-fg">
                Take not scored
              </p>
              <h1 className="mt-3 text-[clamp(2rem,7vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-fg">
                The booth went quiet.
              </h1>
              <p className="mx-auto mt-5 max-w-md text-body text-fg-muted">{error}</p>
              <Button size="lg" className="mt-8 min-w-48" onClick={onHome}>
                Back to home
              </Button>
            </section>
          </div>
        </div>
      </main>
    )
  }

  const activeIdx = STEPS.indexOf(stage)

  return (
    <main className="scheme-dark min-h-screen bg-canvas px-[18px] text-fg safe-b-8 sm:px-8">
      <div className="fixed inset-x-0 top-0 z-10 h-0.5 bg-track">
        <div
          data-testid="wait-progress"
          className="progress-fill h-full bg-accent"
          style={{ width: STAGE_WIDTH[stage] }}
        />
      </div>

      <div className="studio-shell flex min-h-screen flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line">
          <Brand inverse />
          <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            <LockKeyhole className="h-3.5 w-3.5 text-accent" />
            Processed privately
          </div>
        </header>

        <div
          className={`grid flex-1 items-center gap-10 py-10 ${
            ad ? "lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]" : ""
          }`}
        >
          <section className="mx-auto w-full max-w-2xl">
            <div className="flex items-center gap-3 text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              <span className="nums text-accent">02</span>
              <span className="h-px w-8 bg-line-strong" />
              <span>Analyze the take</span>
            </div>

            <VoiceSignal />

            <div className="text-center">
              <h1 className="text-[clamp(2.5rem,7vw,5.25rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-fg">
                Your take is
                <span className="block text-accent">in the booth.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-lg text-body text-fg-muted">
                We’re matching your words, measuring the rhythm, and watching the
                delivery. This can take up to two minutes.
              </p>
            </div>

            <ol className="mx-auto mt-10 max-w-lg border-y border-line">
              {STEPS.map((step, index) => {
                const done = activeIdx > index
                const active = activeIdx === index
                return (
                  <li
                    key={step}
                    className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-line px-1 py-4 last:border-b-0 ${
                      active ? "text-fg" : "text-fg-subtle"
                    }`}
                  >
                    <span className="nums text-micro font-semibold text-fg-subtle">
                      0{index + 1}
                    </span>
                    <span className={`text-body ${active ? "font-medium" : ""}`}>
                      {STAGE_LABEL[step]}
                    </span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        done
                          ? "bg-good text-primary-fg"
                          : active
                            ? "bg-accent-soft text-accent"
                            : "border border-line-strong"
                      }`}
                    >
                      {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      {active && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {ad && (
            <aside className="mx-auto w-full max-w-md border-t border-line pt-6 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-0">
              <p className="mb-3 text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                While you wait
              </p>
              <AdSlot config={ad} onSkip={onSkipAd} />
            </aside>
          )}
        </div>
      </div>
    </main>
  )
}

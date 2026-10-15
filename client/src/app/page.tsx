"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LockKeyhole, Video } from "lucide-react"
import { Brand } from "@/components/Brand"
import { ConsentForm } from "@/components/ConsentForm"
import { GoogleAuthLink } from "@/components/GoogleAuthLink"
import { LangToggle } from "@/components/LangToggle"
import { Button } from "@/components/ui/button"
import { createProject, saveScript } from "@/lib/api"
import { clearConsent, readConsent } from "@/lib/consent"
import { MAX_TAKE_S } from "@/lib/limits"
import { estimateSeconds, splitAtSeconds } from "@/lib/estimate"
import { resolveDir } from "@/lib/textDir"
import { useSession } from "@/store/session"
import { useUiLang } from "@/hooks/useUiLang"
import { errorText } from "@/lib/i18n"

// Shared by the textarea and the highlight layer behind it. Any divergence
// here — font, size, line-height, padding, letter-spacing — and the amber tail
// stops lining up with the words it is marking, silently. Change it HERE and
// nowhere else, and check it against a script that wraps over four lines.
const TEXT_BOX =
  "px-4 py-4 sm:px-5 sm:py-5 text-[1rem] leading-[1.7] tracking-[-0.01em] whitespace-pre-wrap break-words"

export default function HomePage() {
  const router = useRouter()
  const { lang, t } = useUiLang()
  const { script, setProject, setScript, setPathResult, setRhythmLocked } = useSession()

  // Pre-filled when the user came back via "Edit text" on the results screen.
  const [text, setText] = useState(script)
  const [loading, setLoading] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)

  const seconds = estimateSeconds(text)
  const overBy = Math.round(seconds - MAX_TAKE_S)
  const isOver = seconds > MAX_TAKE_S
  const { head, tail } = splitAtSeconds(text, MAX_TAKE_S)
  // Hebrew right-aligns as it is typed; the language is not known yet, so the
  // content itself decides (T-1164).
  const dir = resolveDir(null, text)

  async function beginRehearsal() {
    setLoading(true)
    setError(null)
    try {
      const project = await createProject()
      setProject(project)
      // New words, no rhythm yet (KP-B): take 1 is a teleprompter take, and
      // the first take that matches the script sets the rhythm.
      await saveScript(project.id, text)
      setScript(text)
      setPathResult(null)
      setRhythmLocked(false)
      router.push("/karaoke")
    } catch (e) {
      const apiError = e as Error & { body?: { error?: string } }
      if (apiError.body?.error === "consent_required") {
        // localStorage can outlive a rotated/cleared anonymous Supabase
        // session. The new identity needs its own server-side receipt.
        clearConsent()
        setShowConsent(true)
        setError(null)
      } else {
        setError(errorText(apiError, lang))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleStart() {
    if (!readConsent()) {
      setShowConsent(true)
      setError(null)
      return
    }
    void beginRehearsal()
  }

  async function handleConsentAccepted() {
    setShowConsent(false)
    await beginRehearsal()
  }

  return (
    <main className="min-h-screen px-[18px] safe-b-4 sm:px-8">
      <div className="studio-shell flex min-h-[calc(100svh-1rem)] flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line">
          <Brand />
          <div className="flex items-center gap-4 sm:gap-5">
            <GoogleAuthLink />
            <Link
              href="/privacy"
              className="flex items-center gap-2 text-micro font-medium uppercase tracking-[0.12em] text-fg-muted transition-colors hover:text-fg"
            >
              <LockKeyhole className="h-3.5 w-3.5 text-accent" aria-hidden />
              <span className="hidden sm:inline">{t.privateByDefault}</span>
              <span className="sm:hidden">{t.privateShort}</span>
            </Link>
            <LangToggle />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 py-5 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(34rem,1.22fr)] lg:gap-14 lg:py-10">
          <section className="flex flex-col justify-between gap-5 lg:py-3">
            <div className="space-y-4 lg:space-y-6">
              <div className="flex items-center gap-3 text-micro font-medium uppercase tracking-[0.16em] text-fg-subtle">
                <span className="nums text-accent">01</span>
                <span className="h-px w-8 bg-line-strong" />
                <span>{t.stepWrite}</span>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-[11ch] text-[clamp(2.7rem,6vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-fg text-balance">
                  {t.heroLine1}
                  <span className="block text-accent">{t.heroLine2}</span>
                </h1>
                <p className="max-w-md text-body text-fg-muted lg:text-lead">
                  <span className="block font-semibold text-fg">{t.tagline}</span>
                  {t.heroBody}
                </p>
              </div>
            </div>

            <div className="hidden grid-cols-3 border-y border-line py-4 lg:grid">
              {[
                [t.factMinutes, t.factMinutesLabel],
                [t.factNoLogin, t.factNoLoginLabel],
                [t.factPrivacy, t.factPrivacyLabel],
              ].map(([value, label]) => (
                <div key={value} className="border-e border-line pe-4 last:border-0 [&+&]:ps-4">
                  <p className="text-meta font-semibold text-fg">{value}</p>
                  <p className="mt-0.5 text-micro text-fg-subtle">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex min-h-[30rem] flex-col overflow-hidden rounded-panel border border-line-strong bg-surface shadow-[0_18px_60px_rgba(16,17,19,0.08)] transition-colors focus-within:border-accent dark:shadow-none">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-micro font-semibold uppercase tracking-[0.16em] text-fg">
                  {t.scriptLabel}
                </span>
              </div>
              <span className="nums text-micro font-medium uppercase tracking-[0.12em] text-fg-subtle">
                {t.secMax(MAX_TAKE_S)}
              </span>
            </div>

            {showConsent ? (
              <div className="flex-1 bg-raised/45 p-3">
                <ConsentForm
                  onAccepted={handleConsentAccepted}
                  onCancel={() => setShowConsent(false)}
                />
              </div>
            ) : (
              <>
                {/* Textarea and over-length mirror remain exact geometric twins. */}
                <div className="relative min-h-0 flex-1">
                  {isOver && (
                    <div
                      ref={mirrorRef}
                      aria-hidden
                      dir={dir}
                      className={`pointer-events-none absolute inset-0 overflow-hidden border border-transparent ${TEXT_BOX}`}
                    >
                      <span className="text-transparent">{head}</span>
                      <span
                        data-testid="over-length-tail"
                        className="rounded bg-warn-soft text-transparent"
                      >
                        {tail}
                      </span>
                    </div>
                  )}
                  <textarea
                    aria-label={t.scriptAria}
                    dir={dir}
                    rows={8}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onScroll={(e) => {
                      if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop
                    }}
                    placeholder={t.scriptPlaceholder}
                    className={`absolute inset-0 resize-none border border-transparent bg-transparent text-fg placeholder:text-fg-subtle focus:outline-none ${TEXT_BOX}`}
                  />
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 sm:px-5">
                  <span
                    className={`nums text-meta font-medium ${
                      isOver ? "text-warn-fg" : "text-fg"
                    }`}
                  >
                    {isOver ? t.overBy(overBy) : t.estimate(Math.round(seconds))}
                  </span>
                  <span className="text-micro text-fg-subtle text-end">
                    {t.estimateNote}
                  </span>
                </div>

                <div className="shrink-0 border-t border-line bg-raised/45 p-3">
                  <Button
                    onClick={handleStart}
                    disabled={loading || !text.trim()}
                    size="lg"
                    className="h-12 w-full gap-3 shadow-[0_6px_20px_rgba(23,70,255,0.22)]"
                  >
                    <Video className="h-4.5 w-4.5" />
                    {loading ? t.settingUp : t.recordIt}
                  </Button>
                  {error && (
                    <p className="mt-3 rounded-control border border-bad/30 bg-bad-soft px-4 py-3 text-meta text-bad-fg">
                      {error}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-line py-3 text-micro text-fg-subtle lg:hidden">
          <span>{t.footerLimits}</span>
          <Link href="/privacy" className="font-medium hover:text-fg">{t.footerPrivacy}</Link>
        </div>
      </div>
    </main>
  )
}

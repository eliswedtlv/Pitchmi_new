import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, LockKeyhole } from "lucide-react"
import { Brand } from "@/components/Brand"
import { DeleteMyData } from "@/components/DeleteMyData"

export const metadata: Metadata = {
  title: "Privacy & consent — PitchMi",
  description: "How PitchMi processes scripts, recordings and anonymous session data.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-[18px] safe-b-8 sm:px-8">
      <div className="shell-wide py-5 sm:py-8">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-meta font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Home
          </Link>
        </header>

        <article className="mx-auto max-w-3xl py-10 sm:py-16">
          <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.16em] text-accent">
            <LockKeyhole className="h-4 w-4" aria-hidden />
            Privacy notice · August 5, 2026
          </div>
          <h1 className="mt-5 text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-fg">
            Your take is yours.
          </h1>
          <p className="mt-5 max-w-2xl text-lead leading-relaxed text-fg-muted">
            PitchMi has no public profile and no conventional login. A private,
            anonymous identity in this browser keeps your rehearsal working.
          </p>

          <div className="mt-10 grid gap-8 border-t border-line pt-8">
            <section>
              <h2 className="text-lead font-semibold text-fg">What we process</h2>
              <ul className="mt-3 list-disc space-y-2 ps-5 text-body leading-relaxed text-fg-muted">
                <li>Your script is stored in a private project tied to this browser&apos;s anonymous identity.</li>
                <li>
                  Your recording is sent securely to U.S.-based service providers for speech
                  transcription and AI delivery analysis.
                </li>
                <li>
                  PitchMi keeps numeric scores, timing/cost diagnostics and a versioned consent
                  receipt. The receipt contains no typed name, script, transcript, video or audio.
                </li>
                <li>
                  If you explicitly choose to save a take, that recording is stored privately
                  for this anonymous identity until you delete it or erase all data below.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lead font-semibold text-fg">What we do not keep</h2>
              <p className="mt-3 text-body leading-relaxed text-fg-muted">
                In the normal rehearsal flow, PitchMi does not write your raw take to cloud
                storage unless you explicitly save it. Otherwise, video and temporary audio
                files are discarded after the request. Third-party processing is also governed
                by each provider&apos;s terms and the retention settings configured for those
                services.
              </p>
            </section>

            <section>
              <h2 className="text-lead font-semibold text-fg">Consent and control</h2>
              <p className="mt-3 text-body leading-relaxed text-fg-muted">
                Before the first recording, you provide a name or initials and explicitly agree
                to camera, microphone and AI processing. That typed acknowledgement remains only
                on this device; the server records the anonymous consent version and timestamp.
                A material change to this notice requires consent again.
              </p>
            </section>

            <DeleteMyData />
          </div>
        </article>
      </div>
    </main>
  )
}

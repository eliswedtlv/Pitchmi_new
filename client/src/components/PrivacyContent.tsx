"use client"

import Link from "next/link"
import { ArrowLeft, LockKeyhole } from "lucide-react"
import { Brand } from "@/components/Brand"
import { DeleteMyData } from "@/components/DeleteMyData"
import { LangToggle } from "@/components/LangToggle"
import { useUiLang } from "@/hooks/useUiLang"
import { GOOGLE_AUTH_ENABLED } from "@/lib/featureFlags"

// The privacy notice body (KP-D): a client component so it follows the UI
// language; the page keeps the (English) metadata.
export function PrivacyContent() {
  const { t } = useUiLang()
  return (
    <main className="min-h-screen px-[18px] safe-b-8 sm:px-8">
      <div className="shell-wide py-5 sm:py-8">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Brand />
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-meta font-medium text-fg-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t.home}
            </Link>
            <LangToggle />
          </div>
        </header>

        <article className="mx-auto max-w-3xl py-10 sm:py-16">
          <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.16em] text-accent">
            <LockKeyhole className="h-4 w-4" aria-hidden />
            {t.privacyKicker}
          </div>
          <h1 className="mt-5 text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-fg">
            {t.privacyTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-lead leading-relaxed text-fg-muted">
            {t.privacyIntro}
          </p>

          <div className="mt-10 grid gap-8 border-t border-line pt-8">
            <section>
              <h2 className="text-lead font-semibold text-fg">{t.privacyProcessTitle}</h2>
              <ul className="mt-3 list-disc space-y-2 ps-5 text-body leading-relaxed text-fg-muted">
                {t.privacyProcess.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-lead font-semibold text-fg">{t.privacyKeepTitle}</h2>
              <p className="mt-3 text-body leading-relaxed text-fg-muted">
                {t.privacyKeep}
              </p>
            </section>

            <section>
              <h2 className="text-lead font-semibold text-fg">{t.privacyConsentTitle}</h2>
              <p className="mt-3 text-body leading-relaxed text-fg-muted">
                {t.privacyConsent}
              </p>
            </section>

            {GOOGLE_AUTH_ENABLED ? (
              <section>
                <h2 className="text-lead font-semibold text-fg">{t.privacyAccountTitle}</h2>
                <p className="mt-3 text-body leading-relaxed text-fg-muted">
                  {t.privacyAccount}
                </p>
              </section>
            ) : null}

            <DeleteMyData />
          </div>
        </article>
      </div>
    </main>
  )
}

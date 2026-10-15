"use client"

import Link from "next/link"
import { ArrowLeft, Cloud } from "lucide-react"
import { AccountPanel } from "@/components/AccountPanel"
import { Brand } from "@/components/Brand"
import { LangToggle } from "@/components/LangToggle"
import { useUiLang } from "@/hooks/useUiLang"

// The /account body (KP-D): a client component so it follows the UI language.
export function AccountContent() {
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

        <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] lg:items-start lg:gap-16 lg:py-16">
          <section className="lg:pt-3">
            <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.16em] text-accent">
              <Cloud className="h-4 w-4" aria-hidden />
              {t.accountKicker}
            </div>
            <h1 className="mt-5 max-w-[10ch] text-[clamp(2.7rem,7vw,5rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-fg">
              {t.accountTitle}
            </h1>
            <p className="mt-5 max-w-lg text-lead leading-relaxed text-fg-muted">
              {t.accountBody}
            </p>
            <div className="mt-8 grid grid-cols-2 border-y border-line py-4 text-meta">
              <div className="border-e border-line pe-4">
                <p className="font-semibold text-fg">{t.sameUserId}</p>
                <p className="mt-1 text-fg-muted">{t.sameUserIdBody}</p>
              </div>
              <div className="ps-4">
                <p className="font-semibold text-fg">{t.noExtraAccess}</p>
                <p className="mt-1 text-fg-muted">{t.noExtraAccessBody}</p>
              </div>
            </div>
          </section>

          <AccountPanel />
        </div>

        <footer className="border-t border-line pt-5 text-meta text-fg-muted">
          {t.accountFooterBefore}{" "}
          <Link href="/privacy" className="font-medium text-fg hover:text-accent">
            {t.accountFooterLink}
          </Link>{" "}
          {t.accountFooterAfter}
        </footer>
      </div>
    </main>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Cloud } from "lucide-react"
import { AccountPanel } from "@/components/AccountPanel"
import { Brand } from "@/components/Brand"
import { GOOGLE_AUTH_ENABLED } from "@/lib/featureFlags"

export const metadata: Metadata = {
  title: "Account — PitchMi",
  description: "Optionally save your PitchMi identity across devices.",
}

export default function AccountPage() {
  if (!GOOGLE_AUTH_ENABLED) notFound()

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

        <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] lg:items-start lg:gap-16 lg:py-16">
          <section className="lg:pt-3">
            <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.16em] text-accent">
              <Cloud className="h-4 w-4" aria-hidden />
              Account · optional
            </div>
            <h1 className="mt-5 max-w-[10ch] text-[clamp(2.7rem,7vw,5rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-fg">
              Start private. Stay connected.
            </h1>
            <p className="mt-5 max-w-lg text-lead leading-relaxed text-fg-muted">
              PitchMi works without a login. Connect Google only if you want the same private
              identity and projects on another device.
            </p>
            <div className="mt-8 grid grid-cols-2 border-y border-line py-4 text-meta">
              <div className="border-e border-line pe-4">
                <p className="font-semibold text-fg">Same user ID</p>
                <p className="mt-1 text-fg-muted">Current work stays attached.</p>
              </div>
              <div className="ps-4">
                <p className="font-semibold text-fg">No extra access</p>
                <p className="mt-1 text-fg-muted">No Drive or contacts permission.</p>
              </div>
            </div>
          </section>

          <AccountPanel />
        </div>

        <footer className="border-t border-line pt-5 text-meta text-fg-muted">
          Account connection is optional. Read the{" "}
          <Link href="/privacy" className="font-medium text-fg hover:text-accent">
            privacy notice
          </Link>{" "}
          or keep using PitchMi anonymously.
        </footer>
      </div>
    </main>
  )
}

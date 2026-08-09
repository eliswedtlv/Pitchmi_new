"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, LoaderCircle, TriangleAlert } from "lucide-react"
import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"
import { callbackErrorCode, getCurrentAccount, safeNextPath } from "@/lib/googleAuth"

type CompletionState =
  | { kind: "loading"; next: string }
  | { kind: "success"; next: string }
  | { kind: "conflict"; next: string }
  | { kind: "error"; next: string }

export function AuthComplete() {
  const [state, setState] = useState<CompletionState>({ kind: "loading", next: "/account" })

  useEffect(() => {
    let active = true
    const url = new URL(window.location.href)
    const next = safeNextPath(url.searchParams.get("next"))
    const callbackError = callbackErrorCode(url.toString())

    if (callbackError) {
      const normalizedError = callbackError.toLowerCase()
      const isConflict =
        normalizedError.includes("identity") || normalizedError.includes("already")
      setState({ kind: isConflict ? "conflict" : "error", next })
      return () => {
        active = false
      }
    }

    getCurrentAccount()
      .then((account) => {
        if (!active) return
        setState({ kind: account.kind === "permanent" ? "success" : "error", next })
      })
      .catch(() => {
        if (active) setState({ kind: "error", next })
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="min-h-screen px-[18px] safe-b-8 sm:px-8">
      <div className="shell flex min-h-screen flex-col py-5 sm:py-8">
        <header className="border-b border-line pb-5">
          <Brand />
        </header>

        <div className="grid flex-1 place-items-center py-12">
          <section className="w-full rounded-panel border border-line-strong bg-surface p-6 text-center sm:p-8">
            {state.kind === "loading" ? (
              <>
                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-accent" aria-hidden />
                <h1 className="mt-5 text-title font-semibold tracking-[-0.04em] text-fg">
                  Securing your studio…
                </h1>
                <p className="mt-2 text-meta text-fg-muted">Confirming the identity connection.</p>
              </>
            ) : null}

            {state.kind === "success" ? (
              <>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-good-soft text-good-fg">
                  <Check className="h-5 w-5" aria-hidden />
                </span>
                <h1 className="mt-5 text-title font-semibold tracking-[-0.04em] text-fg">
                  Your studio is saved.
                </h1>
                <p className="mt-2 text-meta leading-relaxed text-fg-muted">
                  Use the same Google account to reopen this PitchMi identity on another device.
                </p>
                <Button
                  className="mt-6 w-full"
                  onClick={() => window.location.assign(state.next)}
                >
                  Continue to PitchMi
                </Button>
              </>
            ) : null}

            {state.kind === "conflict" ? (
              <>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-warn-soft text-warn-fg">
                  <TriangleAlert className="h-5 w-5" aria-hidden />
                </span>
                <h1 className="mt-5 text-title font-semibold tracking-[-0.04em] text-fg">
                  That account is already connected.
                </h1>
                <p className="mt-2 text-meta leading-relaxed text-fg-muted">
                  Return to Account and choose “Sign in instead” to open the existing studio.
                </p>
                <Link href="/account" className="mt-6 inline-flex text-meta font-semibold text-accent">
                  Return to Account
                </Link>
              </>
            ) : null}

            {state.kind === "error" ? (
              <>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-bad-soft text-bad-fg">
                  <TriangleAlert className="h-5 w-5" aria-hidden />
                </span>
                <h1 className="mt-5 text-title font-semibold tracking-[-0.04em] text-fg">
                  Google could not be connected.
                </h1>
                <p className="mt-2 text-meta leading-relaxed text-fg-muted">
                  No PitchMi data was changed. Return to Account and try again.
                </p>
                <Link href="/account" className="mt-6 inline-flex text-meta font-semibold text-accent">
                  Return to Account
                </Link>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

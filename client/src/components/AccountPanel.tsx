"use client"

import { useEffect, useState } from "react"
import { Check, Cloud, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  type AccountState,
  getCurrentAccount,
  signOutCurrentDevice,
  startGoogleSignIn,
  startGoogleUpgrade,
} from "@/lib/googleAuth"
import { useUiLang } from "@/hooks/useUiLang"

type PanelState = AccountState | { kind: "loading" } | { kind: "error" }
type PendingAction = "upgrade" | "signin" | "signout" | null

export function AccountPanel() {
  const { t } = useUiLang()
  const [account, setAccount] = useState<PanelState>({ kind: "loading" })
  const [pending, setPending] = useState<PendingAction>(null)
  const [showSignInWarning, setShowSignInWarning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getCurrentAccount()
      .then((next) => {
        if (active) setAccount(next)
      })
      .catch(() => {
        if (active) {
          setAccount({ kind: "error" })
        }
      })
    return () => {
      active = false
    }
  }, [])

  async function handleUpgrade() {
    setPending("upgrade")
    setActionError(null)
    try {
      await startGoogleUpgrade("/account")
    } catch {
      setActionError(t.upgradeFailed)
      setPending(null)
    }
  }

  async function handleSignIn() {
    setPending("signin")
    setActionError(null)
    try {
      await startGoogleSignIn("/account")
    } catch {
      setActionError(t.signInFailed)
      setPending(null)
    }
  }

  async function handleSignOut() {
    setPending("signout")
    setActionError(null)
    try {
      await signOutCurrentDevice()
      setAccount({ kind: "guest" })
    } catch {
      setActionError(t.signOutFailed)
    } finally {
      setPending(null)
    }
  }

  if (account.kind === "loading") {
    return (
      <section
        className="rounded-panel border border-line-strong bg-surface p-5 sm:p-6"
        aria-busy="true"
        aria-label={t.loadingAccount}
      >
        <div className="h-3 w-24 animate-pulse rounded-full bg-track" />
        <div className="mt-5 h-8 w-2/3 animate-pulse rounded-control bg-track" />
        <div className="mt-3 h-16 animate-pulse rounded-control bg-raised" />
      </section>
    )
  }

  if (account.kind === "error") {
    return (
      <section className="rounded-panel border border-bad/30 bg-bad-soft p-5 sm:p-6">
        <p className="font-semibold text-bad-fg">{t.sessionUnavailable}</p>
        <p className="mt-2 text-meta text-fg-muted">{t.sessionUnreadable} {t.refreshTryAgain}</p>
      </section>
    )
  }

  if (account.kind === "permanent") {
    const identity = account.name ?? account.email ?? t.googleAccount
    return (
      <section className="overflow-hidden rounded-panel border border-good/30 bg-surface">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-good-fg">
            <Check className="h-4 w-4" aria-hidden />
            {t.savedIdentity}
          </div>
          <h2 className="mt-4 text-title font-semibold tracking-[-0.04em] text-fg">
            {t.studioTravels}
          </h2>
          <p className="mt-2 text-meta leading-relaxed text-fg-muted">
            {t.connectedAs} <span className="font-semibold text-fg">{identity}</span>
            {t.connectedAsAfter}
          </p>
        </div>
        <div className="border-t border-line bg-raised/45 p-3">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleSignOut}
            disabled={pending !== null}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {pending === "signout" ? t.signingOut : t.signOut}
          </Button>
          {actionError ? (
            <p role="alert" className="mt-3 text-meta text-bad-fg">
              {actionError}
            </p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-panel border border-accent/30 bg-surface">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-accent">
          <Cloud className="h-4 w-4" aria-hidden />
          {t.optionalUpgrade}
        </div>
        <h2 className="mt-4 text-title font-semibold tracking-[-0.04em] text-fg">
          {t.sameStudio}
        </h2>
        <p className="mt-2 text-meta leading-relaxed text-fg-muted">
          {t.upgradeBody}
        </p>
      </div>

      <div className="border-t border-line bg-raised/45 p-3">
        <Button
          size="lg"
          className="h-12 w-full"
          onClick={handleUpgrade}
          disabled={pending !== null}
        >
          {pending === "upgrade" ? t.openingGoogle : t.saveWithGoogle}
        </Button>

        {showSignInWarning ? (
          <div className="mt-3 rounded-control border border-warn/30 bg-warn-soft p-4">
            <p className="text-meta font-semibold text-warn-fg">{t.switchTitle}</p>
            <p className="mt-1 text-meta leading-relaxed text-fg-muted">
              {t.switchBody}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowSignInWarning(false)}
                disabled={pending !== null}
              >
                {t.cancel}
              </Button>
              <Button
                variant="outline"
                onClick={handleSignIn}
                disabled={pending !== null}
              >
                {pending === "signin" ? t.opening : t.switchAndSignIn}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 w-full rounded-control py-2 text-meta font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setShowSignInWarning(true)}
          >
            {t.signInInstead}
          </button>
        )}

        {actionError ? (
          <p role="alert" className="mt-3 text-meta text-bad-fg">
            {actionError}
          </p>
        ) : null}
      </div>
    </section>
  )
}

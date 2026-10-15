"use client"

import { useState } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteMyData } from "@/lib/api"
import { clearConsent } from "@/lib/consent"
import { getSupabaseClient } from "@/lib/supabase"
import { errorText } from "@/lib/i18n"
import { useUiLang } from "@/hooks/useUiLang"

export function DeleteMyData() {
  const { lang, t } = useUiLang()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteMyData()
      clearConsent()
      await getSupabaseClient()?.auth.signOut({ scope: "local" })
      setDeleted(true)
    } catch (cause) {
      setError(errorText(cause, lang, t.deleteFailed))
    } finally {
      setDeleting(false)
    }
  }

  if (deleted) {
    return (
      <div className="rounded-panel border border-good/30 bg-good-soft p-5">
        <p className="font-semibold text-good-fg">{t.deletedTitle}</p>
        <p className="mt-1 text-meta text-fg-muted">
          {t.deletedBody}
        </p>
        <Link href="/" className="mt-4 inline-flex text-meta font-semibold text-accent">
          {t.returnHome}
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-panel border border-line bg-surface p-5">
      <h2 className="text-lead font-semibold text-fg">{t.deleteTitle}</h2>
      <p className="mt-2 text-meta leading-relaxed text-fg-muted">
        {t.deleteBody}
      </p>

      {confirming ? (
        <div className="mt-4 rounded-control border border-bad/30 bg-bad-soft p-4">
          <p className="text-meta font-medium text-bad-fg">
            {t.deleteConfirm}
          </p>
          {error && <p role="alert" className="mt-2 text-meta text-bad-fg">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {deleting ? t.deleting : t.deletePermanently}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              {t.keepMyData}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4 gap-2" onClick={() => setConfirming(true)}>
          <Trash2 className="h-4 w-4" aria-hidden />
          {t.deleteMyData}
        </Button>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import { Cloud } from "lucide-react"
import { GOOGLE_AUTH_ENABLED } from "@/lib/featureFlags"
import { useUiLang } from "@/hooks/useUiLang"

export function GoogleAuthLink() {
  const { t } = useUiLang()
  if (!GOOGLE_AUTH_ENABLED) return null

  return (
    <Link
      href="/account"
      className="flex items-center gap-2 text-micro font-medium uppercase tracking-[0.12em] text-fg-muted transition-colors hover:text-fg"
    >
      <Cloud className="h-3.5 w-3.5 text-accent" aria-hidden />
      <span className="hidden sm:inline">{t.saveAcrossDevices}</span>
      <span className="sm:hidden">{t.saveShort}</span>
    </Link>
  )
}

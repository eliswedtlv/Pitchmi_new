import Link from "next/link"
import { Cloud } from "lucide-react"
import { GOOGLE_AUTH_ENABLED } from "@/lib/featureFlags"

export function GoogleAuthLink() {
  if (!GOOGLE_AUTH_ENABLED) return null

  return (
    <Link
      href="/account"
      className="flex items-center gap-2 text-micro font-medium uppercase tracking-[0.12em] text-fg-muted transition-colors hover:text-fg"
    >
      <Cloud className="h-3.5 w-3.5 text-accent" aria-hidden />
      <span className="hidden sm:inline">Save across devices</span>
      <span className="sm:hidden">Save</span>
    </Link>
  )
}

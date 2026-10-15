import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AccountContent } from "@/components/AccountContent"
import { GOOGLE_AUTH_ENABLED } from "@/lib/featureFlags"

export const metadata: Metadata = {
  title: "Account",
  description: "Optionally save your KillerPitch identity across devices.",
}

export default function AccountPage() {
  if (!GOOGLE_AUTH_ENABLED) notFound()

  return <AccountContent />
}

import type { Metadata } from "next"
import { AuthComplete } from "@/components/AuthComplete"

export const metadata: Metadata = {
  title: "Connecting account",
  robots: { index: false, follow: false },
}

export default function AuthCompletePage() {
  return <AuthComplete />
}

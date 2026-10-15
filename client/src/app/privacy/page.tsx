import type { Metadata } from "next"
import { PrivacyContent } from "@/components/PrivacyContent"

export const metadata: Metadata = {
  title: "Privacy & consent",
  description: "How KillerPitch processes scripts, recordings and private session data.",
}

export default function PrivacyPage() {
  return <PrivacyContent />
}

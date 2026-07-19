import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PitchMi — Improve Your Spoken Video",
  description: "Record, transcribe, and perfect your spoken video with AI coaching.",
}

// viewport-fit=cover lets content extend under the iOS home indicator so we can
// reclaim that space with env(safe-area-inset-*) padding on bottom CTAs.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}

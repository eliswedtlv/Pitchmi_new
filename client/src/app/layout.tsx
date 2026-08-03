import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PitchMi — Improve Your Spoken Video",
  description:
    "If you can’t say it in 30 seconds, don’t say it. Rehearse to a teleprompter of your own words and get AI delivery coaching.",
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

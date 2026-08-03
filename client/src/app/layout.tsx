import type { Metadata, Viewport } from "next"
import { Inter, Heebo } from "next/font/google"
import "./globals.css"

// Two families, one stack (T-10022). Inter has NO Hebrew coverage, and Hebrew is
// first-class here (T-1164) — on its own it would drop every Hebrew screen into
// an unstyled system fallback mid-sentence. Heebo sits immediately behind it and
// picks up exactly those glyphs. Both are self-hosted by next/font at build time
// and subset to the one script each is here for.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})
const heebo = Heebo({
  subsets: ["hebrew"],
  variable: "--font-heebo",
  display: "swap",
})

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
    <html lang="en" className={`${inter.variable} ${heebo.variable}`}>
      <body className="min-h-screen bg-canvas text-fg text-body antialiased">
        {children}
      </body>
    </html>
  )
}

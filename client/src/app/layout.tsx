import type { Metadata, Viewport } from "next"
import { Instrument_Sans, Heebo } from "next/font/google"
import "./globals.css"

// Instrument Sans gives the Latin product surface a more authored, editorial
// voice than the old default Inter stack. Hebrew remains first-class: Heebo sits
// immediately behind it and picks up those glyphs without changing the layout
// contract of mixed-script lines.
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
})
const heebo = Heebo({
  subsets: ["hebrew"],
  variable: "--font-heebo",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PitchMi — Say it like you mean it",
  description:
    "A private rehearsal studio for 30-second videos. Follow your own script, improve your delivery, and try the next take at your pace.",
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
    <html lang="en" className={`${instrument.variable} ${heebo.variable}`}>
      <body className="min-h-screen bg-canvas text-fg text-body antialiased">
        {children}
      </body>
    </html>
  )
}

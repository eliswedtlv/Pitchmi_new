import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PitchMi — Improve Your Spoken Video",
  description: "Record, transcribe, and perfect your spoken video with AI coaching.",
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

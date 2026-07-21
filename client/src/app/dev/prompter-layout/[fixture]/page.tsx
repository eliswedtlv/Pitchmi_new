"use client"

// Dev-only harness for the RTL layout proof (T-1163 §A). Renders the REAL
// Prompter with a Hebrew or English fixture so a headless Chromium can measure
// word x-positions via getBoundingClientRect. Not linked from the product UI.

import { useParams } from "next/navigation"
import { Prompter } from "@/components/Prompter"
import type { KaraokeWord } from "@/lib/clock"

const FIXTURES: Record<string, { text: string; dir: "ltr" | "rtl"; lang: string }> = {
  he: { text: "היי אני רוצה להציג לכם את PitchMi היום", dir: "rtl", lang: "he" },
  en: { text: "hi I want to present PitchMi to you today", dir: "ltr", lang: "en" },
}

export default function PrompterLayoutFixture() {
  const { fixture } = useParams<{ fixture: string }>()
  const conf = FIXTURES[fixture] ?? FIXTURES.en

  const parts = conf.text.split(" ")
  const words: KaraokeWord[] = parts.map((w, i) => ({ w, t_start: i, t_end: i + 0.9, line: 0 }))
  const lines = [{ index: 0, text: conf.text }]
  const activeIdx = Math.floor(parts.length / 2) // active line = the large one

  return (
    <div style={{ position: "relative", width: 1500, height: 400, background: "#111" }}>
      <Prompter
        words={words}
        lines={lines}
        activeIdx={activeIdx}
        dir={conf.dir}
        lang={conf.lang}
        phase="recording"
      />
    </div>
  )
}

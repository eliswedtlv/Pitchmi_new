"use client"

// Dev-only harness for the UI screenshot pass (T-10022). Renders the REAL
// /results and /wait screens against a fixed fixture so a headless Chromium can
// shoot them at both viewports in both colour schemes without a live backend.
// Same precedent as /dev/prompter-layout/[fixture] (T-1163). Not linked from the
// product UI.
//
// `/` needs no fixture (it renders from nothing) and /karaoke needs a camera, so
// neither has an entry here — karaoke is checked by hand.

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import ResultsPage from "@/app/results/page"
import { WaitView } from "@/components/WaitView"
import { useSession } from "@/store/session"

const PATH = {
  words: [{ w: "fixture", t_start: 0, t_end: 0.5, line: 0 }],
  lines: [{ index: 0, text: "fixture", t_start: 0, t_end: 0.5 }],
  total_s: 0.5,
}

function ResultsFixture() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // The take blob is a stand-in: the screenshot is of the layout, not of a
    // decodable video, so the player renders as its black slot.
    const blob = new Blob(["fixture"], { type: "video/webm" })
    useSession.getState().setTakeBlob(blob)
    useSession.setState({
      project: {
        id: "fixture",
        user_id: "fixture",
        title: "Fixture",
        use_case: "pitch",
        language: "en",
        speed: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      pathResult: { path: PATH, fits: true, est_duration_s: 0.5 },
      takeRhythm: "new",
    })
    setReady(true)
  }, [])

  if (!ready) return null
  return <ResultsPage />
}

export default function UiFixture() {
  const { screen } = useParams<{ screen: string }>()

  switch (screen) {
    case "results":
      return <ResultsFixture />
    case "wait":
      return (
        <WaitView stage="learning" error={null} ad={null} onSkipAd={() => {}} onHome={() => {}} />
      )
    case "wait-error":
      return (
        <WaitView
          stage="error"
          error="Network error"
          ad={null}
          onSkipAd={() => {}}
          onHome={() => {}}
        />
      )
    default:
      return <p className="p-8 text-body text-fg-muted">Unknown fixture: {screen}</p>
  }
}

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

const EVAL = {
  overall: 74,
  dimensions: { voice: 81, body: 66, delivery: 78, timing: 92, accuracy: 54 },
  comments: [
    "Your opening line is buried — lead with it.",
    "You rushed the middle third. Let the numbers land.",
    "Hands stayed low the whole take. Use them.",
  ],
  flags: [{ type: "rushed_line", line: 2 }, { type: "long_pause" }],
  language: "en",
  evals_left_today: 21,
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
      evalResult: EVAL,
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
        <WaitView stage="analyzing" error={null} ad={null} onSkipAd={() => {}} onHome={() => {}} />
      )
    case "wait-error":
      return (
        <WaitView
          stage="error"
          error="The AI took too long — try again."
          ad={null}
          onSkipAd={() => {}}
          onHome={() => {}}
        />
      )
    default:
      return <p className="p-8 text-body text-fg-muted">Unknown fixture: {screen}</p>
  }
}

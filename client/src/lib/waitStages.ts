/**
 * Wait-screen stage machine. State-driven, never clock-driven.
 *
 * The old wait screen advanced labels on a timer that lied about actual
 * progress — it showed "Scoring your delivery" while the request had, in fact,
 * never reached the server (T-1160 XHR bug). This machine only ever advances on
 * a real event, and never surfaces a post-response label ("done"/"error")
 * before the server has actually responded or failed. Labels live in
 * `strings.ts` (`waitStageLabel`) so Hebrew gets its own copy.
 */

export type WaitStage = "uploading" | "learning" | "done" | "error"

/** Real events the transport reports — never a clock. */
export type WaitEvent = "sent" | "response" | "fail"

/** A stage that only exists once the server has responded (or the request died). */
export function isPostResponse(stage: WaitStage): boolean {
  return stage === "done" || stage === "error"
}

/**
 * Advance the stage given a real event. The only pre-response progression is
 * uploading → learning (on "sent", i.e. the request is in flight). "done" and
 * "error" are reachable ONLY via "response"/"fail" — never by advancing time.
 */
export function nextStage(current: WaitStage, event: WaitEvent): WaitStage {
  if (isPostResponse(current)) return current // terminal
  switch (event) {
    case "fail":
      return "error"
    case "response":
      return "done"
    case "sent":
      return current === "uploading" ? "learning" : current
  }
}

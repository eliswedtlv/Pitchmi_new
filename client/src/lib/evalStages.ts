/**
 * Evaluate wait-screen stage machine. State-driven, never clock-driven.
 *
 * The old wait screen advanced labels on a timer ("Transcribing…", "Scoring…")
 * that lied about actual progress — it showed "Scoring your delivery" while the
 * request had, in fact, never reached the server (T-1160 XHR bug). This machine
 * only ever advances on a real event, and never surfaces a post-response label
 * ("done"/"error") before the server has actually responded or failed.
 */

export type EvalStage = "uploading" | "analyzing" | "done" | "error"

/** Real events the transport reports — never a clock. */
export type EvalEvent = "sent" | "response" | "fail"

export const STAGE_LABEL: Record<EvalStage, string> = {
  uploading: "Uploading your take…",
  analyzing: "Analyzing your take… (can take ~2 minutes)",
  done: "Done",
  error: "Something went wrong",
}

/** A stage that only exists once the server has responded (or the request died). */
export function isPostResponse(stage: EvalStage): boolean {
  return stage === "done" || stage === "error"
}

/**
 * Advance the stage given a real event. The only pre-response progression is
 * uploading → analyzing (on "sent", i.e. the request is in flight). "done" and
 * "error" are reachable ONLY via "response"/"fail" — never by advancing time.
 */
export function nextStage(current: EvalStage, event: EvalEvent): EvalStage {
  if (isPostResponse(current)) return current // terminal
  switch (event) {
    case "fail":
      return "error"
    case "response":
      return "done"
    case "sent":
      return current === "uploading" ? "analyzing" : current
  }
}

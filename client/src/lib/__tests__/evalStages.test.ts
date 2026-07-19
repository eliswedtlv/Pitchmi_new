import { describe, it, expect } from "vitest"
import {
  nextStage,
  isPostResponse,
  STAGE_LABEL,
  type EvalStage,
  type EvalEvent,
} from "../evalStages"

describe("eval stage machine", () => {
  it("starts pre-response and never emits a post-response label without a response/fail event", () => {
    let stage: EvalStage = "uploading"
    // Fire only 'sent' events (the request in flight) many times — must NEVER
    // reach done/error. This is the guard against the old 'Scoring…' lie.
    for (let i = 0; i < 100; i++) {
      stage = nextStage(stage, "sent")
      expect(isPostResponse(stage)).toBe(false)
    }
    expect(stage).toBe("analyzing")
  })

  it("uploading → analyzing only on 'sent'", () => {
    expect(nextStage("uploading", "sent")).toBe("analyzing")
  })

  it("reaches 'done' only via a 'response' event", () => {
    expect(nextStage("uploading", "response")).toBe("done")
    expect(nextStage("analyzing", "response")).toBe("done")
  })

  it("reaches 'error' only via a 'fail' event", () => {
    expect(nextStage("uploading", "fail")).toBe("error")
    expect(nextStage("analyzing", "fail")).toBe("error")
  })

  it("terminal stages are sticky", () => {
    const events: EvalEvent[] = ["sent", "response", "fail"]
    for (const e of events) {
      expect(nextStage("done", e)).toBe("done")
      expect(nextStage("error", e)).toBe("error")
    }
  })

  it("labels exist for every stage and analyzing never implies scoring is done", () => {
    expect(STAGE_LABEL.uploading).toMatch(/uploading/i)
    expect(STAGE_LABEL.analyzing).toMatch(/analyz/i)
    expect(STAGE_LABEL.analyzing).not.toMatch(/scor|done|complete/i)
  })
})

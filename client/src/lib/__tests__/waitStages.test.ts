import { describe, it, expect } from "vitest"
import { nextStage, isPostResponse, type WaitStage, type WaitEvent } from "../waitStages"
import { waitStageLabel } from "../strings"

describe("wait stage machine", () => {
  it("starts pre-response and never emits a post-response label without a response/fail event", () => {
    let stage: WaitStage = "uploading"
    // Fire only 'sent' events (the request in flight) many times — must NEVER
    // reach done/error. This is the guard against the old 'Scoring…' lie.
    for (let i = 0; i < 100; i++) {
      stage = nextStage(stage, "sent")
      expect(isPostResponse(stage)).toBe(false)
    }
    expect(stage).toBe("learning")
  })

  it("uploading → learning only on 'sent'", () => {
    expect(nextStage("uploading", "sent")).toBe("learning")
  })

  it("reaches 'done' only via a 'response' event", () => {
    expect(nextStage("uploading", "response")).toBe("done")
    expect(nextStage("learning", "response")).toBe("done")
  })

  it("reaches 'error' only via a 'fail' event", () => {
    expect(nextStage("uploading", "fail")).toBe("error")
    expect(nextStage("learning", "fail")).toBe("error")
  })

  it("terminal stages are sticky", () => {
    const events: WaitEvent[] = ["sent", "response", "fail"]
    for (const e of events) {
      expect(nextStage("done", e)).toBe("done")
      expect(nextStage("error", e)).toBe("error")
    }
  })

  it("labels say 'Learning your rhythm', never scoring or analyzing", () => {
    expect(waitStageLabel("uploading")).toMatch(/uploading/i)
    expect(waitStageLabel("learning")).toMatch(/learning your rhythm/i)
    expect(waitStageLabel("learning")).not.toMatch(/scor|analyz|evaluat|done|complete/i)
    expect(waitStageLabel("learning", "he")).not.toBe(waitStageLabel("learning"))
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../supabase", () => ({ ensureAuth: vi.fn().mockResolvedValue("jwt-token") }))

import { evaluateVideo, EVAL_TIMEOUT_MS } from "../api"

const OK_RESULT = {
  overall: 88,
  dimensions: { voice: 1, body: 1, delivery: 1, timing: 1, accuracy: 1 },
  comments: [],
  flags: [],
  language: "en",
  evals_left_today: 5,
}

describe("evaluateVideo transport (fetch + AbortController)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("success routes the parsed result back to the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(OK_RESULT) }),
    )
    const onSent = vi.fn()
    const result = await evaluateVideo(new Blob(["v"]), "p1", onSent)
    expect(result).toEqual(OK_RESULT)
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  it("a network error rejects (never hangs)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    await expect(evaluateVideo(new Blob(["v"]), "p1")).rejects.toMatchObject({
      status: 0,
      message: "Network error",
    })
  })

  it("a timeout aborts and rejects after EVAL_TIMEOUT_MS (no infinite wait)", async () => {
    vi.useFakeTimers()
    // fetch that only rejects when its abort signal fires — mimics a dead request.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            )
          }),
      ),
    )

    const promise = evaluateVideo(new Blob(["v"]), "p1")
    const assertion = expect(promise).rejects.toMatchObject({
      status: 0,
      message: "Evaluation timed out",
    })
    await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS + 1)
    await assertion
  })
})

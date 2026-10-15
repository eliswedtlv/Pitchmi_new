import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../supabase", () => ({ ensureAuth: vi.fn().mockResolvedValue("jwt-token") }))

import { getRhythm, RHYTHM_TIMEOUT_MS } from "../api"

const OK_RESULT = {
  path: null,
  coverage: null,
  language: "en",
  rhythms_left_today: 5,
}

describe("getRhythm transport (fetch + AbortController)", () => {
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
    const result = await getRhythm(new Blob(["v"]), "p1", onSent)
    expect((fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]).toMatch(/\/api\/rhythm$/)
    expect(result).toEqual(OK_RESULT)
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  it("a network error rejects (never hangs)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    await expect(getRhythm(new Blob(["v"]), "p1")).rejects.toMatchObject({
      status: 0,
      message: "Network error",
    })
  })

  it("a timeout aborts and rejects after RHYTHM_TIMEOUT_MS (no infinite wait)", async () => {
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

    const promise = getRhythm(new Blob(["v"]), "p1")
    const assertion = expect(promise).rejects.toMatchObject({
      status: 0,
      message: "Upload timed out",
    })
    await vi.advanceTimersByTimeAsync(RHYTHM_TIMEOUT_MS + 1)
    await assertion
  })
})
